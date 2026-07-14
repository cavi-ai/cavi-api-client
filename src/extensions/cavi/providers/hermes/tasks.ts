import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeTaskState, RuntimeTaskSummary, TaskClient } from "../../../../core/runtime/control-plane/tasks.js";
import type { CaviControlAdapters } from "../../adapters/create-cavi-control-adapters.js";
import type { OperatorTaskRecord, OperatorTaskState } from "../../domain/operator.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";

const TASK_SCHEMA_ERROR = "Hermes CAVI task response failed schema validation";

function taskSnapshot(value: unknown): { tasks: { tasks: OperatorTaskRecord[] } } {
  try {
    requireHermesSafeJsonRecord(value, "CAVI task");
  } catch {
    throw new Error(TASK_SCHEMA_ERROR);
  }
  return value as { tasks: { tasks: OperatorTaskRecord[] } };
}

function state(value: OperatorTaskState): RuntimeTaskState {
  switch (value) {
    case "accepted": case "queued": return "pending";
    case "started": case "retrying": return "running";
    case "completed": return "completed";
    case "dead-letter": return "failed";
    default: return "unknown";
  }
}

function timestamp(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0 || value > 8_640_000_000_000_000) {
    throw new Error(TASK_SCHEMA_ERROR);
  }
  return new Date(value).toISOString();
}

function mapTask(task: OperatorTaskRecord, method: "operator.tasks.list" | "operator.tasks.get"): RuntimeTaskSummary {
  const createdAt = timestamp(task.receipt.created_at);
  const updatedAt = timestamp(task.receipt.updated_at);
  return {
    id: task.envelope.task_id, state: state(task.receipt.state),
    createdAt,
    updatedAt,
    runId: task.receipt.run_id, cancellable: false,
    metadata: {
      provider: "hermes", stability: "experimental",
      source: { transport: "websocket", method },
      providerData: { objective: task.envelope.objective, tier: task.envelope.tier, target: task.envelope.target },
    },
  };
}

export function createHermesCaviTaskClient(adapters: CaviControlAdapters): TaskClient {
  return {
    async listTasks(query = {}) {
      if (query.cursor !== undefined) throw new CapabilityUnavailable("hermes", "controlPlane.tasks.cursor");
      if (query.limit !== undefined && (!Number.isSafeInteger(query.limit) || query.limit < 1)) {
        throw new TypeError("Task page limit must be a positive integer");
      }
      const envelope = await adapters.loadOperatorControl();
      const snapshot = taskSnapshot(envelope.data);
      return { data: snapshot.tasks.tasks.slice(0, query.limit).map((task) => mapTask(task, "operator.tasks.list")) };
    },
    async getTask(id: string) {
      const envelope = await adapters.loadOperatorControl();
      const task = taskSnapshot(envelope.data).tasks.tasks.find((candidate) => candidate.envelope.task_id === id);
      if (!task) throw new ApiClientError(`Hermes CAVI task not found: ${id}`, { code: ApiClientErrorCode.EndpointNotFound });
      return mapTask(task, "operator.tasks.get");
    },
    cancelTask: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.tasks.cancel")),
  };
}
