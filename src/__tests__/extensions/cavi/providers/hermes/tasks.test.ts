import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { CaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters.js";
import { createHermesCaviTaskClient } from "../../../../../extensions/cavi/providers/hermes/tasks.js";
import type { OperatorControlSnapshot } from "../../../../../extensions/cavi/domain/operator.js";

function adaptersWithTasks(): { adapters: CaviControlAdapters; loadOperatorControl: ReturnType<typeof vi.fn> } {
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
      attempt: 1, created_at: 1_752_508_800_000, updated_at: 1_752_508_860_000,
      artifacts: [],
    },
    events: [], validation: null, outcome: null,
  }];
  const loadOperatorControl = vi.fn(async () => ({
    data: { tasks: { tasks } } as unknown as OperatorControlSnapshot,
    source: "gateway" as const, fetchedAt: 1_752_508_900_000, contractGaps: [],
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
});
