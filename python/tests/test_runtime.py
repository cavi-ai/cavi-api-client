import asyncio
import json
import math
import os
from pathlib import Path
import signal
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "python"))
from cavi_runtime import RuntimeClient, ApiClientError, BridgeError


class RuntimeIntegration(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []
        self.connections = set()
        self.server = await asyncio.start_server(self.handle_http, "127.0.0.1", 0)
        port = self.server.sockets[0].getsockname()[1]
        self.env = dict(os.environ, TEST_BASE_URL=f"http://127.0.0.1:{port}")
        self.command = ["node", str(ROOT / "dist/core/transport/node/runtime-bridge-cli.js"), str(ROOT / "python/tests/provider.mjs")]
        self.clients = []

    async def asyncTearDown(self):
        for client in self.clients:
            await client.close()
        self.server.close()
        await self.server.wait_closed()
        for writer in self.connections:
            writer.close()
        await asyncio.gather(*(writer.wait_closed() for writer in self.connections), return_exceptions=True)

    async def handle_http(self, reader, writer):
        self.connections.add(writer)
        try:
            while True:
                headers = await reader.readuntil(b"\r\n\r\n")
                lines = headers.decode().split("\r\n")
                method, path, _ = lines[0].split(" ")
                fields = dict(line.split(": ", 1) for line in lines[1:] if ": " in line)
                size = int(next((value for key, value in fields.items() if key.lower() == "content-length"), "0"))
                body = json.loads(await reader.readexactly(size)) if size else None
                self.requests.append((method, path, body, fields))
                status = "200 OK"
                if path == "/v1/messages":
                    text = body["messages"][0]["content"]
                    if text == "slow":
                        await asyncio.sleep(2)
                    if text == "denied":
                        status = "401 Unauthorized"
                        data = {"error": {"message": "secret integration-key"}}
                    else:
                        data = {"id": "msg-1", "model": "test-model", "content": [{"type": "text", "text": "Hello 😀"}], "stop_reason": "end_turn", "usage": {"input_tokens": 2, "output_tokens": 3}}
                elif method == "POST" and path == "/v1/responses":
                    data = {"id": "resp-1", "status": "queued", "model": "test-model", "output": []}
                elif path == "/v1/responses/resp-1/cancel":
                    data = {"id": "resp-1", "status": "cancelled"}
                else:
                    data = {"id": "resp-1", "status": "completed", "output_text": "Background answer", "output": [], "usage": {"input_tokens": 2, "output_tokens": 3, "total_tokens": 5}}
                encoded = json.dumps(data).encode()
                writer.write(f"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {len(encoded)}\r\n\r\n".encode() + encoded)
                await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writer.close()

    async def connect(self, **kwargs):
        client = await RuntimeClient.connect(self.command, env=self.env, **kwargs)
        self.clients.append(client)
        return client

    async def test_real_provider_state_survives_multiple_calls(self):
        client = await self.connect()
        self.assertEqual(client.capabilities["providerKind"], "claude-sdk")
        self.assertTrue(client.capabilities["supports"]["batch"])
        self.assertNotIn("submitBatch", client.operations)
        run = await client.start_run({"input": "hello"})
        self.assertEqual(run["status"], "completed")
        self.assertEqual(await client.require_run_text(run), "Hello 😀")
        self.assertEqual(await client.get_run(run["run_id"]), run)
        self.assertEqual((await client.cancel_run(run["run_id"]))["status"], "completed")
        self.assertEqual(len(self.requests), 1)
        fields = {key.lower(): value for key, value in self.requests[0][3].items()}
        self.assertEqual(fields["x-api-key"], "integration-key")
        self.assertEqual(self.requests[0][2]["messages"], [{"role": "user", "content": "hello"}])

    async def test_background_retrieval_and_explicit_cancellation(self):
        self.env["TEST_PROVIDER"] = "codex"
        client = await self.connect()
        run = await client.start_run({"input": "background", "metadata": {"background": True}})
        self.assertEqual(run["status"], "started")
        completed = await client.get_run(run["run_id"])
        self.assertEqual(await client.require_run_text(completed), "Background answer")
        self.assertEqual((await client.cancel_run(run["run_id"]))["status"], "cancelled")
        self.assertEqual([(method, path) for method, path, *_ in self.requests], [("POST", "/v1/responses"), ("GET", "/v1/responses/resp-1"), ("POST", "/v1/responses/resp-1/cancel")])

    async def test_typed_errors_do_not_leak_provider_diagnostics(self):
        client = await self.connect()
        with self.assertRaises(ApiClientError) as caught:
            await client.start_run({"input": "denied"})
        self.assertEqual(caught.exception.status, 401)
        self.assertNotIn("integration-key", str(caught.exception))
        self.assertEqual((await client.start_run({"input": "hello"}))["status"], "completed")

    async def test_completion_helpers_preserve_empty_output_and_unknown_states(self):
        client = await self.connect()
        self.assertEqual(await client.require_run_text({"run_id": "empty", "status": "completed", "output": "", "response": "legacy"}), "")
        for status, code in [("failed", "run_failed"), ("cancelled", "run_cancelled"), ("future_state", "run_incomplete"), ("dry_run", "run_incomplete")]:
            with self.subTest(status=status), self.assertRaises(ApiClientError) as caught:
                await client.require_run_text({"run_id": "run", "status": status, "output": "partial"})
            self.assertEqual(caught.exception.code, code)
        with self.assertRaises(ApiClientError) as caught:
            await client.require_run_text({"run_id": "tool", "status": "completed"})
        self.assertEqual(caught.exception.code, "run_output_missing")

    async def test_deadline_reaps_child_without_cancelling_backend_or_retrying(self):
        client = await self.connect(timeout=0.2)
        with self.assertRaises(TimeoutError):
            await client.start_run({"input": "slow"})
        self.assertTrue(client.closed)
        self.assertIsNotNone(client._process.returncode)
        with self.assertRaises(BridgeError):
            await client.get_run("msg-1")
        self.assertEqual(len(self.requests), 1)

    async def test_task_cancellation_reaps_child(self):
        client = await self.connect()
        task = asyncio.create_task(client.start_run({"input": "slow"}))
        while not self.requests:
            await asyncio.sleep(0.01)
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(client.closed)
        self.assertIsNotNone(client._process.returncode)
        self.assertEqual(len(self.requests), 1)

    async def test_cancelled_close_finishes_reaping_before_it_returns(self):
        client = await self.connect()
        run = asyncio.create_task(client.start_run({"input": "slow"}))
        while not self.requests:
            await asyncio.sleep(0.01)
        closing = asyncio.create_task(client.close())
        await asyncio.sleep(0.02)
        closing.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await closing
        self.assertIsNotNone(client._process.returncode)
        with self.assertRaises(BridgeError):
            await run

    async def test_malformed_reply_followed_by_output_flood_has_bounded_cleanup(self):
        code = "import sys; sys.stdin.readline(); sys.stdout.buffer.write(b'bad\\n' + b'x' * 8388608); sys.stdout.flush()"
        with self.assertRaises(BridgeError):
            await asyncio.wait_for(RuntimeClient.connect([sys.executable, "-c", code], timeout=1), 2)

    async def test_concurrent_calls_are_correlated_and_context_closes(self):
        client = await self.connect()
        async with client:
            results = await asyncio.gather(*(client.require_run_text({"run_id": str(i), "status": "completed", "output": str(i)}) for i in range(10)))
            self.assertEqual(results, [str(i) for i in range(10)])
        self.assertTrue(client.closed)
        self.assertIsNotNone(client._process.returncode)
        await client.close()

    async def test_invalid_local_input_does_not_poison_channel(self):
        client = await self.connect()
        for body in [{"input": math.nan}, {"input": "x" * 1048576}]:
            with self.assertRaises(ValueError):
                await client.start_run(body)
        self.assertEqual(await client.require_run_text({"run_id": "ok", "status": "completed", "output": "ok"}), "ok")

    async def test_bad_factory_fails_with_bounded_cleanup(self):
        with self.assertRaises(BridgeError):
            await RuntimeClient.connect(["node", str(ROOT / "dist/core/transport/node/runtime-bridge-cli.js"), str(ROOT / "missing.mjs")], timeout=1)

    async def test_malformed_mismatched_oversized_and_unterminated_replies(self):
        for payload in ['{"v":2,"id":1,"ok":true,"result":{}}\n', '{"v":1,"id":9,"ok":true,"result":{}}\n', 'bad\n', 'x' * 1048577, '{"v":1}', '{"v":1,"v":1,"id":1,"ok":true,"result":{}}\n', '[' * 1100 + ']' * 1100 + '\n']:
            with self.subTest(payload=payload[:40]), self.assertRaises(BridgeError):
                expression = "'x' * 1048577" if len(payload) > 1048576 else repr(payload)
                await RuntimeClient.connect([sys.executable, "-c", "import sys; sys.stdin.readline(); sys.stdout.write(" + expression + "); sys.stdout.flush()"], timeout=1)

    async def test_cleanup_does_not_wait_for_descendant_stdout(self):
        with tempfile.TemporaryDirectory() as temporary:
            pid_file = str(Path(temporary) / "pids.json")
            code = (
                "import json,os,subprocess,sys,time; "
                "child=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)']); "
                "open(sys.argv[1],'w').write(json.dumps([os.getpid(),child.pid])); "
                "sys.stdin.readline(); sys.stdout.write('bad\\n'); sys.stdout.flush(); time.sleep(30)"
            )
            try:
                with self.assertRaises(BridgeError):
                    await asyncio.wait_for(RuntimeClient.connect([sys.executable, "-c", code, pid_file], timeout=1), 2)
                parent, _ = json.loads(Path(pid_file).read_text())
                with self.assertRaises(ProcessLookupError):
                    os.kill(parent, 0)
            finally:
                if Path(pid_file).exists():
                    for pid in json.loads(Path(pid_file).read_text()):
                        try:
                            os.kill(pid, signal.SIGTERM)
                        except ProcessLookupError:
                            pass

    async def test_oversized_error_status_closes_and_reaps_bridge(self):
        handshake = {"v": 1, "id": 1, "ok": True, "result": {
            "protocolVersion": 1, "maxFrameBytes": 1048576,
            "operations": ["getRuntimeCapabilities", "startRun", "requireCompletedRun", "requireRunText"],
            "capabilities": {"providerKind": "test", "supports": {"runs": True}},
        }}
        failure = {"v": 1, "id": 2, "ok": False, "error": {
            "message": "failure", "type": "http", "code": "http_request_failed", "status": 10 ** 400,
        }}
        code = (
            "import sys,time; sys.stdin.readline(); print(" + repr(json.dumps(handshake)) + ",flush=True); "
            "sys.stdin.readline(); print(" + repr(json.dumps(failure)) + ",flush=True); time.sleep(30)"
        )
        client = await RuntimeClient.connect([sys.executable, "-c", code], timeout=1)
        self.clients.append(client)
        with self.assertRaises(BridgeError):
            await client.start_run({"input": "x"})
        self.assertIsNotNone(client._process.returncode)


if __name__ == "__main__":
    unittest.main()
