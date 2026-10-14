"""OpenCode 1.18.27 scoped HTTP lifecycle."""

from __future__ import annotations
import asyncio
import base64
import re

from . import paths
from .native import (
    HttpRuntimeClient,
    add_usage,
    failure,
    numeric,
    record,
    required,
    validate_body,
)
from .errors import ApiClientError


def prompt(body, default_model):
    validate_body(body)
    if (
        not isinstance(body["input"], str)
        or not body["input"].strip()
        or body.get("tools")
        or body.get("metadata")
    ):
        raise failure("validation_failed", "validation")
    payload = {"parts": [{"type": "text", "text": body["input"]}]}
    if body.get("instructions", "").strip():
        payload["system"] = body["instructions"]
    model = body.get("model", default_model)
    if model is not None:
        model = required(model, "model")
        provider, separator, identifier = model.partition("/")
        if not separator or not provider.strip() or not identifier.strip():
            raise failure("validation_failed", "validation")
        payload["model"] = {"providerID": provider, "modelID": identifier}
    return payload


def parse_session(value, directory, expected=None):
    value = record(value)
    identifier = value.get("id")
    if (
        not isinstance(identifier, str)
        or not identifier.startswith("ses_")
        or value.get("directory") != directory
        or value.get("version") != paths.OPENCODE_VERSION
        or (expected is not None and identifier != expected)
    ):
        raise failure("transport_protocol_error")
    return identifier


def read_parts(parts):
    if not isinstance(parts, list):
        raise failure("transport_protocol_error")
    output = ""
    recognized = {
        "reasoning",
        "tool",
        "step-start",
        "step-finish",
        "snapshot",
        "patch",
        "agent",
        "subtask",
        "compaction",
        "retry",
        "file",
    }
    for part in parts:
        part = record(part)
        if part.get("type") == "text":
            if not isinstance(part.get("text"), str):
                raise failure("transport_protocol_error")
            output += part["text"]
        elif part.get("type") not in recognized:
            raise failure("transport_protocol_error")
    return output


def parse_message(value, identifier):
    value = record(value)
    info = record(value.get("info"))
    if (
        info.get("role") != "assistant"
        or info.get("sessionID") != identifier
        or not isinstance(info.get("id"), str)
        or not info["id"].strip()
    ):
        raise failure("transport_protocol_error")
    for key in ("providerID", "modelID"):
        if not isinstance(info.get(key), str) or not info[key].strip():
            raise failure("transport_protocol_error")
    output = read_parts(value.get("parts"))
    run = {
        "run_id": identifier,
        "status": "failed" if info.get("error") is not None else "completed",
        "model": info["providerID"] + "/" + info["modelID"],
        "output": output,
    }
    if run["status"] == "failed":
        run["error"] = "OpenCode run failed"
    usage = {}
    if "tokens" in info:
        tokens = record(info["tokens"])
        for source, target in (
            ("input", "input_tokens"),
            ("output", "output_tokens"),
            ("reasoning", "reasoning_tokens"),
        ):
            if source in tokens:
                if not numeric(tokens[source]):
                    raise failure("transport_protocol_error")
                usage[target] = tokens[source]
        if "cache" in tokens:
            cache = record(tokens["cache"])
            for source, target in (
                ("read", "cache_read_input_tokens"),
                ("write", "cache_creation_input_tokens"),
            ):
                if source in cache:
                    if not numeric(cache[source]):
                        raise failure("transport_protocol_error")
                    usage[target] = cache[source]
    return add_usage(run, usage)


