import type { RuntimeTaskState } from "../../../core/runtime/control-plane/tasks.js";

import { OpenClawWireError } from "./wire.js";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type SafeMetadata = Readonly<Record<string, JsonValue>>;

const SECRET_KEY = /token|secret|authorization|cookie|password|key/i;

function defineJsonProperty(output: { [key: string]: JsonValue }, key: string, value: JsonValue): void {
  Object.defineProperty(output, key, { value, enumerable: true, configurable: true, writable: true });
}

function safeJson(value: unknown, path: string, ancestors: Set<object>): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new OpenClawWireError(`cyclic metadata at ${path}`);
    ancestors.add(value);
    try { return value.map((item, index) => safeJson(item, `${path}[${index}]`, ancestors)); }
    finally { ancestors.delete(value); }
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new OpenClawWireError(`non-JSON metadata at ${path}`);
    if (ancestors.has(value)) throw new OpenClawWireError(`cyclic metadata at ${path}`);
    ancestors.add(value);
    const output: { [key: string]: JsonValue } = {};
    try {
      for (const [key, item] of Object.entries(value)) {
        if (!SECRET_KEY.test(key)) defineJsonProperty(output, key, safeJson(item, `${path}.${key}`, ancestors));
      }
      return output;
    } finally { ancestors.delete(value); }
  }
  throw new OpenClawWireError(`non-JSON metadata at ${path}`);
}

export function safeMetadata(value: unknown): SafeMetadata {
  const safe = safeJson(value, "metadata", new Set());
  if (safe === null || Array.isArray(safe) || typeof safe !== "object") {
    throw new OpenClawWireError("metadata must be an object");
  }
  return safe;
}

export function normalizeTimestamp(value: unknown): string {
  let date: Date;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) date = new Date(value);
  else if (typeof value === "string" && value.length > 0) date = new Date(value);
  else throw new OpenClawWireError("invalid timestamp");
  if (!Number.isFinite(date.getTime())) throw new OpenClawWireError("invalid timestamp");
  try { return date.toISOString(); }
  catch { throw new OpenClawWireError("invalid timestamp"); }
}

export function normalizeState(value: unknown): { state: RuntimeTaskState; metadata: SafeMetadata } {
  if (typeof value !== "string" || value.length === 0 || SECRET_KEY.test(value)) {
    throw new OpenClawWireError("invalid upstream state");
  }
  const direct: Partial<Record<string, RuntimeTaskState>> = {
    queued: "pending", pending: "pending", running: "running", active: "running",
    completed: "completed", cancelled: "cancelled", failed: "failed",
  };
  const state = direct[value];
  if (state) return { state, metadata: {} };
  if (value === "timed_out") return { state: "failed", metadata: { upstreamState: value } };
  return { state: "unknown", metadata: { upstreamState: value } };
}
