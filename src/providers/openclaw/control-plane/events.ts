import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import type {
  RuntimeControlPlaneEvent,
  RuntimeEventClient,
  RuntimeEventSubscription,
} from "../../../core/runtime/control-plane/events.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";
import { isSensitiveKey } from "../../../core/http/redaction.js";

import type { OpenClawRpc, OpenClawRpcEvent } from "./rpc.js";
import {
  openClawNativeEventProtocolError,
  openClawProtocolError,
} from "./protocol-error.js";

type NativeObject = Record<string, unknown>;
type Subscriber = {
  operationId: string;
  onEvent(event: RuntimeControlPlaneEvent): void;
  onError?(error: unknown): void;
  abort?: () => void;
  active: boolean;
};

const MAX_NATIVE_EVENT_NAME_LENGTH = 128;
const SAFE_NATIVE_EVENT_NAME = /^[A-Za-z][A-Za-z0-9_.:-]*$/u;
const KNOWN_TASK_EVENTS = new Set([
  "task.started",
  "task.updated",
  "task.completed",
  "task.failed",
  "task.cancelled",
  "task.canceled",
]);

function safeNativeEventName(value: unknown): string {
  if (
    typeof value !== "string"
    || value.length === 0
    || value.length > MAX_NATIVE_EVENT_NAME_LENGTH
    || !SAFE_NATIVE_EVENT_NAME.test(value)
    || isSensitiveKey(value)
  ) {
    throw new TypeError("native event name is invalid");
  }
  return value;
}

function metadata(method: string): RuntimeControlPlaneMetadata {
  return {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method },
  };
}

function nativeObject(value: unknown, label = "native event payload"): NativeObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value as NativeObject;
}

function assertSafe(value: unknown, label = "native event payload", ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new TypeError(`${label} must not be cyclic`);
    ancestors.add(value);
    value.forEach((item, index) => assertSafe(item, `${label}[${index}]`, ancestors));
    ancestors.delete(value);
    return;
  }
  const object = nativeObject(value, label);
  if (ancestors.has(object)) throw new TypeError(`${label} must not be cyclic`);
  ancestors.add(object);
  for (const [key, item] of Object.entries(object)) {
    if (isSensitiveKey(key)) throw new TypeError(`${label}.${key} is not allowed`);
    assertSafe(item, `${label}.${key}`, ancestors);
  }
  ancestors.delete(object);
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function operationId(payload: NativeObject): string {
  return requiredString(payload.operationId ?? payload.runId ?? payload.taskId, "operationId");
}

function mapSessionOperation(method: string, payload: NativeObject): RuntimeControlPlaneEvent {
  const id = operationId(payload);
  const event = requiredString(payload.event ?? payload.type, "session operation event");
  const base = { operationId: id, metadata: metadata(method) };

  switch (event) {
    case "operation.started": return { ...base, event };
    case "operation.updated": return { ...base, event, update: payload.update };
    case "message.delta": return { ...base, event, delta: requiredString(payload.delta, "delta") };
    case "reasoning.delta": return { ...base, event, delta: requiredString(payload.delta, "delta") };
    case "tool.started": return { ...base, event, toolCallId: requiredString(payload.toolCallId, "toolCallId"), toolName: requiredString(payload.toolName, "toolName") };
    case "tool.progress": return { ...base, event, toolCallId: requiredString(payload.toolCallId, "toolCallId"), progress: payload.progress };
    case "tool.completed": return { ...base, event, toolCallId: requiredString(payload.toolCallId, "toolCallId"), ...(payload.result === undefined ? {} : { result: payload.result }) };
    case "approval.requested": return { ...base, event, approvalId: requiredString(payload.approvalId, "approvalId"), ...(payload.request === undefined ? {} : { request: payload.request }) };
    case "approval.resolved": {
      if (typeof payload.approved !== "boolean") throw new TypeError("approved must be a boolean");
      return { ...base, event, approvalId: requiredString(payload.approvalId, "approvalId"), approved: payload.approved };
    }
    case "operation.completed": return { ...base, event };
    case "operation.failed": return { ...base, event, error: payload.error };
    case "operation.cancelled": return { ...base, event };
    case "operation.interrupted": return { ...base, event, ...(typeof payload.reason === "string" ? { reason: payload.reason } : {}) };
    default:
      assertSafe(payload);
      return { ...base, event: "operation.updated", update: { nativeEvent: event, payload } };
  }
}

function mapTaskEvent(method: string, payload: NativeObject): RuntimeControlPlaneEvent {
  const id = operationId(payload);
  const base = { operationId: id, metadata: metadata(method) };
  const terminal = method.replace(/^task\./, "");
  if (terminal === "completed") return { ...base, event: "operation.completed" };
  if (terminal === "failed") return { ...base, event: "operation.failed", error: payload.error };
  if (terminal === "cancelled" || terminal === "canceled") return { ...base, event: "operation.cancelled" };
  if (terminal === "started") return { ...base, event: "operation.started" };
  const { operationId: _operationId, runId: _runId, taskId: _taskId, ...update } = payload;
  return { ...base, event: "operation.updated", update };
}

