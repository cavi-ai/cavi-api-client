// The universal run-stream contract. Every provider normalizes its transport
// (Anthropic SSE, gateway WebSocket, run-detail poll, mock) into these types.

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

export type RunStreamToolStatus = "pending" | "running" | "completed" | "failed";

export type RunStreamToolCall = {
  id: string;
  name: string;
  status: RunStreamToolStatus;
  event?: string;
  input?: string;
  output?: string;
  error?: string;
  durationMs?: number;
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

export type RunStreamEvent =
  | RunStreamMessageDeltaEvent
  | RunStreamRunCompletedEvent
  | RunStreamRunFailedEvent
  | RunStreamRunCancelledEvent
  | RunStreamApprovalRequestEvent
  | RunStreamToolEvent;

/** Disposes an active subscription. Idempotent. */
export type RunEventStreamSubscription = {
  dispose(): void | Promise<void>;
};

export type RunEventStreamSubscribeParams = {
  runId: string;
  /** Optional caller-supplied abort signal. Implementations MUST honor abort and dispose. */
  signal?: AbortSignal;
};

export type RunEventStreamHandlers = {
  onEvent: (event: RunStreamEvent) => void;
  /** Transport / parse errors. Lifecycle "run.failed" is delivered via onEvent, not here. */
  onError?: (error: unknown) => void;
  /** Fired once after the stream has emitted its last event of the run. */
  onComplete?: () => void;
};

/**
 * Harness-agnostic source of live run events. Implementations bind to a
 * transport and translate native messages into the canonical RunStreamEvent
 * union; every emitted event's `event` field MUST be one of
 * RUN_STREAM_EVENT_NAMES.
 */
export interface RunEventStreamProvider {
  subscribe(
    params: RunEventStreamSubscribeParams,
    handlers: RunEventStreamHandlers,
  ): Promise<RunEventStreamSubscription>;
}
