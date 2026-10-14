"""OpenClaw lifecycle via authenticated, bounded WebSocket RPC."""

from __future__ import annotations
import asyncio
import inspect
import json
from urllib.parse import urlsplit
from uuid import uuid4

from .native import (
    NativeRuntimeClient,
    add_usage,
    decode,
    failure,
    record,
    required,
    validate_body,
    validate_run,
)


class OpenClawClient(NativeRuntimeClient):
    provider_kind = "openclaw"

    def __init__(
        self,
        *,
        ws_url: str,
        client_id: str,
        auth_token=None,
        scopes=(),
        client_mode="webchat",
        protocol_version=4,
        device_signer=None,
        **options,
    ):
        super().__init__(**options)
        parsed = urlsplit(ws_url)
        if (
            parsed.scheme not in ("ws", "wss")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.fragment
        ):
            raise failure("invalid_config", "configuration")
        required(client_id, "client_id")
        if type(protocol_version) is not int or protocol_version < 1:
            raise failure("invalid_config", "configuration")
        if not isinstance(scopes, (list, tuple)) or any(
            not isinstance(s, str) or not s.strip() for s in scopes
        ):
            raise failure("invalid_config", "configuration")
        self._url = ws_url
        self._profile = {
            "minProtocol": protocol_version,
            "maxProtocol": protocol_version,
            "client": {
                "id": client_id,
                "version": "0.20.0",
                "platform": "python",
                "mode": client_mode,
            },
            "role": "operator",
            "scopes": list(dict.fromkeys(scopes)),
            "caps": [],
        }
        if auth_token:
            self._profile["auth"] = {"token": auth_token, "password": auth_token}
        self._signer = device_signer
        self._ws = None
        self._methods = None
        self._lock = asyncio.Lock()
        self._active = None

    async def _disconnect(self):
        ws, self._ws = self._ws, None
        self._methods = None
        if ws is not None:
            await ws.close()

    async def close(self):
        self._closed = True
        active = self._active
        if active is not None and active is not asyncio.current_task():
            active.cancel()
            await asyncio.gather(active, return_exceptions=True)
        await self._disconnect()

    async def _receive(self):
        raw = await self._ws.recv()
        if isinstance(raw, str):
            raw = raw.encode()
        if len(raw) > self.max_response_bytes:
            raise failure("transport_protocol_error")
        return record(decode(raw))

    async def _exchange(self, method, params):
        self._check_open()
        identifier = str(uuid4())
        frame = json.dumps(
            {"type": "req", "id": identifier, "method": method, "params": params},
            allow_nan=False,
        )
        if len(frame.encode()) > self.max_response_bytes:
            raise failure("validation_failed", "validation")
        await self._ws.send(frame)
        while True:
            reply = await self._receive()
            if reply.get("type") == "event":
                continue
            if (
                reply.get("type") != "res"
                or reply.get("id") != identifier
                or type(reply.get("ok")) is not bool
            ):
                raise failure("transport_protocol_error")
            if not reply["ok"]:
                raise failure("gateway_error")
            if "payload" not in reply:
                raise failure("transport_protocol_error")
            return reply["payload"]

    async def _connect(self):
        try:
            from websockets.asyncio.client import connect
        except ImportError:
            raise failure("invalid_config", "configuration") from None
        self._ws = await connect(
            self._url,
            max_size=self.max_response_bytes,
            max_queue=16,
            open_timeout=self.timeout,
            close_timeout=1,
            proxy=None,
        )
        self._check_open()
        challenge = await self._receive()
        if (
            challenge.get("type") != "event"
            or challenge.get("event") != "connect.challenge"
        ):
            raise failure("transport_protocol_error")
        nonce = record(challenge.get("payload")).get("nonce")
        if not isinstance(nonce, str) or not nonce:
            raise failure("transport_protocol_error")
        from copy import deepcopy

        params = deepcopy(self._profile)
        if self._signer is not None:
            device = self._signer(nonce, deepcopy(params))
            if inspect.isawaitable(device):
                device = await device
            params["device"] = record(device)
        hello = record(await self._exchange("connect", params))
        if (
            hello.get("type") != "hello-ok"
            or hello.get("protocol") != params["minProtocol"]
        ):
            raise failure("transport_protocol_error")
        methods = hello.get("features", {}).get("methods")
        if methods is not None:
            if not isinstance(methods, list) or any(
                not isinstance(m, str) for m in methods
            ):
                raise failure("transport_protocol_error")
            self._methods = frozenset(methods)

    async def _rpc(self, method, params):
        self._check_open()
        async with self._lock:
            self._check_open()
            self._active = asyncio.current_task()
            try:
                async with asyncio.timeout(self.timeout):
                    if self._ws is None:
                        await self._connect()
                    if self._methods is not None and method not in self._methods:
                        raise failure("endpoint_not_found")
                    return await self._exchange(method, params)
            except BaseException as error:
                await self._disconnect()
                if isinstance(error, (asyncio.CancelledError, TimeoutError)):
                    raise
                from .errors import ApiClientError

                if isinstance(error, ApiClientError):
                    raise
                raise failure("request_failed") from None
            finally:
                self._active = None

    async def start_run(self, body):
        self._check_open()
        body = validate_body(body)
        if body.get("dryRun"):
            return self._dry_run(body.get("model"))
        metadata = body.get("metadata", {})
        source = body.get("source", {})
        identifier = next(
            (
                metadata[k].strip()
                for k in (
                    "idempotencyKey",
                    "idempotency_key",
                    "messageId",
                    "mobileMessageId",
                )
                if isinstance(metadata.get(k), str) and metadata[k].strip()
            ),
            "cavi-run-" + str(uuid4()),
        )
        text = (
            body["input"]
            if isinstance(body["input"], str)
            else "\n".join(
                (m["role"].strip() + ": " if m["role"].strip() else "")
                + (
                    m["content"]
                    if isinstance(m["content"], str)
                    else json.dumps(m["content"], separators=(",", ":"))
                )
                for m in body["input"]
            )
        )
        params = {
            "sessionKey": body.get("sessionKey")
            or body.get("session_key")
            or body.get("session_id")
            or "main",
            "message": text,
            "idempotencyKey": identifier,
        }
        if body.get("session_id"):
            params["sessionId"] = body["session_id"]
        for field, keys in (
            ("thinking", ("thinking", "thinkingLevel", "reasoning")),
            ("fastMode", ("fastMode", "fast_mode")),
            ("deliver", ("deliver",)),
            ("timeoutMs", ("timeoutMs", "timeout_ms")),
        ):
            for key in keys:
                if key in metadata:
                    params[field] = metadata[key]
                    break
        for key in (
            "originatingChannel",
            "originatingTo",
            "originatingAccountId",
            "originatingThreadId",
        ):
            if source.get(key):
                params[key] = source[key]
        if body.get("attachments"):
            params["attachments"] = body["attachments"]
        return self._normalize(
            await self._rpc("chat.send", params), identifier, "started"
        )

    async def get_run(self, run_id):
        required(run_id, "run_id")
        return self._normalize(
            await self._rpc("agent.wait", {"runId": run_id.strip(), "timeoutMs": 0}),
            run_id.strip(),
            "unknown",
        )

    async def cancel_run(self, run_id):
        required(run_id, "run_id")
        raw = record(await self._rpc("sessions.abort", {"runId": run_id.strip()}))
        return {
            "status": raw.get("status")
            or ("aborted" if raw.get("aborted") is True else "unknown")
        }

    def _normalize(self, raw, identifier, default):
        raw = record(raw)

        def string(*keys):
            return next(
                (
                    raw[k].strip()
                    for k in keys
                    if isinstance(raw.get(k), str) and raw[k].strip()
                ),
                None,
            )

        run = {
            "run_id": string("run_id", "runId", "id") or identifier,
            "status": string("status", "state", "phase") or default,
            "object": string("object") or "openclaw.run",
        }
        state = run["status"]
        normalized = {"ok": "completed", "error": "failed"}.get(state, state)
        if normalized != state:
            run["provider_status"] = state
            run["status"] = normalized
        for field, keys in (
            ("session_id", ("session_id", "sessionId", "sessionKey", "key")),
            ("output", ("output", "text")),
            ("response", ("response", "message")),
            ("error", ("error", "errorMessage")),
        ):
            value = (
                next((raw[k] for k in keys if isinstance(raw.get(k), str)), None)
                if field in ("output", "response")
                else string(*keys)
            )
            if value is not None:
                run[field] = value
        return validate_run(add_usage(run, raw.get("usage")))
