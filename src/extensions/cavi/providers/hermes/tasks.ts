import { ApiClientError, ApiClientErrorCode } from "../../../../core/errors.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeTaskState, RuntimeTaskSummary, TaskClient } from "../../../../core/runtime/control-plane/tasks.js";
import type { CaviControlAdapters } from "../../adapters/create-cavi-control-adapters.js";
import type { OperatorTaskRecord, OperatorTaskState } from "../../domain/operator.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";

const TASK_SCHEMA_ERROR = "Hermes CAVI task response failed schema validation";
const TASK_STATES = new Set<OperatorTaskState>(["accepted", "queued", "started", "retrying", "blocked", "completed", "dead-letter"]);
const TASK_TIERS = new Set(["LITE", "STANDARD", "HEAVY"] as const);

function fail(): never { throw new Error(TASK_SCHEMA_ERROR); }
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail();
  return value as Record<string, unknown>;
}
function text(value: unknown, nullable = false): void {
  if (nullable && value === null) return;
  if (typeof value !== "string") fail();
}
function id(value: unknown): void { text(value); if ((value as string).length === 0) fail(); }
function integer(value: unknown): void {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail();
}
function strings(value: unknown): void {
  if (!Array.isArray(value)) fail();
  for (const item of value) text(item);
}

function optional(record: Record<string, unknown>, key: string, validate: (value: unknown) => void): void {
  if (record[key] !== undefined) validate(record[key]);
}

function taskRecord(value: unknown): OperatorTaskRecord {
  const task = object(value);
  const envelope = object(task.envelope);
  const requester = object(envelope.requester);
  const target = object(envelope.target);
  const receipt = object(task.receipt);
  id(envelope.task_id);
  optional(envelope, "parent_task_id", (item) => text(item, true));
  id(requester.id); text(requester.kind);
  text(target.capability);
  for (const key of ["team_id", "team_slug", "alias"]) optional(target, key, (item) => text(item, true));
  text(envelope.objective);
  if (!TASK_TIERS.has(envelope.tier as never)) fail();
  strings(envelope.acceptance_criteria);
  integer(envelope.timeout_s);
  id(receipt.task_id); id(receipt.run_id);
  if (receipt.task_id !== envelope.task_id) fail();
  if (!TASK_STATES.has(receipt.state as OperatorTaskState)) fail();
  optional(receipt, "owner", (item) => text(item, true));
  integer(receipt.attempt); timestamp(receipt.created_at as number); timestamp(receipt.updated_at as number);
  optional(receipt, "queue_latency_ms", (item) => { if (item !== null) integer(item); });
  strings(receipt.artifacts);
  optional(receipt, "failure_code", (item) => text(item, true));
  if (!Array.isArray(task.events)) fail();
  for (const eventValue of task.events) {
    const event = object(eventValue);
    id(event.id); timestamp(event.at as number);
    if (!TASK_STATES.has(event.state as OperatorTaskState)) fail();
    optional(event, "note", (item) => text(item, true));
    optional(event, "owner", (item) => text(item, true));
    optional(event, "failureCode", (item) => text(item, true));
  }
  if (task.validation !== null) {
    const validation = object(task.validation);
    id(validation.validation_id); id(validation.validator);
    if (validation.result !== "passed" && validation.result !== "failed" && validation.result !== "waived" && validation.result !== "pending") fail();
  }
  if (task.outcome !== null) {
    const outcome = object(task.outcome);
    if (outcome.outcome !== "success" && outcome.outcome !== "partial" && outcome.outcome !== "fail" && outcome.outcome !== "blocked") fail();
    if (outcome.verification_status !== "passed" && outcome.verification_status !== "failed" && outcome.verification_status !== "waived" && outcome.verification_status !== "pending") fail();
    if (typeof outcome.rework_needed !== "boolean") fail();
    timestamp(outcome.recorded_at as number);
  }
  return task as OperatorTaskRecord;
}

function taskSnapshot(value: unknown): { tasks: { tasks: OperatorTaskRecord[] } } {
  try {
    const snapshot = requireHermesSafeJsonRecord(value, "CAVI task");
    const tasksContainer = object(snapshot.tasks);
    if (!Array.isArray(tasksContainer.tasks)) fail();
    const summary = object(tasksContainer.summary);
    for (const taskState of TASK_STATES) integer(summary[taskState]);
    return { tasks: { tasks: tasksContainer.tasks.map(taskRecord) } };
  } catch {
    throw new Error(TASK_SCHEMA_ERROR);
  }
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

function mapTask(task: OperatorTaskRecord, method: "operator.tasks.list" | "operator.tasks.get", transport: "http" | "websocket"): RuntimeTaskSummary {
  const createdAt = timestamp(task.receipt.created_at);
  const updatedAt = timestamp(task.receipt.updated_at);
  return {
    id: task.envelope.task_id, state: state(task.receipt.state),
    createdAt,
    updatedAt,
    runId: task.receipt.run_id, cancellable: false,
    metadata: {
      provider: "hermes", stability: "experimental",
      source: { transport, method },
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
      const transport = envelope.transports.tasks;
      if (transport === "fallback") throw new Error(TASK_SCHEMA_ERROR);
      return { data: snapshot.tasks.tasks.slice(0, query.limit).map((task) => mapTask(task, "operator.tasks.list", transport)) };
    },
    async getTask(id: string) {
      const envelope = await adapters.loadOperatorControl();
      const transport = envelope.transports.tasks;
      if (transport === "fallback") throw new Error(TASK_SCHEMA_ERROR);
      const task = taskSnapshot(envelope.data).tasks.tasks.find((candidate) => candidate.envelope.task_id === id);
      if (!task) throw new ApiClientError(`Hermes CAVI task not found: ${id}`, { code: ApiClientErrorCode.EndpointNotFound });
      return mapTask(task, "operator.tasks.get", transport);
    },
    cancelTask: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.tasks.cancel")),
  };
}
