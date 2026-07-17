import type { RuntimeUsage } from "../../../core/runtime/usage.js";
import type { RuntimeControlPlaneEvent, RuntimeEventClient, RuntimeEventSubscription } from "../../../core/runtime/control-plane/events.js";
import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import { isSensitiveKey, REDACTION_PLACEHOLDER, stringifyRedacted } from "../../../core/http/redaction.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";
import type { HermesDashboardEvent, HermesDashboardJsonRpcClient } from "./types.js";

type Subscriber = {
  operationId: string;
  onEvent(event: RuntimeControlPlaneEvent): void;
  onError?(error: unknown): void;
  active: boolean;
  abort?: () => void;
};

function metadata(method: "run.event" | "gateway.ready"): RuntimeControlPlaneEvent["metadata"] {
  return { provider: "hermes", stability: "experimental", source: { transport: "json-rpc", method } };
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

const NORMALIZED_EVENT_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,127}$/u;
const USAGE_KEYS = new Set(["input_tokens", "output_tokens", "total_tokens", "cache_read_tokens", "cache_write_tokens"]);
const NATIVE_TYPES = new Set(["run.event", "gateway.ready", "gateway.closed", "gateway.close", "disconnect"]);

function normalizedEventName(value: unknown): string {
  const name = string(value, "event");
  if (!NORMALIZED_EVENT_NAME.test(name) || isSensitiveKey(name)) throw new TypeError("event name is invalid");
  return name;
}

function nativeType(value: unknown): "run.event" | "gateway.ready" | "gateway.closed" | "gateway.close" | "disconnect" {
  if (typeof value !== "string" || value.length > 128 || !NATIVE_TYPES.has(value)) {
    throw new TypeError("Hermes native event type is invalid");
  }
  return value as "run.event" | "gateway.ready" | "gateway.closed" | "gateway.close" | "disconnect";
}

function usageNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("runtime usage contains an invalid numeric field");
  }
  return value;
}

function usage(value: unknown): RuntimeUsage {
  const record = requireHermesSafeJsonRecord(value, "runtime usage");
  const keys = Object.keys(record);
  if (keys.length === 0 || keys.some((key) => !USAGE_KEYS.has(key))) {
    throw new TypeError("runtime usage contains unsupported fields");
  }
  const inputTokens = usageNumber(record, "input_tokens");
  const outputTokens = usageNumber(record, "output_tokens");
  const totalTokens = usageNumber(record, "total_tokens");
  const cacheReadTokens = usageNumber(record, "cache_read_tokens");
  const cacheWriteTokens = usageNumber(record, "cache_write_tokens");
  if (totalTokens !== undefined && inputTokens !== undefined && outputTokens !== undefined
    && totalTokens !== inputTokens + outputTokens) {
    throw new TypeError("runtime usage total does not match input and output");
  }
  return {
    ...(inputTokens === undefined ? {} : { inputTokens }),
    ...(outputTokens === undefined ? {} : { outputTokens }),
    ...(totalTokens === undefined ? {} : { totalTokens }),
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
  };
}

function boundedRedactedMessage(value: unknown, fallback: string): string {
  const redacted = stringifyRedacted(value, 256);
  if (redacted === undefined || redacted.includes(REDACTION_PLACEHOLDER)) return fallback;
  return redacted.slice(0, 256);
}

function redactedFailure(value: unknown): { message: string } {
  return { message: boundedRedactedMessage(value, "Hermes operation failed") };
}

