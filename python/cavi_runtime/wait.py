"""Bounded local observation of a run; submission and cancellation stay caller-owned."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
import math
from typing import Any, Literal, Protocol, TypedDict


_RunWaitReason = Literal["terminal", "state-not-pollable", "poll-limit", "timeout", "aborted"]


class RunWaitResult(TypedDict):
    reason: _RunWaitReason
    run: Mapping[str, Any]
    polls: int


class _RunClient(Protocol):
    async def get_run(self, run_id: str) -> dict[str, Any]: ...


# A local timeout must not cancel an application-owned transport exchange.
# Retain the observation until its provider deadline/close settles it, and
# consume late exceptions even after the waiting caller has left.
_observations: set[asyncio.Task[Any]] = set()


def _observed(task: asyncio.Task[Any]) -> None:
    _observations.discard(task)
    if not task.cancelled():
        task.exception()


def _budget(value: Any) -> bool:
    if type(value) not in (int, float) or value < 0:
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _stop(status: str) -> Literal["terminal", "state-not-pollable"] | None:
    if status in ("completed", "failed", "cancelled"):
        return "terminal"
    if status not in ("started", "running", "stopping"):
        return "state-not-pollable"
    return None


async def wait_for_run(
    client: _RunClient,
    initial_run: Mapping[str, Any],
    *,
    max_polls: int = 60,
    poll_interval: float = 1.0,
    max_wait: float = 60.0,
    cancel_event: asyncio.Event | None = None,
) -> RunWaitResult:
    """Wait on an existing run, using second-based delay/deadline budgets.

    The deadline includes delays and in-flight retrievals. An event abort returns
    the last observation; task cancellation propagates CancelledError. Neither
    cancels backend work, an in-flight get_run, or the client. Provider errors
    propagate unchanged. Keep the client open until its transport work settles.
    """
    if (type(max_polls) is not int or max_polls < 0
            or not _budget(poll_interval) or not _budget(max_wait)
            or (cancel_event is not None and not isinstance(cancel_event, asyncio.Event))):
        raise ValueError("Use a non-negative integer poll count and finite non-negative second budgets")
    if (not isinstance(initial_run, Mapping)
            or not isinstance(initial_run.get("run_id"), str) or not initial_run["run_id"]
            or not isinstance(initial_run.get("status"), str) or not initial_run["status"]):
        raise ValueError("initial_run must contain a run_id and status")
    run, polls = initial_run, 0

    def result(reason: _RunWaitReason) -> RunWaitResult:
        return {"reason": reason, "run": run, "polls": polls}

    reason = _stop(run["status"])
    if reason:
        return result(reason)
    if cancel_event is not None and cancel_event.is_set():
        return result("aborted")
    if max_polls == 0:
        return result("poll-limit")
    if max_wait == 0:
        return result("timeout")

    loop = asyncio.get_running_loop()
    deadline = loop.time() + max_wait
    cancelled = asyncio.create_task(cancel_event.wait()) if cancel_event is not None else None
    try:
        while True:
            if cancel_event is not None and cancel_event.is_set():
                return result("aborted")
            remaining = deadline - loop.time()
            if remaining <= 0:
                return result("timeout")
            delay = min(poll_interval, remaining)
            if cancelled is None:
                await asyncio.sleep(delay)
            else:
                await asyncio.wait({cancelled}, timeout=delay)
            if cancel_event is not None and cancel_event.is_set():
                return result("aborted")
            remaining = deadline - loop.time()
            if remaining <= 0:
                return result("timeout")
            polls += 1
            request = asyncio.create_task(client.get_run(initial_run["run_id"]))
            _observations.add(request)
            request.add_done_callback(_observed)
            waiting: set[asyncio.Task[Any]] = {request}
            if cancelled is not None:
                waiting.add(cancelled)
            done, _ = await asyncio.wait(waiting, timeout=remaining, return_when=asyncio.FIRST_COMPLETED)
            if cancel_event is not None and cancel_event.is_set():
                return result("aborted")
            if request not in done:
                return result("timeout")
            observation = await request
            if (not isinstance(observation, Mapping) or observation.get("run_id") != initial_run["run_id"]
                    or not isinstance(observation.get("status"), str) or not observation["status"]):
                from .errors import ApiClientError

                raise ApiClientError({"message": "Invalid run observation", "code": "transport_protocol_error", "type": "transport"})
            run = observation
            reason = _stop(run["status"])
            if reason:
                return result(reason)
            if polls >= max_polls:
                return result("poll-limit")
    finally:
        if cancelled is not None:
            cancelled.cancel()
            await asyncio.gather(cancelled, return_exceptions=True)
