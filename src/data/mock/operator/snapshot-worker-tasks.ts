import type { OperatorControlSnapshot } from "../../../domain/index.js";
import { mockNow as now } from "../shared.js";

export const mockOperatorControlWorkerTasks: OperatorControlSnapshot["workerTasks"] =
  {
    stats: {
      pending: 2,
      active: 1,
      shuttingDown: false,
    },
    tasks: [
      {
        taskId: "worker-task-1",
        runId: "worker-run-1",
        type: "backend",
        priority: "normal",
        state: "queued",
        attempt: 0,
        createdAt: now - 12 * 60_000,
        updatedAt: now - 3 * 60_000,
        summary: "Awaiting worker slot",
      },
      {
        taskId: "worker-task-2",
        runId: "worker-run-2",
        type: "infra",
        priority: "high",
        state: "started",
        attempt: 1,
        createdAt: now - 22 * 60_000,
        updatedAt: now - 2 * 60_000,
        summary: "Running rollout verification",
      },
      {
        taskId: "worker-task-3",
        runId: "worker-run-3",
        type: "analysis",
        priority: "low",
        state: "completed",
        attempt: 0,
        createdAt: now - 42 * 60_000,
        updatedAt: now - 18 * 60_000,
        summary: "Completed evidence packet build",
      },
    ],
  };
