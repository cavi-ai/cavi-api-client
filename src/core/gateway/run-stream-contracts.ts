import type { GatewayResolvedRouteBinding } from "../../contracts/team-manifest.js";

export type AgentRunStatus = "active" | "idle" | "stalled" | "error";

export type AgentRun = {
  key: string;
  title: string;
  agentId: string;
  channel: string;
  updatedAt: number | null;
  status: AgentRunStatus;
  totalTokens: number;
  errors: number;
  /** Model used for this run (e.g. claude-sonnet-4, gpt-4). From backend when available. */
  model?: string;
  /** Cost in USD for this run. From backend when available. */
  totalCostUsd?: number;
  /** Optional manifest-derived binding for source/channel/team routing diagnostics. */
  binding?: GatewayResolvedRouteBinding | null;
};

export type AgentRunPreviewItem = {
  role: string;
  text: string;
  at: number | null;
  eventType?: string;
  toolName?: string;
  durationMs?: number | null;
  error?: string | null;
};

export type AgentRunDetailSnapshot = {
  run: AgentRun | null;
  preview: {
    status: string;
    items: AgentRunPreviewItem[];
  };
  usage: {
    totalTokens: number;
    totalCostUsd: number;
    messages: number;
    toolCalls: number;
    errors: number;
  };
};

/**
 * Canonical wire names for live run-stream events.
 *
 * Producers (Hermes SSE, gateway WebSocket, run-preview poll stopgap, mock)
 * MUST emit these exact strings on the `event` field of every
 * {@link RunStreamEvent}. Consumers MUST switch on these constants — never
 * inline string literals.
 *
 * Tool events are part of the contract even when the upstream transport does
 * not yet emit them: the {@link RunPreviewPollProvider}-style implementation
 * synthesizes them from {@link AgentRunPreviewItem} so the consumer code path
 * is identical regardless of producer.
 */
export const RUN_STREAM_EVENT_NAMES = {
  MESSAGE_DELTA: "message.delta",
  RUN_COMPLETED: "run.completed",
  RUN_FAILED: "run.failed",
  RUN_CANCELLED: "run.cancelled",
  APPROVAL_REQUEST: "approval.request",
  TOOL_CALL_STARTED: "tool.call.started",
  TOOL_CALL_COMPLETED: "tool.call.completed",
  TOOL_CALL_FAILED: "tool.call.failed",
} as const;

export type RunStreamEventName =
  (typeof RUN_STREAM_EVENT_NAMES)[keyof typeof RUN_STREAM_EVENT_NAMES];

export type RunStreamToolStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type RunStreamToolCall = {
  /** Stable id for this tool invocation within the run; producers should make this best-effort unique. */
  id: string;
  name: string;
  status: RunStreamToolStatus;
  /** Free-form provider-side event tag (e.g. the underlying SSE event name) for diagnostics. */
  event?: string;
  /** JSON-stringified arguments / input payload (size-bounded by producer). */
  input?: string;
  /** JSON-stringified result / output (size-bounded by producer). */
  output?: string;
  error?: string;
  durationMs?: number;
  /** Epoch ms when this snapshot was produced. */
  at?: number;
};

export type RunStreamApprovalChoice = "once" | "session" | "always" | "deny";

export type RunStreamMessageDeltaEvent = {
  event: typeof RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA;
  runId: string;
  delta: string;
  at?: number;
};

export type RunStreamRunCompletedEvent = {
  event: typeof RUN_STREAM_EVENT_NAMES.RUN_COMPLETED;
  runId: string;
  output?: string;
  at?: number;
};

export type RunStreamRunFailedEvent = {
  event: typeof RUN_STREAM_EVENT_NAMES.RUN_FAILED;
  runId: string;
  error: string;
  at?: number;
};

export type RunStreamRunCancelledEvent = {
  event: typeof RUN_STREAM_EVENT_NAMES.RUN_CANCELLED;
  runId: string;
  reason?: string;
  at?: number;
};

export type RunStreamApprovalRequestEvent = {
  event: typeof RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST;
  runId: string;
  choices: RunStreamApprovalChoice[];
  at?: number;
};

export type RunStreamToolEvent = {
  event:
    | typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED
    | typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED
    | typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED;
  runId: string;
  toolCall: RunStreamToolCall;
  at?: number;
};

/**
 * Discriminated union of every event a {@link RunEventStreamProvider}-shaped
 * source can emit. Add new variants here when extending the contract — do not
 * add untagged variants.
 */
export type RunStreamEvent =
  | RunStreamMessageDeltaEvent
  | RunStreamRunCompletedEvent
  | RunStreamRunFailedEvent
  | RunStreamRunCancelledEvent
  | RunStreamApprovalRequestEvent
  | RunStreamToolEvent;
