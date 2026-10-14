"""OpenCode v2 HTTP polling lifecycle, independent of the optional Node bridge."""

from __future__ import annotations
import asyncio

from . import paths
from .errors import ApiClientError
from .native import failure, record
from .opencode import OpenCodeClient, prompt


class OpenCodeV2Client(OpenCodeClient):
    """Reuse authenticated HTTP and owned submission cleanup from the v1 client."""

    def __init__(self, *, workspace=None, **options):
        if workspace is not None:
            raise failure("invalid_config", "configuration")
        super().__init__(**options)

    def _session(self, value, expected=None):
        data = record(record(value).get("data"))
        identifier = data.get("id")
        if (
            not isinstance(identifier, str)
            or not identifier.startswith("ses_")
            or (expected is not None and identifier != expected)
            or record(data.get("location")).get("directory") != self.directory
        ):
            raise failure("transport_protocol_error")
        return data

    async def _cleanup(self, identifier):
        try:
            await self._request("POST", paths.opencode_v2_path(identifier, "interrupt"))
        except (ApiClientError, TimeoutError, asyncio.CancelledError):
            pass

    async def _start_run(self, body):
        payload = prompt(body, self.default_model)
        if payload.get("system"):
            raise failure("validation_failed", "validation")
        if body.get("dryRun"):
            return self._dry_run(body.get("model", self.default_model))
        create = {"location": {"directory": self.directory}}
        if "model" in payload:
            create["model"] = {
                "providerID": payload["model"]["providerID"],
                "id": payload["model"]["modelID"],
            }
        session = self._session(await self._request("POST", paths.OPENCODE_V2_SESSIONS, create))
        identifier = session["id"]
        try:
            accepted = record(record(await self._request(
                "POST", paths.opencode_v2_path(identifier, "prompt"),
                {"text": body["input"], "resume": True},
            )).get("data"))
            if accepted.get("sessionID") != identifier or accepted.get("type") != "user" or not isinstance(accepted.get("id"), str):
                raise failure("transport_protocol_error")
            return {"run_id": identifier, "status": "started"}
        except BaseException:
            task = asyncio.create_task(self._cleanup(identifier))
            self._cleanup_tasks.add(task)
            task.add_done_callback(self._cleanup_tasks.discard)
            raise

    async def get_run(self, run_id):
        self._check_accepting()
        async with asyncio.timeout(self.timeout):
            return await self._get_run(run_id)

    async def _get_run(self, run_id):
        try:
            data = self._session(await self._request("GET", paths.opencode_v2_path(run_id)), run_id)
        except ApiClientError as error:
            if error.status == 404:
                return {"run_id": run_id, "status": "unknown"}
            raise
        outcome = data.get("outcome")
        states = {"succeeded": "completed", "failed": "failed", "interrupted": "cancelled", None: "running"}
        if not isinstance(outcome, (str, type(None))) or outcome not in states:
            raise failure("transport_protocol_error")
        run = {"run_id": run_id, "status": states[outcome]}
        if run["status"] != "completed":
            if run["status"] == "failed":
                run["error"] = "OpenCode run failed"
            return run
        cursor, seen, size = None, set(), 0
        for _ in range(100):
            response = record(await self._request("GET", paths.opencode_v2_path(run_id, "message", cursor)))
            if not isinstance(response.get("data"), list):
                raise failure("transport_protocol_error")
            for message in response["data"]:
                message = record(message)
                if message.get("type") != "assistant":
                    continue
                if not isinstance(message.get("content"), list):
                    raise failure("transport_protocol_error")
                text = ""
                for content in message["content"]:
                    content = record(content)
                    if content.get("type") == "text":
                        if not isinstance(content.get("text"), str):
                            raise failure("transport_protocol_error")
                        try:
                            size += len(content["text"].encode("utf-8"))
                        except UnicodeError:
                            raise failure("transport_protocol_error") from None
                        if size > self.max_response_bytes:
                            raise failure("transport_protocol_error")
                        text += content["text"]
                run["output"] = text
            cursor = record(response.get("cursor")).get("next")
            if cursor is None:
                return run
            if not isinstance(cursor, str) or not cursor or cursor in seen:
                raise failure("transport_protocol_error")
            seen.add(cursor)
        raise failure("transport_protocol_error")

    async def cancel_run(self, run_id):
        self._check_accepting()
        response = record(await self._request("POST", paths.opencode_v2_path(run_id, "interrupt")))
        if type(response.get("interrupted")) is not bool:
            raise failure("transport_protocol_error")
        return {"status": "cancelled" if response["interrupted"] else "unknown"}