class OpenCodeClient(HttpRuntimeClient):
    provider_kind = "opencode"

    def __init__(
        self,
        *,
        base_url,
        directory,
        workspace=None,
        username="opencode",
        password=None,
        api_key=None,
        default_model=None,
        **options,
    ):
        required(directory, "directory")
        if not (
            directory.strip().startswith("/")
            or re.match(r"^[A-Za-z]:[\\/]", directory.strip())
            or re.match(r"^\\\\[^\\/]+[\\/][^\\/]+", directory.strip())
        ):
            raise failure("invalid_config", "configuration")
        if workspace is not None:
            required(workspace, "workspace")
        self.directory, self.workspace, self.default_model = (
            directory,
            workspace,
            default_model,
        )
        headers = {}
        if password is not None:
            headers["Authorization"] = (
                "Basic "
                + base64.b64encode((username + ":" + password).encode()).decode()
            )
        super().__init__(base_url=base_url, headers=headers, **options)
        self._healthy = False
        self._health_lock = asyncio.Lock()
        self._cleanup_tasks = set()

    async def _health(self):
        async with self._health_lock:
            if not self._healthy:
                raw = record(await self._request("GET", paths.OPENCODE_HEALTH))
                if (
                    set(raw) != {"healthy", "version"}
                    or raw["healthy"] is not True
                    or raw["version"] != paths.OPENCODE_VERSION
                ):
                    raise failure("transport_protocol_error")
                self._healthy = True

    def _route(self, identifier=None, suffix=""):
        return paths.opencode_path(self.directory, self.workspace, identifier, suffix)

    async def _cleanup(self, identifier):
        try:
            await self._request("POST", self._route(identifier, "/abort"))
        except (ApiClientError, TimeoutError, asyncio.CancelledError):
            pass

    async def close(self):
        if self._cleanup_tasks:
            await asyncio.gather(*self._cleanup_tasks, return_exceptions=True)
        await super().close()

    async def start_run(self, body):
        self._check_open()
        payload = prompt(body, self.default_model)
        if body.get("dryRun"):
            model = payload.get("model")
            return self._dry_run(
                model["providerID"] + "/" + model["modelID"] if model else None
            )
        await self._health()
        identifier = parse_session(
            await self._request("POST", self._route(), {}), self.directory
        )
        try:
            return self._remember(
                parse_message(
                    await self._request(
                        "POST", self._route(identifier, "/message"), payload
                    ),
                    identifier,
                )
            )
        except BaseException:
            task = asyncio.create_task(self._cleanup(identifier))
            self._cleanup_tasks.add(task)
            task.add_done_callback(self._cleanup_tasks.discard)
            raise

    async def get_run(self, run_id):
        self._check_open()
        route = self._route(run_id)
        if run_id in self._runs:
            from copy import deepcopy

            return deepcopy(self._runs[run_id])
        await self._health()
        try:
            parse_session(await self._request("GET", route), self.directory, run_id)
        except ApiClientError as error:
            if error.status == 404:
                return {
                    "run_id": run_id,
                    "status": "unknown",
                    "error": "OpenCode session not found",
                }
            raise
        statuses = record(await self._request("GET", self._route(suffix="/status")))
        status = statuses.get(run_id)
        if status is not None:
            status = record(status)
            kind = status.get("type")
            if kind in ("busy", "idle"):
                if set(status) != {"type"}:
                    raise failure("transport_protocol_error")
            elif kind == "retry":
                if (
                    set(status) != {"type", "attempt", "message", "next"}
                    or not numeric(status["attempt"])
                    or not numeric(status["next"])
                    or not isinstance(status["message"], str)
                    or not status["message"].strip()
                ):
                    raise failure("transport_protocol_error")
            else:
                raise failure("transport_protocol_error")
            if kind in ("busy", "retry"):
                return {"run_id": run_id, "status": "running"}
        history = await self._request("GET", self._route(run_id, "/message"))
        if not isinstance(history, list):
            raise failure("transport_protocol_error")
        latest, created = None, float("-inf")
        for entry in history:
            entry = record(entry)
            if set(entry) != {"info", "parts"}:
                raise failure("transport_protocol_error")
            info = record(entry["info"])
            read_parts(entry["parts"])
            if (
                info.get("sessionID") != run_id
                or info.get("role") not in ("assistant", "user")
                or not isinstance(entry["parts"], list)
            ):
                raise failure("transport_protocol_error")
            time = record(info["time"]) if "time" in info else {}
            for key in ("created", "completed"):
                if key in time and not numeric(time[key]):
                    raise failure("transport_protocol_error")
            if (
                info["role"] == "assistant"
                and numeric(time.get("created"))
                and time["created"] >= created
            ):
                latest, created = entry, time["created"]
        if latest is None or (
            latest["info"].get("error") is None
            and not numeric(latest["info"].get("time", {}).get("completed"))
        ):
            return {
                "run_id": run_id,
                "status": "unknown",
                "error": "OpenCode has no terminal assistant message",
            }
        return self._remember(parse_message(latest, run_id))

    async def cancel_run(self, run_id):
        route = self._route(run_id, "/abort")
        await self._health()
        raw = await self._request("POST", route)
        if raw is True:
            self._remember({"run_id": run_id, "status": "cancelled"})
            return {"status": "cancelled"}
        if raw is not False:
            raise failure("transport_protocol_error")
        return {"status": self._runs.get(run_id, {}).get("status", "unknown")}
