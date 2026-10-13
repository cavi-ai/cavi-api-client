"""Versioned JSON Lines lifecycle client; requires Python 3.11+ and Node 20+."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping, Sequence
import json
import math
from typing import Any

from ._process import BridgeProcess, spawn_bridge

_VERSION = 1
_MAX_FRAME_BYTES = 1_048_576


class BridgeError(Exception):
    """The local bridge is unavailable or violated its protocol."""


class ApiClientError(Exception):
    """Structured runtime failure, without provider messages or raw causes."""

    def __init__(self, error: dict[str, Any]):
        super().__init__(error["message"])
        self.code: str = error["code"]
        self.type: str = error["type"]
        self.status: int | float | None = error.get("status")


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key")
        result[key] = value
    return result


def _invalid_constant(value: str) -> Any:
    raise ValueError("Non-finite JSON number")


def _finite_number(value: Any) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


class RuntimeClient:
    """Own one persistent subprocess. Calls serialize; failures never retry.

    A deadline starts after acquiring the call lock. Timeout, active-call task
    cancellation, EOF, and protocol corruption close and reap the child. They
    do not cancel backend runs; preserve run IDs for reconciliation. Cancellation
    while queued leaves the active call and subprocess alone.
    """

    def __init__(self, process: BridgeProcess, timeout: float):
        self._process = process
        self._timeout = timeout
        self._lock = asyncio.Lock()
        self._next_id = 0
        self._closing = False
        self._close_task: asyncio.Task[None] | None = None
        self._exchange_task: asyncio.Task[Any] | None = None
        self._operations: tuple[str, ...] = ()
        self._capabilities: dict[str, Any] = {}

    @classmethod
    async def connect(
        cls, command: Sequence[str], *, timeout: float = 30.0,
        env: Mapping[str, str] | None = None, cwd: str | None = None,
    ) -> RuntimeClient:
        """Start an explicit executable/argument vector and validate its handshake.

        Credentials belong in the factory's inherited environment, not command
        arguments. stderr is discarded to avoid leaking arbitrary diagnostics.
        """
        if isinstance(command, (str, bytes)) or not command or any(not isinstance(arg, str) or not arg for arg in command):
            raise ValueError("command must be a non-empty sequence of strings")
        if not _finite_number(timeout) or timeout <= 0:
            raise ValueError("timeout must be finite and positive")
        process = await spawn_bridge(tuple(command), env=env, cwd=cwd, limit=_MAX_FRAME_BYTES + 1)
        client = cls(process, timeout)
        try:
            info = await client._request("describe")
            if (not isinstance(info, dict) or type(info.get("protocolVersion")) is not int
                or info["protocolVersion"] != _VERSION or type(info.get("maxFrameBytes")) is not int
                or info["maxFrameBytes"] != _MAX_FRAME_BYTES
                or not isinstance(info.get("operations"), list)
                or any(not isinstance(op, str) for op in info["operations"])
                or len(set(info["operations"])) != len(info["operations"])
                or not {"startRun", "getRuntimeCapabilities", "requireCompletedRun", "requireRunText"}.issubset(info["operations"])
                or not isinstance(info.get("capabilities"), dict)):
                raise BridgeError("Invalid runtime bridge handshake")
            client._operations = tuple(info["operations"])
            client._capabilities = info["capabilities"]
            return client
        except BaseException:
            await client.close()
            raise

    @property
    def capabilities(self) -> dict[str, Any]:
        """Backend capabilities; may include surfaces this bridge does not expose."""
        return json.loads(json.dumps(self._capabilities))

    @property
    def operations(self) -> tuple[str, ...]:
        return self._operations

    @property
    def closed(self) -> bool:
        return self._closing or self._process.returncode is not None

    async def _exchange(self, frame: bytes, request_id: int) -> Any:
        await self._process.write(frame)
        line = await self._process.readline()
        if not line.endswith(b"\n") or len(line) - 1 > _MAX_FRAME_BYTES:
            raise BridgeError("Invalid runtime bridge response framing")
        try:
            reply = json.loads(line.decode("utf-8"), object_pairs_hook=_unique_object, parse_constant=_invalid_constant)
        except (ValueError, UnicodeError, RecursionError):
            raise BridgeError("Invalid runtime bridge response JSON") from None
        if (not isinstance(reply, dict) or type(reply.get("v")) is not int or reply["v"] != _VERSION
            or type(reply.get("id")) is not int or reply["id"] != request_id or type(reply.get("ok")) is not bool):
            raise BridgeError("Invalid runtime bridge response envelope")
        if reply["ok"]:
            if "result" not in reply or "error" in reply:
                raise BridgeError("Invalid runtime bridge success response")
            return reply["result"]
        error = reply.get("error")
        if ("result" in reply or not isinstance(error, dict)
            or any(not isinstance(error.get(key), str) for key in ("message", "type", "code"))
            or ("status" in error and not _finite_number(error["status"]))):
            raise BridgeError("Invalid runtime bridge error response")
        raise ApiClientError(error)

    async def _request(self, method: str, params: Any = None) -> Any:
        async with self._lock:
            if self.closed:
                raise BridgeError("Runtime bridge is closed")
            if method != "describe" and method not in self._operations:
                raise ApiClientError({"message": "Runtime operation unavailable", "type": "unknown", "code": "endpoint_not_found"})
            self._next_id += 1
            if self._next_id > 9_007_199_254_740_991:
                await self.close()
                raise BridgeError("Runtime bridge request ID exhausted")
            try:
                frame = json.dumps({"v": _VERSION, "id": self._next_id, "method": method, "params": params},
                                   ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
            except (TypeError, ValueError, UnicodeError, RecursionError):
                raise ValueError("Request must contain finite UTF-8 JSON values") from None
            if len(frame) > _MAX_FRAME_BYTES:
                raise ValueError("Request exceeds runtime bridge frame limit")
            exchange = asyncio.create_task(self._exchange(frame + b"\n", self._next_id))
            self._exchange_task = exchange
            try:
                return await asyncio.wait_for(exchange, self._timeout)
            except ApiClientError:
                raise
            except TimeoutError:
                await self.close()
                raise
            except asyncio.CancelledError:
                await self.close()
                current = asyncio.current_task()
                if current is not None and current.cancelling():
                    raise
                raise BridgeError("Runtime bridge is closed") from None
            except (BridgeError, OSError, ValueError) as error:
                await self.close()
                if isinstance(error, BridgeError):
                    raise
                raise BridgeError("Runtime bridge connection failed") from None
            finally:
                self._exchange_task = None

    async def get_runtime_capabilities(self) -> dict[str, Any]:
        return await self._request("getRuntimeCapabilities")

    async def start_run(self, body: Mapping[str, Any]) -> dict[str, Any]:
        return await self._request("startRun", dict(body))

    async def get_run(self, run_id: str) -> dict[str, Any]:
        return await self._request("getRun", run_id)

    async def cancel_run(self, run_id: str) -> dict[str, Any]:
        return await self._request("cancelRun", run_id)

    async def require_completed_run(self, run: Mapping[str, Any]) -> dict[str, Any]:
        return await self._request("requireCompletedRun", dict(run))

    async def require_run_text(self, run: Mapping[str, Any]) -> str:
        return await self._request("requireRunText", dict(run))

    async def _reap(self) -> None:
        # Stop the owned reader before draining; never compete for stdout reads.
        exchange = self._exchange_task
        if exchange is not None and not exchange.done():
            exchange.cancel()
            await asyncio.gather(exchange, return_exceptions=True)
        self._process.end_input()
        try:
            try:
                await asyncio.wait_for(self._process.wait(), 0.5)
            except TimeoutError:
                if self._process.returncode is None:
                    try:
                        self._process.kill()
                    except ProcessLookupError:
                        pass
                try:
                    await asyncio.wait_for(self._process.wait(), 1.0)
                except TimeoutError:
                    raise BridgeError("Runtime bridge child did not exit") from None
        finally:
            self._process.close_transport()

    async def close(self) -> None:
        """Close and reap the owned child. Never cancel backend work."""
        if self._close_task is None:
            self._closing = True
            self._close_task = asyncio.create_task(self._reap())
        cancelled = False
        while True:
            try:
                await asyncio.shield(self._close_task)
                break
            except asyncio.CancelledError:
                if self._close_task.cancelled():
                    raise
                cancelled = True
        if cancelled:
            raise asyncio.CancelledError

    async def __aenter__(self) -> RuntimeClient:
        if self.closed:
            raise BridgeError("Runtime bridge is closed")
        return self

    async def __aexit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        await self.close()
