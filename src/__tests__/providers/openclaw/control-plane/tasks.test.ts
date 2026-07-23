import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../../core/errors.js";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";
import { createOpenClawTaskClient } from "../../../../providers/openclaw/control-plane/tasks.js";
import { ApiClientErrorCode } from "../../../../core/errors.js";

function createRpc(responses: Record<string, unknown>): OpenClawRpc {
  return {
    request: vi.fn(async (method: string) => responses[method]),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw task control plane", () => {
  it("lists once, forwards query exactly, and preserves the upstream cursor byte-for-byte", async () => {
    const nextCursor = "opaque/+== cursor";
    const rpc = createRpc({
      "tasks.list": {
        tasks: [{ id: "task-1", status: "running", createdAt: 1_760_000_000_000, runId: "run-1", sessionKey: "session-1" }],
        nextCursor,
      },
    });

    const result = await createOpenClawTaskClient(rpc).listTasks({ cursor: "before", limit: 7 });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("tasks.list", { cursor: "before", limit: 7 }, { signal: undefined });
    expect(result.nextCursor).toBe(nextCursor);
    expect(result.data).toEqual([expect.objectContaining({
      id: "task-1",
      state: "running",
      runId: "run-1",
      sessionId: "session-1",
      cancellable: true,
    })]);
  });

  it.each([
    ["queued", "pending"],
    ["running", "running"],
    ["completed", "completed"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
    ["timed_out", "failed"],
  ] as const)("maps closed upstream state %s to %s", async (status, state) => {
    const rpc = createRpc({ "tasks.get": { task: { id: "task-1", status } } });

    const result = await createOpenClawTaskClient(rpc).getTask("task-1");

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("tasks.get", { taskId: "task-1" }, { signal: undefined });
    expect(result.state).toBe(state);
  });

  it("cancels once, forwards reason once, and preserves found separately from cancelled", async () => {
    const rpc = createRpc({
      "tasks.cancel": {
        found: true,
        cancelled: false,
        reason: "already completed",
        task: { id: "task-1", status: "completed" },
      },
    });

    const result = await createOpenClawTaskClient(rpc).cancelTask("task-1", { reason: "operator request" });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("tasks.cancel", { taskId: "task-1", reason: "operator request" }, { signal: undefined });
    expect(result.state).toBe("completed");
    expect(result.metadata.providerData).toMatchObject({ found: true, cancelled: false, reason: "already completed" });
    expect(JSON.stringify(result).match(/already completed/gu)).toHaveLength(1);
  });

  it("preserves an absent cancel reason and task without claiming cancellation", async () => {
    const rpc = createRpc({ "tasks.cancel": { found: false, cancelled: false } });

    const result = await createOpenClawTaskClient(rpc).cancelTask("missing");

    expect(result).toMatchObject({ id: "missing", state: "unknown" });
    expect(result.metadata.providerData).toEqual({ found: false, cancelled: false });
    expect(result.metadata.providerData).not.toHaveProperty("reason");
  });

  it("tolerates benign unknown fields but rejects unsafe ones, and never retries", async () => {
    // A benign unknown field (`cwd`) is tolerated — a live gateway grows the
    // payload over time; a read client must not hard-fail. One request, no retry.
    const ok = createRpc({ "tasks.list": { tasks: [{ id: "task-1", status: "running", cwd: "/work" }] } });
    await expect(createOpenClawTaskClient(ok).listTasks()).resolves.toMatchObject({ data: [{ id: "task-1" }] });
    expect(ok.request).toHaveBeenCalledTimes(1);

    // An unsafe field (a sensitive key) is still rejected, and still no retry.
    const unsafe = createRpc({ "tasks.list": { tasks: [{ id: "task-1", status: "running", authorization: "secret" }] } });
    await expect(createOpenClawTaskClient(unsafe).listTasks()).rejects.toMatchObject({ code: ApiClientErrorCode.TransportProtocolError });
    expect(unsafe.request).toHaveBeenCalledTimes(1);
  });

  it("translates request failures without retry", async () => {
    const rpc = createRpc({});
    vi.mocked(rpc.request).mockRejectedValueOnce("task not found");

    await expect(createOpenClawTaskClient(rpc).getTask("missing")).rejects.toBeInstanceOf(ApiClientError);
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("is wired by the internal factory without capability promotion", async () => {
    const rpc = createRpc({ "tasks.get": { task: { id: "task-1", status: "running" } } });
    const plane = await createOpenClawRuntimeControlClient({ rpc });

    await expect(plane.tasks.getTask("task-1")).resolves.toMatchObject({ id: "task-1" });
  });
});
