"""Ordered primary-thread observations for Managed Agents polling."""

from .native import failure, record


def observe(events, max_output_bytes):
    status, output, size = "unknown", None, 0
    interrupted, workflows, seen = False, set(), set()
    for event in events:
        event = record(event)
        if event.get("session_thread_id"):
            continue
        identifier = event.get("id")
        if isinstance(identifier, str):
            if identifier in seen:
                continue
            seen.add(identifier)
        kind = event.get("type")
        if kind in ("user.message", "user.define_outcome"):
            interrupted, status, output, size = False, "running", None, 0
        elif kind == "user.interrupt":
            interrupted, status = True, "paused"
        elif kind in ("workflow_run.created", "workflow_run.status_running", "workflow_run.status_idle", "workflow_run.status_ended"):
            workflow = event.get("workflow_run_id")
            if not isinstance(workflow, str) or not workflow:
                raise failure("transport_protocol_error")
            if kind == "workflow_run.status_ended":
                workflows.discard(workflow)
            else:
                workflows.add(workflow)
            status = "running"
        elif kind in ("session.status_running", "status_running", "session.status_rescheduled", "status_rescheduled"):
            status = "running"
        elif kind in ("session.status_idle", "status_idle"):
            reason = event.get("stop_reason")
            reason = record(reason) if reason is not None else {}
            status = ("running" if workflows else "completed") if reason.get("type") == "end_turn" and not interrupted else "paused"
        elif kind in ("session.status_terminated", "status_terminated"):
            status = "unknown"
        elif kind == "agent.message":
            content = event.get("content")
            if not isinstance(content, list):
                raise failure("transport_protocol_error")
            for block in content:
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
                if size > max_output_bytes:
                    raise failure("transport_protocol_error")
                output = (output or "") + text
    return status, output
