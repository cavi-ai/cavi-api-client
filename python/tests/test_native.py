"""Installed native SDK acceptance tests using real local network transports."""

import asyncio
import json
import os
import shutil
import sys
import unittest
from pathlib import Path
from cavi_runtime import ApiClientError, create_runtime_client


class NativeClients(unittest.IsolatedAsyncioTestCase):
    async def test_http_client_ownership_and_resumable_close(self):
        import httpx

        arrived, release = asyncio.Event(), asyncio.Event()

        class GatedClient(httpx.AsyncClient):
            async def aclose(self):
                arrived.set()
                await release.wait()
                await super().aclose()

        shared = httpx.AsyncClient(trust_env=False)
        client = self.client("codex-responses", http_client=shared)
        await client.close()
        self.assertFalse(shared.is_closed)
        await shared.aclose()
        client = self.client("codex-responses")
        await client._http.aclose()
        owned = GatedClient(trust_env=False)
        client._http = owned
        closing = asyncio.create_task(client.close())
        await asyncio.wait_for(arrived.wait(), 1)
        closing.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await closing
        release.set()
        await asyncio.wait_for(client.close(), 1)
        self.assertTrue(owned.is_closed)

    async def test_malformed_provider_responses_and_headers_are_typed(self):
        for provider, payload in (
            ("codex-responses", {"id": "run_1", "status": {}}),
            (
                "codex-responses",
                {
                    "id": "run_1",
                    "status": "completed",
                    "output": [{"type": "message", "content": None}],
                },
            ),
            ("claude-sdk", {"id": "run_1", "content": None}),
        ):
            self.replies.append((200, payload))
            async with self.client(provider) as client:
                with self.assertRaises(ApiClientError) as caught:
                    await client.start_run({"input": "hello"})
                self.assertEqual(caught.exception.code, "transport_protocol_error")
        with self.assertRaises(ApiClientError) as caught:
            create_runtime_client("codex-responses", api_key="secret\r\ninjected")
        self.assertEqual(caught.exception.type, "configuration")
        self.assertNotIn("secret", str(caught.exception))

    async def test_shared_typescript_request_and_response_contracts(self):
        fixtures = json.loads(
            Path(__file__).with_name("lifecycle-cases.json").read_text()
        )
        for case in fixtures:
            self.replies.append((200, case["response"]))
            async with self.client(case["provider"]) as client:
                self.assertEqual(await client.start_run(case["body"]), case["run"])
            self.assertEqual(self.requests[-1][3], case["request"])

    async def test_opencode_rejects_malformed_earlier_and_user_parts(self):
        session = {"id": "ses_1", "directory": "/repo", "version": "1.18.27"}
        latest = {
            "info": {
                "id": "msg_2",
                "role": "assistant",
                "sessionID": "ses_1",
                "providerID": "test",
                "modelID": "model",
                "time": {"created": 2, "completed": 3},
            },
            "parts": [{"type": "text", "text": "answer"}],
        }
        for role in ("assistant", "user"):
            malformed = {
                "info": {
                    "id": "msg_1",
                    "role": role,
                    "sessionID": "ses_1",
                    "time": {"created": 1},
                },
                "parts": [{"type": "unrecognized"}],
            }
            self.replies.extend(
                [
                    (200, {"healthy": True, "version": "1.18.27"}),
                    (200, session),
                    (200, {}),
                    (200, [malformed, latest]),
                ]
            )
            async with self.client("opencode", directory="/repo") as client:
                with self.assertRaises(ApiClientError) as caught:
                    await client.get_run("ses_1")
                self.assertEqual(caught.exception.code, "transport_protocol_error")

    async def test_close_during_openclaw_connection_never_sends_a_run(self):
        from websockets.asyncio.server import serve

        arrived, release = asyncio.Event(), asyncio.Event()
        sent = []

        async def handshake(connection, request):
            arrived.set()
            await release.wait()

        async def handler(ws):
            async for message in ws:
                sent.append(message)

        async with serve(handler, "127.0.0.1", 0, process_request=handshake) as server:
            url = "ws://127.0.0.1:" + str(server.sockets[0].getsockname()[1])
            client = create_runtime_client(
                "openclaw", ws_url=url, client_id="test-client"
            )
            pending = asyncio.create_task(client.start_run({"input": "hello"}))
            await asyncio.wait_for(arrived.wait(), 1)
            try:
                await asyncio.wait_for(client.close(), 1)
                with self.assertRaises(asyncio.CancelledError):
                    await pending
            finally:
                release.set()
        self.assertFalse(sent)

    async def asyncSetUp(self):
        self.requests = []
        self.replies = []
        self.server = await asyncio.start_server(self.handle, "127.0.0.1", 0)
        self.base = "http://127.0.0.1:" + str(self.server.sockets[0].getsockname()[1])

    async def asyncTearDown(self):
        self.server.close()
        await self.server.wait_closed()

    async def handle(self, reader, writer):
        try:
            header = await reader.readuntil(b"\r\n\r\n")
            lines = header.decode().split("\r\n")
            method, path, _ = lines[0].split(" ")
            headers = dict(
                line.lower().split(": ", 1) for line in lines[1:] if ": " in line
            )
            body = await reader.readexactly(int(headers.get("content-length", 0)))
            self.requests.append(
                (method, path, headers, json.loads(body) if body else None)
            )
            code, payload = self.replies.pop(0)
            if callable(payload):
                payload = await payload()
            data = (
                payload if isinstance(payload, bytes) else json.dumps(payload).encode()
            )
            writer.write(
                f"HTTP/1.1 {code} Status\r\nContent-Type: application/json\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n".encode()
                + data
            )
            await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionError):
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    def client(self, provider, **options):
        return create_runtime_client(
            provider,
            base_url=self.base,
            api_key="test-secret",
            default_model="test-model",
            **options,
        )

    async def test_native_does_not_import_bridge_or_need_node(self):
        self.assertNotIn("cavi_runtime.client", sys.modules)
        self.assertNotIn("cavi_runtime._process", sys.modules)
        if os.environ.get("CAVI_ASSERT_NO_NODE"):
            self.assertIsNone(shutil.which("node"))
            self.assertIsNone(shutil.which("npm"))

    async def test_claude_mapping_and_synchronous_store(self):
        self.replies.append(
            (
                200,
                {
                    "id": "msg_1",
                    "stop_reason": "end_turn",
                    "content": [{"type": "text", "text": "answer"}],
                    "usage": {"input_tokens": 2, "output_tokens": 3},
                },
            )
        )
        async with self.client("claude-sdk") as c:
            run = await c.start_run(
                {
                    "input": "hello",
                    "instructions": "system",
                    "metadata": {"max_tokens": 7},
                }
            )
            self.assertEqual(await c.require_run_text(run), "answer")
            self.assertEqual(run["tokens"]["totalTokens"], 5)
            self.assertEqual(await c.get_run("msg_1"), run)
            self.assertEqual((await c.get_run("foreign"))["status"], "unknown")
            self.assertEqual(await c.cancel_run("msg_1"), {"status": "completed"})
        method, path, headers, body = self.requests[0]
        self.assertEqual((method, path), ("POST", "/v1/messages"))
        self.assertEqual(headers["x-api-key"], "test-secret")
        self.assertEqual(
            body,
            {
                "model": "test-model",
                "max_tokens": 7,
                "messages": [{"role": "user", "content": "hello"}],
                "system": "system",
            },
        )

    async def test_codex_background_get_cancel_empty_and_failure(self):
        self.replies.extend(
            [
                (200, {"id": "resp_1", "status": "queued"}),
                (200, {"id": "resp_1", "status": "completed", "output_text": ""}),
                (200, {"id": "resp_1", "status": "cancelled"}),
                (
                    200,
                    {
                        "id": "resp_2",
                        "status": "incomplete",
                        "incomplete_details": {"reason": "max_output_tokens"},
                    },
                ),
            ]
        )
        async with self.client("codex-responses") as c:
            self.assertEqual(
                (await c.start_run({"input": "hello"}))["status"], "started"
            )
            self.assertEqual(await c.require_run_text(await c.get_run("resp_1")), "")
            self.assertEqual(await c.cancel_run("resp_1"), {"status": "cancelled"})
            failed = await c.get_run("resp_2")
            self.assertEqual(failed["errorDetails"], {"reason": "max_output_tokens"})
            with self.assertRaises(ApiClientError) as caught:
                await c.require_run_text(failed)
            self.assertEqual(caught.exception.code, "run_failed")
        self.assertEqual(
            [r[1] for r in self.requests],
            [
                "/v1/responses",
                "/v1/responses/resp_1",
                "/v1/responses/resp_1/cancel",
                "/v1/responses/resp_2",
            ],
        )
        self.assertTrue(self.requests[0][3]["background"])
        self.assertTrue(self.requests[0][3]["store"])

    async def test_agy_mapping(self):
        self.replies.append(
            (
                200,
                {
                    "run_id": "agy_1",
                    "status": "completed",
                    "result": {"output": "answer"},
                },
            )
        )
        async with self.client("agy") as c:
            run = await c.start_run({"input": "hello", "instructions": "system"})
            self.assertEqual(await c.require_run_text(run), "answer")
            self.assertEqual(await c.get_run(run["run_id"]), run)
        self.assertEqual(self.requests[0][1], "/v1/agents/run")
        self.assertEqual(
            self.requests[0][3],
            {
                "agent_id": "test-model",
                "stream": False,
                "instructions": "system",
                "context": {"query": "hello"},
            },
        )

    async def test_hermes_raw_lifecycle(self):
        run = {
            "run_id": "run_1",
            "status": "future_state",
            "output": "partial",
            "usage": {"input_tokens": 1},
        }
        self.replies.extend([(200, run), (200, run), (200, {"status": "stopping"})])
        async with self.client("hermes") as c:
            self.assertEqual(
                (await c.start_run({"input": "hello"}))["status"], "future_state"
            )
            await c.get_run("run_1")
            self.assertEqual(await c.cancel_run("run_1"), {"status": "stopping"})
        self.assertEqual(
            [r[1] for r in self.requests],
            ["/v1/runs", "/v1/runs/run_1", "/v1/runs/run_1/stop"],
        )

    async def test_managed_agents_session_events(self):
        self.replies.extend(
            [
                (200, {"id": "sess_1"}),
                (200, {}),
                (200, {"id": "sess_1", "status": "idle"}),
                (200, {}),
            ]
        )
        async with self.client(
            "claude-managed-agents", agent_id="agent_1", environment_id="env_1"
        ) as c:
            self.assertEqual(
                (await c.start_run({"input": "hello"}))["status"], "started"
            )
            self.assertEqual((await c.get_run("sess_1"))["status"], "completed")
            self.assertEqual(await c.cancel_run("sess_1"), {"status": "cancelled"})
        self.assertEqual(
            self.requests[0][3], {"agent": {"id": "agent_1"}, "environment_id": "env_1"}
        )
        self.assertEqual(
            self.requests[1][3],
            {
                "events": [
                    {
                        "type": "user.message",
                        "content": [{"type": "text", "text": "hello"}],
                    }
                ]
            },
        )
        self.assertEqual(self.requests[-1][3], {"events": [{"type": "user.interrupt"}]})
        self.assertEqual(
            self.requests[0][2]["anthropic-beta"], "managed-agents-2026-04-01"
        )

    async def test_opencode_scoped_session_and_resume(self):
        session = {"id": "ses_1", "directory": "/repo space", "version": "1.18.27"}
        message = {
            "info": {
                "id": "msg_1",
                "role": "assistant",
                "sessionID": "ses_1",
                "providerID": "test",
                "modelID": "model",
                "time": {"created": 1, "completed": 2},
            },
            "parts": [{"type": "text", "text": "answer"}],
        }
        self.replies.extend(
            [
                (200, {"healthy": True, "version": "1.18.27"}),
                (200, session),
                (200, message),
                (200, True),
            ]
        )
        async with self.client("opencode", directory="/repo space") as c:
            run = await c.start_run({"input": "hello", "model": "test/model"})
            self.assertEqual(await c.require_run_text(run), "answer")
            self.assertEqual(await c.get_run("ses_1"), run)
            self.assertEqual(await c.cancel_run("ses_1"), {"status": "cancelled"})
        self.assertIn("directory=%2Frepo%20space", self.requests[1][1])
        self.assertEqual(
            self.requests[2][3]["model"], {"providerID": "test", "modelID": "model"}
        )

    async def test_errors_bounds_deadlines_and_local_validation(self):
        self.replies.extend(
            [(401, {"error": "test-secret"}), (200, b"not-json"), (200, b"x" * 65)]
        )
        async with self.client("codex-responses", max_response_bytes=64) as c:
            for code in (
                "unauthorized",
                "transport_protocol_error",
                "transport_protocol_error",
            ):
                with self.assertRaises(ApiClientError) as caught:
                    await c.start_run({"input": "hello"})
                self.assertEqual(caught.exception.code, code)
                self.assertNotIn("test-secret", str(caught.exception))
            with self.assertRaises(ApiClientError):
                await c.start_run({"input": None})

        async def delayed():
            await asyncio.sleep(0.1)
            return {"id": "resp_1"}

        self.replies.append((200, delayed))
        async with self.client("codex-responses", timeout=0.02) as c:
            with self.assertRaises(TimeoutError):
                await c.start_run({"input": "hello"})

    async def test_dry_runs_advertise_only_native_operations(self):
        for provider, options in [
            ("claude-sdk", {}),
            ("codex-responses", {}),
            ("agy", {}),
            ("hermes", {}),
            ("opencode", {"directory": "/repo", "default_model": "test/model"}),
            (
                "claude-managed-agents",
                {"agent_id": "agent_1", "environment_id": "env_1"},
            ),
        ]:
            options.setdefault("default_model", "test-model")
            async with create_runtime_client(
                provider, base_url=self.base, api_key="test-secret", **options
            ) as c:
                self.assertEqual(
                    (await c.start_run({"input": "hello", "dryRun": True}))["status"],
                    "dry_run",
                )
                caps = await c.get_runtime_capabilities()
                self.assertFalse(caps["supports"]["streaming"])
                self.assertFalse(caps["supports"]["batch"])
        self.assertFalse(self.requests)

    async def test_openclaw_real_websocket_handshake_and_lifecycle(self):
        from websockets.asyncio.server import serve

        frames = []

        async def handler(ws):
            await ws.send(
                json.dumps(
                    {
                        "type": "event",
                        "event": "connect.challenge",
                        "payload": {"nonce": "nonce_1"},
                    }
                )
            )
            async for data in ws:
                frame = json.loads(data)
                frames.append(frame)
                replies = {
                    "connect": {
                        "type": "hello-ok",
                        "protocol": 4,
                        "features": {
                            "methods": ["chat.send", "agent.wait", "sessions.abort"]
                        },
                    },
                    "chat.send": {"runId": "run_ws", "status": "started"},
                    "agent.wait": {
                        "runId": "run_ws",
                        "status": "completed",
                        "text": "answer",
                    },
                    "sessions.abort": {"aborted": True},
                }
                await ws.send(
                    json.dumps(
                        {
                            "type": "res",
                            "id": frame["id"],
                            "ok": True,
                            "payload": replies[frame["method"]],
                        }
                    )
                )

        async with serve(handler, "127.0.0.1", 0) as server:
            url = "ws://127.0.0.1:" + str(server.sockets[0].getsockname()[1])
            async with create_runtime_client(
                "openclaw",
                ws_url=url,
                auth_token="test-secret",
                client_id="test-client",
            ) as c:
                self.assertEqual(
                    (await c.start_run({"input": "hello"}))["run_id"], "run_ws"
                )
                self.assertEqual(
                    await c.require_run_text(await c.get_run("run_ws")), "answer"
                )
                self.assertEqual(await c.cancel_run("run_ws"), {"status": "aborted"})
        self.assertEqual(
            [f["method"] for f in frames],
            ["connect", "chat.send", "agent.wait", "sessions.abort"],
        )
        self.assertEqual(frames[0]["params"]["auth"]["token"], "test-secret")
        self.assertEqual(frames[1]["params"]["sessionKey"], "main")
