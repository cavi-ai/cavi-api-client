"""Bounded local polling without cancelling application-owned retrievals."""

import asyncio
import unittest
from unittest.mock import AsyncMock

from cavi_runtime import ApiClientError, wait_for_run


class RunWaiting(unittest.IsolatedAsyncioTestCase):
    async def test_terminal_and_unpollable_states_start_no_requests(self):
        for state, reason in [("completed", "terminal"), ("failed", "terminal"), ("cancelled", "terminal"), ("paused", "state-not-pollable"), ("future", "state-not-pollable")]:
            client = type("Client", (), {"get_run": AsyncMock()})()
            run = {"run_id": "r", "status": state}
            result = await wait_for_run(client, run, poll_interval=0)
            self.assertEqual(result, {"reason": reason, "run": run, "polls": 0})
            client.get_run.assert_not_called()

    async def test_retrieves_until_observed_completion(self):
        client = type("Client", (), {"get_run": AsyncMock(side_effect=[
            {"run_id": "r", "status": "running"},
            {"run_id": "r", "status": "completed", "output": " exact "},
        ])})()
        result = await wait_for_run(client, {"run_id": "r", "status": "started"}, poll_interval=0)
        self.assertEqual(result, {"reason": "terminal", "run": {"run_id": "r", "status": "completed", "output": " exact "}, "polls": 2})
        self.assertEqual(client.get_run.await_count, 2)

    async def test_poll_and_pause_budgets_retain_last_observation(self):
        client = type("Client", (), {"get_run": AsyncMock(return_value={"run_id": "r", "status": "running", "output": "partial"})})()
        initial = {"run_id": "r", "status": "started"}
        result = await wait_for_run(client, initial, max_polls=2, poll_interval=0)
        self.assertEqual(result["reason"], "poll-limit")
        self.assertEqual(result["run"]["output"], "partial")
        self.assertEqual(result["polls"], 2)
        result = await wait_for_run(client, initial, poll_interval=1, max_wait=0.01)
        self.assertEqual(result, {"reason": "timeout", "run": initial, "polls": 0})

    async def test_timeout_does_not_cancel_pending_retrieval(self):
        future = asyncio.get_running_loop().create_future()
        class Client:
            async def get_run(self, _):
                return await future
        initial = {"run_id": "r", "status": "started"}
        result = await wait_for_run(Client(), initial, poll_interval=0, max_wait=0.01)
        self.assertEqual(result, {"reason": "timeout", "run": initial, "polls": 1})
        self.assertFalse(future.cancelled())
        future.set_result({"run_id": "r", "status": "completed"})
        await asyncio.sleep(0)

    async def test_local_event_abort_does_not_cancel_pending_retrieval(self):
        future = asyncio.get_running_loop().create_future()
        started = asyncio.Event()
        cancel_event = asyncio.Event()
        class Client:
            async def get_run(self, _):
                started.set()
                return await future
        initial = {"run_id": "r", "status": "started"}
        task = asyncio.create_task(wait_for_run(Client(), initial, poll_interval=0, cancel_event=cancel_event))
        await started.wait()
        cancel_event.set()
        try:
            self.assertEqual(await asyncio.wait_for(task, 0.1), {"reason": "aborted", "run": initial, "polls": 1})
            self.assertFalse(future.cancelled())
        finally:
            if not future.done():
                future.set_result({"run_id": "r", "status": "completed"})
            await asyncio.sleep(0)

    async def test_task_cancellation_preserves_the_in_flight_request(self):
        future = asyncio.get_running_loop().create_future()
        started = asyncio.Event()
        class Client:
            async def get_run(self, _):
                started.set()
                return await future
        task = asyncio.create_task(wait_for_run(Client(), {"run_id": "r", "status": "running"}, poll_interval=0))
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertFalse(future.cancelled())
        future.set_result({"run_id": "r", "status": "completed"})
        await asyncio.sleep(0)

    async def test_preserves_provider_errors_and_rejects_wrong_run_ids(self):
        error = ApiClientError({"message": "Unauthorized", "code": "unauthorized", "type": "http", "status": 401})
        client = type("Client", (), {"get_run": AsyncMock(side_effect=error)})()
        with self.assertRaises(ApiClientError) as caught:
            await wait_for_run(client, {"run_id": "r", "status": "running"}, poll_interval=0)
        self.assertIs(caught.exception, error)
        client.get_run = AsyncMock(return_value={"run_id": "other", "status": "completed"})
        with self.assertRaises(ApiClientError) as caught:
            await wait_for_run(client, {"run_id": "r", "status": "running"}, poll_interval=0)
        self.assertEqual(caught.exception.code, "transport_protocol_error")

    async def test_validates_budgets_and_honors_pre_cancelled_events(self):
        client = type("Client", (), {"get_run": AsyncMock()})()
        initial = {"run_id": "r", "status": "started"}
        for options in [{"max_polls": True}, {"max_polls": -1}, {"poll_interval": float("nan")}, {"max_wait": -1}, {"max_wait": float("inf")}]:
            with self.assertRaises(ValueError):
                await wait_for_run(client, initial, **options)
        event = asyncio.Event()
        event.set()
        self.assertEqual((await wait_for_run(client, initial, cancel_event=event))["reason"], "aborted")
        client.get_run.assert_not_called()

    async def test_completion_does_not_wait_for_an_unset_cancel_event(self):
        client = type("Client", (), {"get_run": AsyncMock(return_value={"run_id": "r", "status": "completed"})})()
        result = await asyncio.wait_for(wait_for_run(
            client, {"run_id": "r", "status": "running"}, poll_interval=0, cancel_event=asyncio.Event(),
        ), 0.1)
        self.assertEqual(result["reason"], "terminal")

    async def test_late_provider_errors_are_consumed_after_timeout(self):
        loop = asyncio.get_running_loop()
        errors = []
        handler = loop.get_exception_handler()
        loop.set_exception_handler(lambda _loop, context: errors.append(context))
        future = loop.create_future()
        class Client:
            async def get_run(self, _):
                return await future
        try:
            result = await wait_for_run(Client(), {"run_id": "r", "status": "started"}, poll_interval=0, max_wait=0.01)
            self.assertEqual(result["reason"], "timeout")
            future.set_exception(RuntimeError("late failure"))
            for _ in range(3):
                await asyncio.sleep(0)
            self.assertEqual(errors, [])
        finally:
            loop.set_exception_handler(handler)
