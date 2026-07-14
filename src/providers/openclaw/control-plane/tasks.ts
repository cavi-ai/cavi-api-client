import { toError } from "../../../core/errors.js";
import type {
  RuntimeTaskState,
  RuntimeTaskSummary,
} from "../../../core/runtime/control-plane/tasks.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";

import { normalizeState, normalizeTimestamp } from "./normalize.js";
import type { OpenClawRpc } from "./rpc.js";
import { parseOpenClaw } from "./protocol-error.js";
import { parseTasksCancel, parseTasksGet, parseTasksList } from "./wire.js";

type ListOptions = { cursor?: string; limit?: number };
type CancelOptions = { reason?: string };
type WireTask = {
  id: string;
  status: string;
  createdAt?: string | number;
  updatedAt?: string | number;
  runId?: string;
  sessionKey?: string;
  [key: string]: unknown;
};

function metadata(method: string, providerData?: Record<string, unknown>): RuntimeControlPlaneMetadata {
  const result: RuntimeControlPlaneMetadata = {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method },
  };
  if (providerData && Object.keys(providerData).length > 0) result.providerData = providerData;
  return result;
}

async function request(
  rpc: OpenClawRpc,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  try {
    return await rpc.request(method, params, { signal: undefined });
  } catch (error) {
    throw toError(error, `OpenClaw ${method} request failed`);
  }
}

function mapTask(
  task: WireTask,
  method: string,
  operationData: Record<string, unknown> = {},
): RuntimeTaskSummary {
  const normalized = normalizeState(task.status);
  const providerData: Record<string, unknown> = { ...normalized.metadata };
  for (const [key, value] of Object.entries(task)) {
    if (!["id", "status", "createdAt", "updatedAt", "runId", "sessionKey"].includes(key)) {
      providerData[key] = value;
    }
  }
  Object.assign(providerData, operationData);
  const cancellable = task.status === "queued" || task.status === "running";
  return {
    id: task.id,
    state: normalized.state as RuntimeTaskState,
    ...(task.createdAt === undefined ? {} : { createdAt: normalizeTimestamp(task.createdAt) }),
    ...(task.updatedAt === undefined ? {} : { updatedAt: normalizeTimestamp(task.updatedAt) }),
    ...(task.runId === undefined ? {} : { runId: task.runId }),
    ...(task.sessionKey === undefined ? {} : { sessionId: task.sessionKey }),
    cancellable,
    metadata: metadata(method, providerData),
  };
}

export function createOpenClawTaskClient(rpc: OpenClawRpc) {
  return {
    async listTasks(options: ListOptions = {}) {
      const params: Record<string, unknown> = {};
      if (options.cursor !== undefined) params.cursor = options.cursor;
      if (options.limit !== undefined) params.limit = options.limit;
      const payload = await request(rpc, "tasks.list", params);
      return parseOpenClaw("tasks.list", () => {
        const parsed = parseTasksList(payload);
        return {
          data: (parsed.tasks as WireTask[]).map((task) => mapTask(task, "tasks.list")),
          ...(parsed.nextCursor === undefined ? {} : { nextCursor: parsed.nextCursor as string }),
        };
      });
    },

    async getTask(id: string): Promise<RuntimeTaskSummary> {
      const payload = await request(rpc, "tasks.get", { id });
      return parseOpenClaw("tasks.get", () => {
        const parsed = parseTasksGet(payload);
        return mapTask(parsed.task as WireTask, "tasks.get");
      });
    },

    async cancelTask(id: string, options: CancelOptions = {}): Promise<RuntimeTaskSummary> {
      const params: Record<string, unknown> = { id };
      if (options.reason !== undefined) params.reason = options.reason;
      const payload = await request(rpc, "tasks.cancel", params);
      const parsed = parseOpenClaw("tasks.cancel", () => parseTasksCancel(payload));
      const operationData: Record<string, unknown> = {
        found: parsed.found,
        cancelled: parsed.cancelled,
      };
      if (parsed.reason !== undefined) operationData.reason = parsed.reason;
      const fallbackState: RuntimeTaskState = parsed.cancelled === true ? "cancelled" : "unknown";
      const task = parsed.task as WireTask | undefined;
      return task === undefined
        ? {
            id,
            state: fallbackState,
            cancellable: false,
            metadata: metadata("tasks.cancel", operationData),
          }
        : mapTask(task, "tasks.cancel", operationData);
    },
  };
}
