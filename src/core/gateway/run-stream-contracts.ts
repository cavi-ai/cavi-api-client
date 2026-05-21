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

export type RunStreamEvent =
  | RunStreamMessageDeltaEvent
  | RunStreamRunCompletedEvent
  | RunStreamRunFailedEvent
  | RunStreamRunCancelledEvent
  | RunStreamApprovalRequestEvent
  | RunStreamToolEvent;