function mapNativeEvent(native: OpenClawRpcEvent): RuntimeControlPlaneEvent | undefined {
  if (native.event === "connection.open" || native.event === "connection.closed" || native.event === "connection.close" || native.event === "disconnect") return undefined;
  const payload = nativeObject(native.payload);
  assertSafe(payload);
  if (native.event === "session.operation") return mapSessionOperation(native.event, payload);
  if (KNOWN_TASK_EVENTS.has(native.event)) return mapTaskEvent(native.event, payload);
  assertSafe(payload);
  const id = operationId(payload);
  return {
    event: "operation.updated",
    operationId: id,
    update: { nativeEvent: native.event, payload },
    metadata: metadata(native.event),
  };
}

export function createOpenClawRuntimeEventClient(rpc: OpenClawRpc): RuntimeEventClient {
  const subscribers = new Set<Subscriber>();
  let detachNative: (() => void) | undefined;
  let connectionGeneration = 0;
  let connected = false;

  // R11 reconnect-gap seed. When this client attaches to a socket that is
  // ALREADY connected — the common case now that OpenClaw shares one socket
  // across the control plane, resolver, and every stream — the socket's
  // generation-1 `connection.open` fired before our native listener existed. So
  // the first `connection.open` we actually observe is a RECONNECT, not the
  // initial connect. Seed the generation to 1 (accounting for that missed
  // initial open) while leaving `connected` false: the next observed open is
  // processed and becomes generation 2 → `stream.reconnected` + a conditional
  // `stream.gap`. Sockets that are not yet connected, or rpcs that don't expose
  // `getConnectionState`, keep the legacy 0/false start (first open is the
  // initial connect, emitting nothing). Re-run on every (re)attach so a later
  // stream on the shared client — after an earlier stream reset the generation
  // on its last unsubscribe — still detects its first reconnect.
  const seedFromLiveConnection = (): void => {
    if (rpc.getConnectionState?.() === "connected") {
      connectionGeneration = 1;
      connected = false;
    }
  };
  seedFromLiveConnection();

  const reportSubscriberError = (subscriber: Subscriber, error: unknown): void => {
    try { subscriber.onError?.(error); } catch { /* subscriber callbacks cannot break fan-out */ }
  };

  const deliver = (subscriber: Subscriber, event: RuntimeControlPlaneEvent): void => {
    try { subscriber.onEvent(event); } catch (error) { reportSubscriberError(subscriber, error); }
  };

  const emitReconnect = (native: OpenClawRpcEvent): void => {
    const payload = nativeObject(native.payload);
    assertSafe(payload);
    if (connected) return;
    connected = true;
    connectionGeneration += 1;
    if (connectionGeneration === 1) return;
    const continuityProven = payload.resumed === true || payload.continuity === true;
    for (const subscriber of [...subscribers]) {
      if (!subscriber.active) continue;
      deliver(subscriber, {
        event: "stream.reconnected",
        operationId: subscriber.operationId,
        metadata: metadata(native.event),
      });
      if (!continuityProven) {
        deliver(subscriber, {
          event: "stream.gap",
          operationId: subscriber.operationId,
          reason: "native reconnect did not prove event continuity",
          metadata: metadata(native.event),
        });
      }
    }
  };

  const onNativeEvent = (native: OpenClawRpcEvent): void => {
    let eventName: string;
    try {
      eventName = safeNativeEventName(native.event);
    } catch {
      const error = openClawNativeEventProtocolError();
      for (const subscriber of [...subscribers]) {
        if (subscriber.active) reportSubscriberError(subscriber, error);
      }
      return;
    }
    if (eventName === "connection.open") {
      try { emitReconnect(native); } catch {
        const error = openClawProtocolError(eventName);
        for (const subscriber of subscribers) reportSubscriberError(subscriber, error);
      }
      return;
    }
    if (eventName === "connection.closed" || eventName === "connection.close" || eventName === "disconnect") {
      connected = false;
      return;
    }
    try {
      const event = mapNativeEvent(native);
      if (!event) return;
      for (const subscriber of [...subscribers]) {
        if (subscriber.active && subscriber.operationId === event.operationId) deliver(subscriber, event);
      }
    } catch {
      let id: string | undefined;
      try { id = operationId(nativeObject(native.payload)); } catch { /* report malformed global input */ }
      const error = openClawProtocolError(eventName);
      for (const subscriber of [...subscribers]) {
        if (subscriber.active && (id === undefined || subscriber.operationId === id)) reportSubscriberError(subscriber, error);
      }
    }
  };

  return {
    async subscribe(params, handlers): Promise<RuntimeEventSubscription> {
      if (params.cursor !== undefined) {
        throw new CapabilityUnavailable("openclaw", "controlPlane.events.cursor");
      }
      if (params.signal?.aborted) {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      }

      const subscriber: Subscriber = {
        operationId: params.operationId,
        onEvent: handlers.onEvent,
        onError: handlers.onError,
        active: true,
      };
      subscribers.add(subscriber);
      if (detachNative === undefined) {
        // Re-seed from the socket's live state before re-attaching: a prior
        // stream's last unsubscribe reset the generation to 0/false.
        seedFromLiveConnection();
        detachNative = rpc.subscribe(onNativeEvent);
      }

      const dispose = (): void => {
        if (!subscriber.active) return;
        subscriber.active = false;
        subscribers.delete(subscriber);
        if (subscriber.abort && params.signal) params.signal.removeEventListener("abort", subscriber.abort);
        if (subscribers.size === 0) {
          detachNative?.();
          detachNative = undefined;
          connectionGeneration = 0;
          connected = false;
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
