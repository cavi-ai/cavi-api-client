"""Native async HTTP lifecycle adapters; no Node, npm, or subprocess transport."""

from __future__ import annotations

import asyncio
from collections import OrderedDict
from copy import deepcopy
import json
import math
from typing import Any
from urllib.parse import urlsplit
from uuid import uuid4

import httpx

from .errors import ApiClientError
from . import paths


def failure(
    code: str, kind: str = "transport", status: int | None = None
) -> ApiClientError:
    return ApiClientError(
        {
            "message": "Runtime operation failed: " + code,
            "code": code,
            "type": kind,
            "status": status,
        }
    )


def required(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise failure("validation_failed", "validation")
    return value


def record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise failure("transport_protocol_error")
    return value


def decode(data: bytes) -> Any:
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate key")
            result[key] = value
        return result

    def invalid(value):
        raise ValueError("Non-finite JSON number")

    try:
        return json.loads(
            data.decode("utf-8"), object_pairs_hook=unique, parse_constant=invalid
        )
    except (ValueError, UnicodeError, RecursionError):
        raise failure("transport_protocol_error") from None


def numeric(value: Any) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def add_usage(run: dict, usage: Any) -> dict:
    if not isinstance(usage, dict):
        return run
    raw = {k: v for k, v in usage.items() if numeric(v)}
    for key in ("input_tokens_details", "output_tokens_details"):
        if isinstance(usage.get(key), dict):
            raw.update({k: v for k, v in usage[key].items() if numeric(v)})
    if not raw:
        return run
    tokens = {"raw": raw.copy()}
    aliases = {
        "inputTokens": (
            "input_tokens",
            "inputTokens",
            "prompt_tokens",
            "promptTokenCount",
        ),
        "outputTokens": (
            "output_tokens",
            "outputTokens",
            "completion_tokens",
            "candidatesTokenCount",
        ),
        "totalTokens": ("total_tokens", "totalTokens", "totalTokenCount"),
        "cacheReadTokens": (
            "cache_read_input_tokens",
            "cached_tokens",
            "cacheReadTokens",
        ),
        "cacheWriteTokens": ("cache_creation_input_tokens", "cacheWriteTokens"),
    }
    for field, keys in aliases.items():
        for key in keys:
            if key in raw:
                tokens[field] = raw[key]
                break
    if (
        "totalTokens" not in tokens
        and "inputTokens" in tokens
        and "outputTokens" in tokens
    ):
        tokens["totalTokens"] = tokens["inputTokens"] + tokens["outputTokens"]
    run.setdefault("usage", raw)
    run.setdefault("tokens", tokens)
    return run


def validate_run(value: Any) -> dict:
    run = record(value)
    for key in ("run_id", "status"):
        if not isinstance(run.get(key), str) or not run[key]:
            raise failure("transport_protocol_error")
    return run


def validate_body(value: Any) -> dict:
    if not isinstance(value, dict) or not isinstance(value.get("input"), (str, list)):
        raise failure("validation_failed", "validation")
    if isinstance(value["input"], list):
        for message in value["input"]:
            if (
                not isinstance(message, dict)
                or not isinstance(message.get("role"), str)
                or not isinstance(message.get("content"), (str, list))
            ):
                raise failure("validation_failed", "validation")
    if "metadata" in value and not isinstance(value["metadata"], dict):
        raise failure("validation_failed", "validation")
    if "tools" in value and (
        not isinstance(value["tools"], list)
        or any(not isinstance(t, dict) for t in value["tools"])
    ):
        raise failure("validation_failed", "validation")
    if "instructions" in value and not isinstance(value["instructions"], str):
        raise failure("validation_failed", "validation")
    if "dryRun" in value and type(value["dryRun"]) is not bool:
        raise failure("validation_failed", "validation")
    try:
        json.dumps(value, allow_nan=False)
    except (ValueError, TypeError, RecursionError):
        raise failure("validation_failed", "validation") from None
    return value


class NativeRuntimeClient:
    """Lifecycle surface shared by native adapters. Use an async context manager."""

    provider_kind: str

    def __init__(self, *, timeout: float = 60, max_response_bytes: int = 1_048_576):
        if (
            not numeric(timeout)
            or timeout <= 0
            or type(max_response_bytes) is not int
            or max_response_bytes <= 0
        ):
            raise failure("invalid_config", "configuration")
        self.timeout = timeout
        self.max_response_bytes = max_response_bytes
        self._closed = False
        self._runs: OrderedDict[str, dict] = OrderedDict()

    async def __aenter__(self):
        self._check_open()
        return self

    async def __aexit__(self, *exc):
        await self.close()

    def _check_open(self):
        if self._closed:
            raise failure("invalid_config", "configuration")

    async def close(self):
        self._closed = True

    async def start_run(self, body: dict) -> dict:
        raise NotImplementedError

    async def get_run(self, run_id: str) -> dict:
        raise NotImplementedError

    async def cancel_run(self, run_id: str) -> dict:
        raise NotImplementedError

    async def get_runtime_capabilities(self):
        return {
            "providerKind": self.provider_kind,
            "supports": {"runs": True, "streaming": False, "batch": False},
        }

    async def require_completed_run(self, run: dict) -> dict:
        validate_run(run)
        state = run["status"]
        if state != "completed":
            code = {"failed": "run_failed", "cancelled": "run_cancelled"}.get(
                state, "run_incomplete"
            )
            raise failure(code, "run")
        return run

    async def require_run_text(self, run: dict) -> str:
        await self.require_completed_run(run)
        for key in ("output", "response"):
            if isinstance(run.get(key), str):
                return run[key]
        raise failure("run_output_missing", "run")

    def _remember(self, run: dict) -> dict:
        validate_run(run)
        self._runs.pop(run["run_id"], None)
        self._runs[run["run_id"]] = deepcopy(run)
        if len(self._runs) > 256:
            self._runs.popitem(last=False)
        return run

    def _dry_run(self, model: str | None = None):
        return {
            "run_id": "dryrun-" + str(uuid4()),
            "status": "dry_run",
            **({"model": model} if model else {}),
        }


class HttpRuntimeClient(NativeRuntimeClient):
    def __init__(
        self,
        *,
        base_url: str,
        headers: dict | None = None,
        http_client: httpx.AsyncClient | None = None,
        **options,
    ):
        super().__init__(**options)
        parsed = urlsplit(base_url)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise failure("invalid_config", "configuration")
        self._base_url = base_url.rstrip("/")
        self._headers = headers or {}
        for value in self._headers.values():
            if not isinstance(value, str) or any(
                ord(c) < 32 or ord(c) > 126 for c in value
            ):
                raise failure("invalid_config", "configuration")
        self._http = http_client or httpx.AsyncClient(
            follow_redirects=False, trust_env=False
        )
        self._owns_http = http_client is None
        self._close_task: asyncio.Task | None = None

    async def close(self):
        self._closed = True
        if self._owns_http:
            if self._close_task is None:
                self._close_task = asyncio.create_task(self._http.aclose())
            await asyncio.shield(self._close_task)

    async def _request(self, method: str, route: str, body: Any = None):
        self._check_open()
        try:
            content = (
                None if body is None else json.dumps(body, allow_nan=False).encode()
            )
        except (ValueError, TypeError, RecursionError):
            raise failure("validation_failed", "validation") from None
        headers = {
            **self._headers,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            async with asyncio.timeout(self.timeout):
                async with self._http.stream(
                    method,
                    self._base_url + route,
                    content=content,
                    headers=headers,
                    timeout=self.timeout,
                    follow_redirects=False,
                ) as response:
                    if not 200 <= response.status_code < 300:
                        code = {
                            401: "unauthorized",
                            403: "forbidden",
                            404: "endpoint_not_found",
                            429: "rate_limited",
                        }.get(response.status_code, "request_failed")
                        raise failure(code, "http", response.status_code)
                    data = bytearray()
                    async for chunk in response.aiter_bytes():
                        if len(data) + len(chunk) > self.max_response_bytes:
                            raise failure("transport_protocol_error")
                        data.extend(chunk)
                    if not data and response.status_code == 204:
                        return None
                    return decode(bytes(data))
        except httpx.TimeoutException:
            raise TimeoutError("Runtime request deadline exceeded") from None
        except httpx.HTTPError:
            raise failure("request_failed") from None


class SynchronousClient(HttpRuntimeClient):
    async def get_run(self, run_id: str):
        self._check_open()
        required(run_id, "run_id")
        return deepcopy(
            self._runs.get(
                run_id,
                {
                    "run_id": run_id,
                    "status": "unknown",
                    "error": "Synchronous run is not retained by this client",
                },
            )
        )

    async def cancel_run(self, run_id: str):
        self._check_open()
        required(run_id, "run_id")
        return {"status": self._runs.get(run_id, {}).get("status", "completed")}


class ClaudeClient(SynchronousClient):
    provider_kind = "claude-sdk"

    def __init__(
        self,
        *,
        api_key: str,
        base_url="https://api.anthropic.com",
        default_model=None,
        default_max_tokens=4096,
        anthropic_version="2023-06-01",
        **options,
    ):
        self.default_model, self.default_max_tokens = default_model, default_max_tokens
        super().__init__(
            base_url=base_url,
            headers={
                "x-api-key": required(api_key, "api_key"),
                "anthropic-version": anthropic_version,
            },
            **options,
        )

    async def start_run(self, body: dict):
        self._check_open()
        body = validate_body(body)
        model = required(body.get("model", self.default_model), "model")
        messages = (
            body["input"]
            if isinstance(body["input"], list)
            else [{"role": "user", "content": body["input"]}]
        )
        payload = {
            "model": model,
            "max_tokens": body.get("metadata", {}).get(
                "max_tokens", self.default_max_tokens
            ),
            "messages": messages,
        }
        if body.get("instructions"):
            payload["system"] = body["instructions"]
        if body.get("tools"):
            payload["tools"] = body["tools"]
        if body.get("dryRun"):
            return self._dry_run(model)
        raw = record(await self._request("POST", paths.CLAUDE_MESSAGES, payload))
        output = "".join(
            b["text"]
            for b in response_array(raw.get("content", []))
            if isinstance(b, dict)
            and b.get("type") == "text"
            and isinstance(b.get("text"), str)
        )
        run = {
            "run_id": raw.get("id"),
            "status": "completed" if raw.get("stop_reason") else "running",
        }
        if output:
            run["output"] = output
        if raw.get("model"):
            run["model"] = raw["model"]
        return self._remember(add_usage(run, raw.get("usage")))


def codex_state(state):
    if state is not None and not isinstance(state, str):
        raise failure("transport_protocol_error")
    return {"queued": "started", "in_progress": "running", "incomplete": "failed"}.get(
        state, state or "running"
    )


def map_codex(raw):
    raw = record(raw)
    state = codex_state(raw.get("status"))
    run = {"run_id": raw.get("id"), "status": state}
    if raw.get("model"):
        run["model"] = raw["model"]
    if isinstance(raw.get("output_text"), str):
        run["output"] = raw["output_text"]
    elif isinstance(raw.get("output"), list):
        texts = [
            b["text"]
            for item in raw["output"]
            if isinstance(item, dict) and item.get("type") == "message"
            for b in response_array(item.get("content", []))
            if isinstance(b, dict)
            and b.get("type") == "output_text"
            and isinstance(b.get("text"), str)
        ]
        if texts:
            run["output"] = "".join(texts)
    if state == "failed":
        run["error"] = "Codex response failed"
        details = raw.get("error") or raw.get("incomplete_details")
        if isinstance(details, dict):
            fields = {
                target: details[source]
                for source, target in (
                    ("code", "providerCode"),
                    ("type", "providerType"),
                    ("reason", "reason"),
                )
                if isinstance(details.get(source), str) and details[source]
            }
            if fields:
                run["errorDetails"] = fields
    return validate_run(add_usage(run, raw.get("usage")))


def response_array(value):
    if not isinstance(value, list):
        raise failure("transport_protocol_error")
    return value


class CodexClient(HttpRuntimeClient):
    provider_kind = "codex-responses"

    def __init__(
        self,
        *,
        api_key: str,
        base_url="https://api.openai.com",
        default_model="gpt-5-codex",
        **options,
    ):
        self.default_model = default_model
        super().__init__(
            base_url=base_url,
            headers={"Authorization": "Bearer " + required(api_key, "api_key")},
            **options,
        )

    async def start_run(self, body: dict):
        self._check_open()
        body = validate_body(body)
        model = required(body.get("model", self.default_model), "model")
        payload = {
            "model": model,
            "input": body["input"],
            "background": True,
            "store": True,
        }
        for key in ("instructions", "tools", "metadata"):
            if body.get(key):
                payload[key] = body[key]
        if "metadata" in body:
            payload["metadata"] = body["metadata"]
        if body.get("dryRun"):
            return self._dry_run(model)
        return map_codex(await self._request("POST", paths.CODEX_RESPONSES, payload))

    async def get_run(self, run_id: str):
        return map_codex(
            await self._request("GET", paths.resource(paths.CODEX_RESPONSES, run_id))
        )

    async def cancel_run(self, run_id: str):
        return {
            "status": map_codex(
                await self._request(
                    "POST", paths.resource(paths.CODEX_RESPONSES, run_id, "/cancel")
                )
            )["status"]
        }


class AgyClient(SynchronousClient):
    provider_kind = "agy"

    def __init__(self, *, base_url: str, api_key=None, default_model=None, **options):
        self.default_model = default_model
        super().__init__(
            base_url=base_url,
            headers={"x-agy-api-key": api_key} if api_key else {},
            **options,
        )

    async def start_run(self, body: dict):
        self._check_open()
        body = validate_body(body)
        model = required(body.get("model", self.default_model), "model")
        payload = {
            "agent_id": model,
            "stream": False,
            "context": {
                "query" if isinstance(body["input"], str) else "messages": body["input"]
            },
        }
        if body.get("instructions"):
            payload["instructions"] = body["instructions"]
        if body.get("dryRun"):
            return self._dry_run(model)
        raw = record(await self._request("POST", paths.AGY_RUN, payload))
        run = {
            "run_id": raw.get("run_id") or "agy-" + str(uuid4()),
            "status": raw.get("status") or "in_progress",
            "model": model,
        }
        if isinstance(raw.get("result"), dict) and isinstance(
            raw["result"].get("output"), str
        ):
            run["output"] = raw["result"]["output"]
        return self._remember(run)


class HermesClient(HttpRuntimeClient):
    provider_kind = "hermes"

    def __init__(
        self,
        *,
        base_url: str,
        api_key=None,
        auth_token=None,
        default_model=None,
        **options,
    ):
        token = auth_token or api_key
        super().__init__(
            base_url=base_url,
            headers={"Authorization": "Bearer " + token} if token else {},
            **options,
        )

    async def start_run(self, body: dict):
        self._check_open()
        body = validate_body(body)
        if body.get("dryRun"):
            return self._dry_run(body.get("model"))
        run = validate_run(await self._request("POST", paths.HERMES_RUNS, body))
        return add_usage(run, run.get("usage"))

    async def get_run(self, run_id: str):
        run = validate_run(
            await self._request("GET", paths.resource(paths.HERMES_RUNS, run_id))
        )
        return add_usage(run, run.get("usage"))

    async def cancel_run(self, run_id: str):
        result = record(
            await self._request(
                "POST", paths.resource(paths.HERMES_RUNS, run_id, "/stop")
            )
        )
        if not isinstance(result.get("status"), str):
            raise failure("transport_protocol_error")
        return result


class ManagedAgentsClient(HttpRuntimeClient):
    provider_kind = "claude-managed-agents"

    def __init__(
        self,
        *,
        api_key=None,
        auth_token=None,
        base_url="https://api.anthropic.com",
        agent_id=None,
        environment_id=None,
        default_model=None,
        anthropic_version="2023-06-01",
        observe_run_completion=False,
        **options,
    ):
        if type(observe_run_completion) is not bool:
            raise failure("invalid_config", "configuration")
        self.observe_run_completion = observe_run_completion
        self.agent_id, self.environment_id = agent_id, environment_id
        auth = (
            {"Authorization": "Bearer " + auth_token}
            if auth_token
            else {"x-api-key": required(api_key, "api_key")}
        )
        super().__init__(
            base_url=base_url,
            headers={
                **auth,
                "anthropic-version": anthropic_version,
                "anthropic-beta": "managed-agents-2026-04-01",
            },
            **options,
        )

    async def start_run(self, body: dict):
        self._check_open()
        body = validate_body(body)
        metadata = body.get("metadata", {})
        agent = {"id": required(metadata.get("agent_id", self.agent_id), "agent_id")}
        if numeric(metadata.get("agent_version")):
            agent["version"] = metadata["agent_version"]
        payload = {
            "agent": agent,
            "environment_id": required(
                metadata.get("environment_id", self.environment_id), "environment_id"
            ),
        }
        for key in ("title", "resources", "vault_ids"):
            if metadata.get(key):
                payload[key] = metadata[key]
        if body.get("dryRun"):
            return self._dry_run()
        session = record(await self._request("POST", paths.MANAGED_SESSIONS, payload))
        identifier = session.get("id")
        if not isinstance(identifier, str) or not identifier.strip():
            raise failure("transport_protocol_error")
        content = (
            [{"type": "text", "text": body["input"]}]
            if isinstance(body["input"], str)
            else [
                {
                    "type": "text",
                    "text": "\n".join(
                        m["content"]
                        if isinstance(m["content"], str)
                        else "\n".join(
                            b["text"]
                            for b in m["content"]
                            if isinstance(b, dict) and isinstance(b.get("text"), str)
                        )
                        for m in body["input"]
                    ),
                }
            ]
        )
        await self._request(
            "POST",
            paths.resource(paths.MANAGED_SESSIONS, identifier, "/events"),
            {"events": [{"type": "user.message", "content": content}]},
        )
        return {
            "run_id": identifier,
            "status": "started",
            **({"model": session["model"]} if session.get("model") else {}),
        }

    async def get_run(self, run_id: str):
        async with asyncio.timeout(self.timeout):
            return await self._get_session_run(run_id)

    async def _get_session_run(self, run_id: str):
        raw = record(
            await self._request("GET", paths.resource(paths.MANAGED_SESSIONS, run_id))
        )
        state = raw.get("status") or "running"
        if not isinstance(state, str):
            raise failure("transport_protocol_error")
        if self.observe_run_completion:
            from .managed_lifecycle import observe

            if raw.get("id") != run_id:
                raise failure("transport_protocol_error")
            observed, output = observe(await self._all_events(run_id), self.max_response_bytes)
            status = "running" if state in ("running", "rescheduling") else observed if state == "idle" else "unknown"
            run = {"run_id": run_id, "status": status}
            for key in ("model", "usage"):
                if raw.get(key):
                    run[key] = raw[key]
            if status == "completed" and output is not None:
                run["output"] = output
            return run
        run = {
            "run_id": raw.get("id"),
            "status": {
                "rescheduling": "running",
                "idle": "completed",
                "terminated": "completed",
            }.get(state, state),
        }
        for key in ("model", "usage"):
            if raw.get(key):
                run[key] = raw[key]
        if run["status"] == "completed":
            output = await self._session_text(run_id)
            if output is not None:
                run["output"] = output
        return validate_run(run)

    async def _all_events(self, run_id):
        events, seen, page, size = [], set(), None, 0
        for _ in range(100):
            response = record(await self._request("GET", paths.managed_events_path(run_id, page, all_events=True)))
            data = response_array(response.get("data"))
            size += len(json.dumps(data).encode("utf-8"))
            if size > self.max_response_bytes * 4:
                raise failure("transport_protocol_error")
            events.extend(data)
            page = response.get("next_page")
            if page is None:
                return events
            if not isinstance(page, str) or not page.strip() or page in seen:
                raise failure("transport_protocol_error")
            seen.add(page)
        raise failure("transport_protocol_error")

    async def _session_text(self, run_id: str) -> str | None:
        parts, seen = [], set()
        page, size = None, 0
        for _ in range(100):
            raw = record(
                await self._request("GET", paths.managed_events_path(run_id, page))
            )
            for event in response_array(raw.get("data", [])):
                event = record(event)
                if event.get("type") != "agent.message":
                    continue
                for block in response_array(event.get("content")):
                    block = record(block)
                    if block.get("type") != "text":
                        continue
                    text = block.get("text")
                    if not isinstance(text, str):
                        raise failure("transport_protocol_error")
                    try:
                        size += len(text.encode("utf-8"))
                    except UnicodeError:
                        raise failure("transport_protocol_error") from None
                    if size > self.max_response_bytes:
                        raise failure("transport_protocol_error")
                    parts.append(text)
            page = raw.get("next_page")
            if page is None:
                return "".join(parts) if parts else None
            if not isinstance(page, str) or not page.strip() or page in seen:
                raise failure("transport_protocol_error")
            seen.add(page)
        raise failure("transport_protocol_error")

    async def cancel_run(self, run_id: str):
        await self._request(
            "POST",
            paths.resource(paths.MANAGED_SESSIONS, run_id, "/events"),
            {"events": [{"type": "user.interrupt"}]},
        )
        return {"status": "stopping" if self.observe_run_completion else "cancelled"}


def create_runtime_client(provider_kind: str, **options) -> NativeRuntimeClient:
    """Construct an explicit provider. Credentials and server addresses stay caller-owned."""
    clients = {
        "claude-sdk": ClaudeClient,
        "codex-responses": CodexClient,
        "agy": AgyClient,
        "hermes": HermesClient,
        "claude-managed-agents": ManagedAgentsClient,
    }
    if provider_kind == "opencode":
        version = options.pop("api_version", 1)
        if type(version) is not int:
            raise failure("invalid_config", "configuration")
        if version == 2:
            from .opencode_v2 import OpenCodeV2Client

            return OpenCodeV2Client(**options)
        if version != 1:
            raise failure("invalid_config", "configuration")
        from .opencode import OpenCodeClient

        return OpenCodeClient(**options)
    if provider_kind == "openclaw":
        from .openclaw import OpenClawClient

        return OpenClawClient(**options)
    if provider_kind not in clients:
        raise failure("invalid_config", "configuration")
    return clients[provider_kind](**options)
