import type { GatewayResolvedRouteBinding } from "../../../contracts/team-manifest.js";

// The universal run-stream contract now lives in core/runtime. The event types
// are re-exported here (and the stream interfaces from event-stream.ts) so the
// ./core/gateway/run subpath and existing importers are unchanged.
export {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEventName,
  type RunStreamToolStatus,
  type RunStreamToolCall,
  type RunStreamApprovalChoice,
  type RunStreamMessageDeltaEvent,
  type RunStreamRunCompletedEvent,
  type RunStreamRunFailedEvent,
  type RunStreamRunCancelledEvent,
  type RunStreamApprovalRequestEvent,
  type RunStreamToolEvent,
  type RunStreamEvent,
} from "../../runtime/run-stream.js";

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
