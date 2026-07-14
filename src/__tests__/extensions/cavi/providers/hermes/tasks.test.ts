import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { CaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { createHermesCaviTaskClient } from "../../../../../extensions/cavi/providers/hermes/tasks.js";
import type { OperatorControlSnapshot } from "../../../../../extensions/cavi/domain/operator.js";

function adaptersWithTasks(createdAt = 1_752_508_800_000, transport: "websocket" | "http" = "websocket"): { adapters: CaviControlAdapters; loadOperatorControl: ReturnType<typeof vi.fn> } {
  const tasks = [{
    envelope: {
      task_id: "operator/task-1",
      requester: { id: "operator", kind: "agent" },
      target: { capability: "engineering", team_id: "eng" },
      objective: "Ship the bounded change",
      tier: "STANDARD" as const,
      acceptance_criteria: ["tests pass"],
      timeout_s: 600,
    },
    receipt: {
      task_id: "operator/task-1", run_id: "run-1", state: "started" as const,
      attempt: 1, created_at: createdAt, updated_at: 1_752_508_860_000,
      artifacts: [],
    },
    events: [], validation: null, outcome: null,
  }];
  const loadOperatorControl = vi.fn(async () => ({
    data: { tasks: { tasks, summary: { accepted: 0, queued: 0, started: 1, retrying: 0, blocked: 0, completed: 0, "dead-letter": 0 } } } as unknown as OperatorControlSnapshot,
    source: "gateway" as const, fetchedAt: 1_752_508_900_000, contractGaps: [], transports: { tasks: transport, registryDetail: transport },
  }));
  return { adapters: { loadOperatorControl } as unknown as CaviControlAdapters, loadOperatorControl };
}

describe("Hermes CAVI task composition", () => {
  it("delegates list/get to operator control and returns canonical task shapes", async () => {
    const { adapters, loadOperatorControl } = adaptersWithTasks();
    const client = createHermesCaviTaskClient(adapters);

    await expect(client.listTasks()).resolves.toEqual({ data: [{
      id: "operator/task-1", state: "running",
      createdAt: "2025-07-14T16:00:00.000Z", updatedAt: "2025-07-14T16:01:00.000Z",
      runId: "run-1", cancellable: false,
      metadata: {
        provider: "hermes", stability: "experimental",
        source: { transport: "websocket", method: "operator.tasks.list" },
        providerData: { objective: "Ship the bounded change", tier: "STANDARD", target: { capability: "engineering", team_id: "eng" } },
      },
    }] });
    await expect(client.getTask("operator/task-1")).resolves.toMatchObject({
      id: "operator/task-1", state: "running",
      metadata: { source: { transport: "websocket", method: "operator.tasks.get" } },
    });
    expect(loadOperatorControl).toHaveBeenCalledTimes(2);
  });

  it("reports the actual adapter transport after HTTP fallback", async () => {
    const client = createHermesCaviTaskClient(adaptersWithTasks(1_752_508_800_000, "http").adapters);
    await expect(client.listTasks()).resolves.toMatchObject({
      data: [{ metadata: { source: { transport: "http", method: "operator.tasks.list" } } }],
    });
  });

  it("does not assign wire provenance to local fallback task data", async () => {
    const { adapters } = adaptersWithTasks();
    const loadOperatorControl = vi.mocked(adapters.loadOperatorControl);
    const envelope = await loadOperatorControl();
    loadOperatorControl.mockResolvedValueOnce({
      ...envelope, source: "mock", transports: { tasks: "fallback", registryDetail: "fallback" },
    } as never);
    await expect(createHermesCaviTaskClient(adapters).listTasks())
      .rejects.toThrow(/^Hermes CAVI task response failed schema validation$/u);
  });

  it("checks fallback provenance before both matching and absent task lookup", async () => {
    for (const id of ["operator/task-1", "absent"]) {
      const { adapters } = adaptersWithTasks();
      const loadOperatorControl = vi.mocked(adapters.loadOperatorControl);
      const envelope = await loadOperatorControl();
      loadOperatorControl.mockResolvedValueOnce({
        ...envelope, source: "gateway",
        transports: { tasks: "fallback", registryDetail: "websocket" },
      } as never);
      await expect(createHermesCaviTaskClient(adapters).getTask(id))
        .rejects.toThrow(/^Hermes CAVI task response failed schema validation$/u);
    }
  });

  it("reports cancellation as unavailable instead of inventing a CAVI mutation", async () => {
    const { adapters, loadOperatorControl } = adaptersWithTasks();
    await expect(createHermesCaviTaskClient(adapters).cancelTask!("operator/task-1"))
      .rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.tasks.cancel"));
    expect(loadOperatorControl).not.toHaveBeenCalled();
  });

  it("never dispatches Hermes cron-job routes", async () => {
    const { adapters, loadOperatorControl } = adaptersWithTasks();
    await createHermesCaviTaskClient(adapters).listTasks();
    expect(loadOperatorControl).toHaveBeenCalledOnce();
    const source = readFileSync(fileURLToPath(new URL(
      "../../../../../extensions/cavi/providers/hermes/tasks.ts", import.meta.url,
    )), "utf8");
    expect(source).not.toContain("/api/jobs");
  });

  it("rejects unsupported cursors without dispatch and validates bounded list options", async () => {
    const { adapters, loadOperatorControl } = adaptersWithTasks();
    const client = createHermesCaviTaskClient(adapters);
    await expect(client.listTasks({ cursor: "opaque" })).rejects.toEqual(
      new CapabilityUnavailable("hermes", "controlPlane.tasks.cursor"),
    );
    await expect(client.listTasks({ limit: 0 })).rejects.toThrow(/positive integer/i);
    expect(loadOperatorControl).not.toHaveBeenCalled();
  });

  it.each([
    -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 8_640_000_000_000_001,
  ])("fails closed with a stable schema error for invalid task timestamp %s", async (value) => {
    await expect(createHermesCaviTaskClient(adaptersWithTasks(value).adapters).listTasks())
      .rejects.toThrow(/^Hermes CAVI task response failed schema validation$/u);
  });

  it("rejects accessor-backed snapshots without invoking getters", async () => {
    const getter = vi.fn(() => ({ tasks: [] }));
    const snapshot = {};
    Object.defineProperty(snapshot, "tasks", { enumerable: true, get: getter });
    const loadOperatorControl = vi.fn(async () => ({
      data: snapshot, source: "gateway" as const, fetchedAt: 1, contractGaps: [],
    }));
    const client = createHermesCaviTaskClient({ loadOperatorControl } as unknown as CaviControlAdapters);
    await expect(client.listTasks()).rejects.toThrow(/schema validation/u);
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    { tasks: [] },
    { tasks: { tasks: [{}] } },
    { tasks: { tasks: [{ envelope: { task_id: "" }, receipt: {} }] } },
    { tasks: { tasks: [{ envelope: { task_id: "task", requester: { id: "operator", kind: "agent" }, target: { capability: "engineering" }, objective: "x", tier: "INVALID", acceptance_criteria: [], timeout_s: 1 }, receipt: { task_id: "task", run_id: "run", state: "started", attempt: 1, created_at: 1, updated_at: 1, artifacts: [] }, events: [], validation: null, outcome: null }] } },
    { tasks: { tasks: [{ envelope: { task_id: "task", requester: { id: "operator", kind: "agent" }, target: { capability: "engineering" }, objective: "x", tier: "STANDARD", acceptance_criteria: [], timeout_s: 1 }, receipt: { task_id: "task", run_id: "run", state: "invented", attempt: 1, created_at: 1, updated_at: 1, artifacts: [] }, events: [], validation: null, outcome: null }] } },
  ])("fails closed for malformed JSON-safe task snapshots", async (data) => {
    const loadOperatorControl = vi.fn(async () => ({
      data, source: "gateway" as const, fetchedAt: 1, contractGaps: [], transports: { tasks: "http" as const, registryDetail: "http" as const },
    }));
    await expect(createHermesCaviTaskClient({ loadOperatorControl } as unknown as CaviControlAdapters).listTasks())
      .rejects.toThrow(/^Hermes CAVI task response failed schema validation$/u);
  });
});
