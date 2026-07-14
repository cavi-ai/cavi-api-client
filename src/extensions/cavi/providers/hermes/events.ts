import type { RuntimeUsage } from "../../../../core/runtime/usage.js";
import type { RuntimeControlPlaneEvent, RuntimeEventClient, RuntimeEventSubscription } from "../../../../core/runtime/control-plane/events.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";
import type { HermesDashboardEvent, HermesDashboardJsonRpcClient } from "./types.js";

type Subscriber = {
  operationId: string;
  onEvent(event: RuntimeControlPlaneEvent): void;
  onError?(error: unknown): void;
  active: boolean;
  abort?: () => void;
};

function metadata(method: string): RuntimeControlPlaneEvent["metadata"] {
  return { provider: "hermes", stability: "experimental", source: { transport: "json-rpc", method } };
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a non-empty string`);
  return value;
}

function mapEvent(native: HermesDashboardEvent): RuntimeControlPlaneEvent | undefined {
  if (native.type === "gateway.ready" || native.type === "gateway.closed" || native.type === "gateway.close" || native.type === "disconnect") return undefined;
  const payload = requireHermesSafeJsonRecord(native.payload, "runtime event");
  const operationId = string(payload.run_id ?? payload.operationId, "operationId");
  const event = string(payload.event ?? native.type, "event");
  const base = { operationId, metadata: metadata(native.type) };
  switch (event) {
    case "operation.started": return { ...base, event };
    case "message.delta": return { ...base, event, delta: string(payload.delta, "delta") };
    case "reasoning.delta": return { ...base, event, delta: string(payload.delta, "delta") };
    case "tool.started": {
      const tool = string(payload.toolCallId ?? payload.tool, "toolCallId");
      return { ...base, event, toolCallId: tool, toolName: string(payload.toolName ?? payload.tool, "toolName") };
    }
    case "tool.completed": {
      const tool = string(payload.toolCallId ?? payload.tool, "toolCallId");
      return { ...base, event, toolCallId: tool, ...(payload.result === undefined ? {} : { result: payload.result }) };
    }
    case "usage.updated": return { ...base, event, usage: payload.usage as RuntimeUsage };
    case "operation.completed":
    case "run.completed": return { ...base, event: "operation.completed" };
    case "operation.failed":
    case "run.failed": return { ...base, event: "operation.failed", error: payload.error };
    case "operation.cancelled":
    case "run.cancelled": return { ...base, event: "operation.cancelled" };
    case "operation.interrupted": return { ...base, event, ...(typeof payload.reason === "string" ? { reason: payload.reason } : {}) };
    default: return { ...base, event: "operation.updated", update: { nativeEvent: event, payload } };
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
    if (native.type === "gateway.closed" || native.type === "gateway.close" || native.type === "disconnect") {
      if (connected) disconnected = true;
      connected = false;
      return;
    }
    if (native.type === "gateway.ready") {
      let payload: Record<string, unknown>;
      try { payload = requireHermesSafeJsonRecord(native.payload, "gateway ready event"); }
      catch (error) { for (const subscriber of [...subscribers]) report(subscriber, error); return; }
      if (disconnected) {
        for (const subscriber of [...subscribers]) {
          if (!subscriber.active) continue;
          deliver(subscriber, { event: "stream.reconnected", operationId: subscriber.operationId, metadata: metadata(native.type) });
          if (payload.resumed !== true && payload.continuity !== true) {
            deliver(subscriber, { event: "stream.gap", operationId: subscriber.operationId, reason: "Hermes reconnect did not prove event continuity", metadata: metadata(native.type) });
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
      subscribers.add(subscriber);
      detach ??= rpc.subscribe(notify);
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
