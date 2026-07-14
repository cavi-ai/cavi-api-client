import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeTaskState, RuntimeTaskSummary, TaskClient } from "../../../../core/runtime/control-plane/tasks.js";
import type { CaviControlAdapters } from "../../adapters/create-cavi-control-adapters.js";
import type { OperatorTaskRecord, OperatorTaskState } from "../../domain/operator.js";

function state(value: OperatorTaskState): RuntimeTaskState {
  switch (value) {
    case "accepted": case "queued": return "pending";
    case "started": case "retrying": return "running";
    case "completed": return "completed";
    case "dead-letter": return "failed";
    default: return "unknown";
  }
}

function timestamp(value: number): string | undefined {
  return Number.isFinite(value) && value >= 0 ? new Date(value).toISOString() : undefined;
}

function mapTask(task: OperatorTaskRecord, method: "operator.tasks.list" | "operator.tasks.get"): RuntimeTaskSummary {
  const createdAt = timestamp(task.receipt.created_at);
  const updatedAt = timestamp(task.receipt.updated_at);
  return {
    id: task.envelope.task_id, state: state(task.receipt.state),
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
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
      return { data: envelope.data.tasks.tasks.slice(0, query.limit).map((task) => mapTask(task, "operator.tasks.list")) };
    },
    async getTask(id: string) {
      const envelope = await adapters.loadOperatorControl();
      const task = envelope.data.tasks.tasks.find((candidate) => candidate.envelope.task_id === id);
      if (!task) throw new ApiClientError(`Hermes CAVI task not found: ${id}`, { code: ApiClientErrorCode.EndpointNotFound });
      return mapTask(task, "operator.tasks.get");
    },
    cancelTask: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.tasks.cancel")),
  };
}