function mapEvent(native: HermesDashboardEvent): RuntimeControlPlaneEvent | undefined {
  const payload = requireHermesSafeJsonRecord(native.payload, "runtime event");
  const operationId = string(payload.run_id ?? payload.operationId, "operationId");
  const event = normalizedEventName(payload.event ?? "run.event");
  const base = { operationId, metadata: metadata("run.event") };
  switch (event) {
    case "operation.started": return { ...base, event };
    case "message.delta": return { ...base, event, delta: string(payload.delta, "delta") };
    case "reasoning.delta": return { ...base, event, delta: string(payload.delta, "delta") };
    case "tool.started": {
      const tool = string(payload.toolCallId ?? payload.tool, "toolCallId");
      return { ...base, event, toolCallId: tool, toolName: string(payload.toolName ?? payload.tool, "toolName") };
    }
    case "tool.progress": {
      const tool = string(payload.toolCallId ?? payload.tool, "toolCallId");
      return { ...base, event, toolCallId: tool, progress: {} };
    }
    case "tool.completed": {
      const tool = string(payload.toolCallId ?? payload.tool, "toolCallId");
      return { ...base, event, toolCallId: tool };
    }
    case "approval.requested": return { ...base, event, approvalId: string(payload.approvalId, "approvalId") };
    case "approval.resolved": {
      if (typeof payload.approved !== "boolean") throw new TypeError("approved must be a boolean");
      return { ...base, event, approvalId: string(payload.approvalId, "approvalId"), approved: payload.approved };
    }
    case "usage.updated": return { ...base, event, usage: usage(payload.usage) };
    case "operation.completed":
    case "run.completed": return { ...base, event: "operation.completed" };
    case "operation.failed":
    case "run.failed": return { ...base, event: "operation.failed", error: redactedFailure(payload.error) };
    case "operation.cancelled":
    case "run.cancelled": return { ...base, event: "operation.cancelled" };
    case "operation.interrupted": return {
      ...base,
      event,
      ...(payload.reason === undefined
        ? {}
        : { reason: boundedRedactedMessage(payload.reason, "Hermes operation interrupted") }),
    };
    default: return { ...base, event: "operation.updated", update: { nativeEvent: event } };
  }
}

export function createHermesRuntimeEventClient(rpc: HermesDashboardJsonRpcClient): RuntimeEventClient {
  const subscribers = new Set<Subscriber>();
  let detach: (() => void) | undefined;
  let connected = false;
  let disconnected = false;

  const report = (subscriber: Subscriber, error: unknown): void => {
    try { subscriber.onError?.(error); } catch { /* Subscriber errors are isolated. */ }
  };
  const deliver = (subscriber: Subscriber, event: RuntimeControlPlaneEvent): void => {
    try { subscriber.onEvent(event); } catch (error) { report(subscriber, error); }
  };
  const notify = (native: HermesDashboardEvent): void => {
    let type: ReturnType<typeof nativeType>;
    try { type = nativeType(native.type); }
    catch (error) { for (const subscriber of [...subscribers]) report(subscriber, error); return; }
    if (type === "gateway.closed" || type === "gateway.close" || type === "disconnect") {
      if (connected) disconnected = true;
      connected = false;
      return;
    }
    if (type === "gateway.ready") {
      let payload: Record<string, unknown>;
      try { payload = requireHermesSafeJsonRecord(native.payload, "gateway ready event"); }
      catch (error) { for (const subscriber of [...subscribers]) report(subscriber, error); return; }
      if (disconnected) {
        for (const subscriber of [...subscribers]) {
          if (!subscriber.active) continue;
          deliver(subscriber, { event: "stream.reconnected", operationId: subscriber.operationId, metadata: metadata("gateway.ready") });
          if (payload.resumed !== true && payload.continuity !== true) {
            deliver(subscriber, { event: "stream.gap", operationId: subscriber.operationId, reason: "Hermes reconnect did not prove event continuity", metadata: metadata("gateway.ready") });
          }
        }
      }
      connected = true;
      disconnected = false;
      return;
    }
    try {
      const event = mapEvent(native);
      if (!event) return;
      for (const subscriber of [...subscribers]) {
        if (subscriber.active && subscriber.operationId === event.operationId) deliver(subscriber, event);
      }
    } catch (error) {
      for (const subscriber of [...subscribers]) if (subscriber.active) report(subscriber, error);
    }
  };

  return {
    async subscribe(params, handlers): Promise<RuntimeEventSubscription> {
      if (params.cursor !== undefined) throw new CapabilityUnavailable("hermes", "controlPlane.events.cursor");
      if (params.signal?.aborted) {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }
      const subscriber: Subscriber = { operationId: params.operationId, ...handlers, active: true };
      detach ??= rpc.subscribe(notify);
      subscribers.add(subscriber);
      const dispose = (): void => {
        if (!subscriber.active) return;
        subscriber.active = false;
        subscribers.delete(subscriber);
        if (subscriber.abort && params.signal) params.signal.removeEventListener("abort", subscriber.abort);
        if (subscribers.size === 0) {
          detach?.();
          detach = undefined;
          connected = false;
          disconnected = false;
        }
      };
      if (params.signal) {
        subscriber.abort = dispose;
        params.signal.addEventListener("abort", dispose, { once: true });
      }
      return { dispose };
    },
  };
}
