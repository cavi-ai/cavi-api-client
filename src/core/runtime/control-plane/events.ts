import type { RuntimeUsage } from "../usage.js";
import type { RuntimeControlPlaneMetadata } from "./types.js";

export const RUNTIME_CONTROL_PLANE_EVENT_NAMES = [
  "operation.started",
  "operation.updated",
  "message.delta",
  "reasoning.delta",
  "tool.started",
  "tool.progress",
  "tool.completed",
  "approval.requested",
  "approval.resolved",
  "usage.updated",
  "stream.reconnected",
  "stream.gap",
  "operation.completed",
  "operation.failed",
  "operation.cancelled",
  "operation.interrupted",
] as const;

export type RuntimeControlPlaneEventName =
  (typeof RUNTIME_CONTROL_PLANE_EVENT_NAMES)[number];

interface RuntimeControlPlaneEventBase {
  operationId: string;
  metadata: RuntimeControlPlaneMetadata;
}

export type RuntimeControlPlaneEvent =
  | (RuntimeControlPlaneEventBase & { event: "operation.started" })
  | (RuntimeControlPlaneEventBase & { event: "operation.updated"; update: unknown })
  | (RuntimeControlPlaneEventBase & { event: "message.delta"; delta: string })
  | (RuntimeControlPlaneEventBase & { event: "reasoning.delta"; delta: string })
  | (RuntimeControlPlaneEventBase & { event: "tool.started"; toolCallId: string; toolName: string })
  | (RuntimeControlPlaneEventBase & { event: "tool.progress"; toolCallId: string; progress: unknown })
  | (RuntimeControlPlaneEventBase & { event: "tool.completed"; toolCallId: string; result?: unknown })
  | (RuntimeControlPlaneEventBase & { event: "approval.requested"; approvalId: string; request?: unknown })
  | (RuntimeControlPlaneEventBase & { event: "approval.resolved"; approvalId: string; approved: boolean })
  | (RuntimeControlPlaneEventBase & { event: "usage.updated"; usage: RuntimeUsage })
  | (RuntimeControlPlaneEventBase & { event: "stream.reconnected"; cursor?: string })
  | (RuntimeControlPlaneEventBase & { event: "stream.gap"; reason: string })
  | (RuntimeControlPlaneEventBase & { event: "operation.completed" })
  | (RuntimeControlPlaneEventBase & { event: "operation.failed"; error: unknown })
  | (RuntimeControlPlaneEventBase & { event: "operation.cancelled" })
  | (RuntimeControlPlaneEventBase & { event: "operation.interrupted"; reason?: string });

export interface RuntimeEventSubscription {
  dispose(): void | Promise<void>;
}

export interface RuntimeEventClient {
  subscribe(
    params: { operationId: string; cursor?: string; signal?: AbortSignal },
    handlers: {
      onEvent(event: RuntimeControlPlaneEvent): void;
      onError?(error: unknown): void;
    },
  ): Promise<RuntimeEventSubscription>;
}

export interface RuntimeEventSequenceInspection {
  valid: boolean;
  terminalCount: number;
  gaps: number;
}

const TERMINAL_EVENT_NAMES: ReadonlySet<RuntimeControlPlaneEventName> = new Set([
  "operation.completed",
  "operation.failed",
  "operation.cancelled",
  "operation.interrupted",
]);

export function inspectRuntimeEventSequence(
  events: readonly RuntimeControlPlaneEvent[],
): RuntimeEventSequenceInspection {
  let terminalCount = 0;
  let gaps = 0;

  for (const event of events) {
    if (TERMINAL_EVENT_NAMES.has(event.event)) terminalCount += 1;
    if (event.event === "stream.gap") gaps += 1;
  }

  return { valid: terminalCount === 1, terminalCount, gaps };
}
