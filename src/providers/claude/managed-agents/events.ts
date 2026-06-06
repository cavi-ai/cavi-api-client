// Typed Managed Agents session events — the RICH steering surface, distinct from
// the lossy canonical RunStreamEvent mapping in `stream.ts`. A driver needs the
// `sevt_` event id and `evaluated_permission` to answer tool requests, which the
// canonical union deliberately drops.
//
// Field names are GROUND TRUTH captured from a live session (2026-06-06), not the
// self-contradicting docs:
//   agent.tool_use         → { id (sevt_), name, input, evaluated_permission }
//   agent.custom_tool_use  → { id (sevt_), name, input }
//   answer ids are the event `id`; see client.confirmTool / respondCustomTool.

export type ManagedAgentToolUseEvent = {
  kind: "tool_use";
  /** `sevt_…` — echo as `tool_use_id` on a confirmation. */
  id: string;
  name: string;
  input: unknown;
  /** `"ask"` ⇒ the session is paused awaiting a `user.tool_confirmation`. */
  evaluatedPermission?: string;
  source: "agent" | "mcp";
  /** Set when cross-posted from a subagent thread — echo it on the confirmation. */
  sessionThreadId?: string;
};

export type ManagedAgentCustomToolUseEvent = {
  kind: "custom_tool_use";
  /** `sevt_…` — echo as `custom_tool_use_id` on a result. */
  id: string;
  name: string;
  input: unknown;
  /** Set when cross-posted from a subagent thread — echo it on the result. */
  sessionThreadId?: string;
};

export type ManagedAgentMessageEvent = { kind: "message"; id?: string; text: string };
export type ManagedAgentToolResultEvent = {
  kind: "tool_result";
  id?: string;
  isError: boolean;
  source: "agent" | "mcp";
};
export type ManagedAgentStatusKind = "running" | "idle" | "rescheduling" | "terminated" | (string & {});
export type ManagedAgentStatusEvent = {
  kind: "status";
  id?: string;
  status: ManagedAgentStatusKind;
  stopReason?: { type?: string; [key: string]: unknown };
};
export type ManagedAgentErrorEvent = { kind: "error"; id?: string; message: string };

// ── Outcomes (rubric-graded loops) ──────────────────────────────────────────
export type ManagedAgentOutcomeResult =
  | "satisfied"
  | "needs_revision"
  | "max_iterations_reached"
  | "failed"
  | "interrupted"
  | (string & {});
export type ManagedAgentOutcomeStartEvent = {
  kind: "outcome_start";
  id?: string;
  outcomeId: string;
  iteration: number;
};
export type ManagedAgentOutcomeProgressEvent = {
  kind: "outcome_progress";
  id?: string;
  outcomeId: string;
};
export type ManagedAgentOutcomeEndEvent = {
  kind: "outcome_end";
  id?: string;
  outcomeId: string;
  iteration: number;
  result: ManagedAgentOutcomeResult;
  explanation?: string;
};

// ── Multiagent threads ──────────────────────────────────────────────────────
export type ManagedAgentThreadCreatedEvent = {
  kind: "thread_created";
  id?: string;
  threadId?: string;
  agentName?: string;
};
export type ManagedAgentThreadStatusEvent = {
  kind: "thread_status";
  id?: string;
  threadId?: string;
  agentName?: string;
  status: ManagedAgentStatusKind;
  stopReason?: { type?: string; [key: string]: unknown };
};
export type ManagedAgentThreadMessageEvent = {
  kind: "thread_message";
  id?: string;
  direction: "sent" | "received";
  /** The OTHER thread: destination for `sent`, origin for `received`. */
  threadId?: string;
  agentName?: string;
  text: string;
};

export type ManagedAgentOtherEvent = { kind: "other"; id?: string; type: string };

export type ManagedAgentSessionEvent =
  | ManagedAgentMessageEvent
  | ManagedAgentToolUseEvent
  | ManagedAgentCustomToolUseEvent
  | ManagedAgentToolResultEvent
  | ManagedAgentStatusEvent
  | ManagedAgentErrorEvent
  | ManagedAgentOutcomeStartEvent
  | ManagedAgentOutcomeProgressEvent
  | ManagedAgentOutcomeEndEvent
  | ManagedAgentThreadCreatedEvent
  | ManagedAgentThreadStatusEvent
  | ManagedAgentThreadMessageEvent
  | ManagedAgentOtherEvent;

function textFromContent(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let text = "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "text" &&
      typeof (block as { text?: unknown }).text === "string"
    ) {
      text += (block as { text: string }).text;
    }
  }
  return text;
}

function idOf(raw: Record<string, unknown>): string | undefined {
  return typeof raw.id === "string" && raw.id ? raw.id : undefined;
}

function statusFromType(type: string): ManagedAgentStatusKind | null {
  switch (type) {
    case "session.status_running":
    case "status_running":
      return "running";
    case "session.status_idle":
    case "status_idle":
      return "idle";
    case "session.status_rescheduled":
    case "status_rescheduled":
      return "rescheduling";
    case "session.status_terminated":
    case "status_terminated":
      return "terminated";
    default:
      return null;
  }
}

function threadStatusFromType(type: string): ManagedAgentStatusKind | null {
  switch (type) {
    case "session.thread_status_running":
      return "running";
    case "session.thread_status_idle":
      return "idle";
    case "session.thread_status_rescheduled":
      return "rescheduling";
    case "session.thread_status_terminated":
      return "terminated";
    default:
      return null;
  }
}

/** Parse a raw Managed Agents event object (from the stream or `events.list`). */
export function parseSessionEvent(
  raw: Record<string, unknown> | null | undefined,
): ManagedAgentSessionEvent | null {
  const type = raw?.type;
  if (!raw || typeof type !== "string") return null;
  const id = idOf(raw);

  switch (type) {
    case "agent.message":
      return { kind: "message", ...(id ? { id } : {}), text: textFromContent(raw.content) };
    case "agent.tool_use":
    case "agent.mcp_tool_use":
      return {
        kind: "tool_use",
        id: id ?? "",
        name: typeof raw.name === "string" ? raw.name : "",
        input: raw.input,
        ...(typeof raw.evaluated_permission === "string"
          ? { evaluatedPermission: raw.evaluated_permission }
          : {}),
        source: type === "agent.mcp_tool_use" ? "mcp" : "agent",
        ...(typeof raw.session_thread_id === "string"
          ? { sessionThreadId: raw.session_thread_id }
          : {}),
      };
    case "agent.custom_tool_use":
      return {
        kind: "custom_tool_use",
        id: id ?? "",
        name: typeof raw.name === "string" ? raw.name : "",
        input: raw.input,
        ...(typeof raw.session_thread_id === "string"
          ? { sessionThreadId: raw.session_thread_id }
          : {}),
      };
    case "agent.tool_result":
    case "agent.mcp_tool_result":
      return {
        kind: "tool_result",
        ...(id ? { id } : {}),
        isError: raw.is_error === true,
        source: type === "agent.mcp_tool_result" ? "mcp" : "agent",
      };
    case "session.error":
    case "error": {
      const error = raw.error as { message?: unknown } | undefined;
      return {
        kind: "error",
        ...(id ? { id } : {}),
        message: typeof error?.message === "string" ? error.message : "session error",
      };
    }
    case "span.outcome_evaluation_start":
      return {
        kind: "outcome_start",
        ...(id ? { id } : {}),
        outcomeId: typeof raw.outcome_id === "string" ? raw.outcome_id : "",
        iteration: typeof raw.iteration === "number" ? raw.iteration : 0,
      };
    case "span.outcome_evaluation_ongoing":
      return {
        kind: "outcome_progress",
        ...(id ? { id } : {}),
        outcomeId: typeof raw.outcome_id === "string" ? raw.outcome_id : "",
      };
    case "span.outcome_evaluation_end":
      return {
        kind: "outcome_end",
        ...(id ? { id } : {}),
        outcomeId: typeof raw.outcome_id === "string" ? raw.outcome_id : "",
        iteration: typeof raw.iteration === "number" ? raw.iteration : 0,
        result: typeof raw.result === "string" ? raw.result : "failed",
        ...(typeof raw.explanation === "string" ? { explanation: raw.explanation } : {}),
      };
    case "session.thread_created":
      return {
        kind: "thread_created",
        ...(id ? { id } : {}),
        ...(typeof raw.session_thread_id === "string" ? { threadId: raw.session_thread_id } : {}),
        ...(typeof raw.agent_name === "string" ? { agentName: raw.agent_name } : {}),
      };
    case "agent.thread_message_sent":
      return {
        kind: "thread_message",
        ...(id ? { id } : {}),
        direction: "sent",
        ...(typeof raw.to_session_thread_id === "string" ? { threadId: raw.to_session_thread_id } : {}),
        ...(typeof raw.to_agent_name === "string" ? { agentName: raw.to_agent_name } : {}),
        text: textFromContent(raw.content),
      };
    case "agent.thread_message_received":
      return {
        kind: "thread_message",
        ...(id ? { id } : {}),
        direction: "received",
        ...(typeof raw.from_session_thread_id === "string" ? { threadId: raw.from_session_thread_id } : {}),
        ...(typeof raw.from_agent_name === "string" ? { agentName: raw.from_agent_name } : {}),
        text: textFromContent(raw.content),
      };
    default: {
      const threadStatus = threadStatusFromType(type);
      if (threadStatus) {
        const stopReason = raw.stop_reason;
        return {
          kind: "thread_status",
          ...(id ? { id } : {}),
          ...(typeof raw.session_thread_id === "string" ? { threadId: raw.session_thread_id } : {}),
          ...(typeof raw.agent_name === "string" ? { agentName: raw.agent_name } : {}),
          status: threadStatus,
          ...(stopReason && typeof stopReason === "object"
            ? { stopReason: stopReason as { type?: string } }
            : {}),
        };
      }
      const status = statusFromType(type);
      if (status) {
        const stopReason = raw.stop_reason;
        return {
          kind: "status",
          ...(id ? { id } : {}),
          status,
          ...(stopReason && typeof stopReason === "object"
            ? { stopReason: stopReason as { type?: string } }
            : {}),
        };
      }
      return { kind: "other", ...(id ? { id } : {}), type };
    }
  }
}

/** Parse one raw SSE frame (`{ data }`) into a typed session event. */
export function parseSessionEventData(sse: { data: string }): ManagedAgentSessionEvent | null {
  try {
    const raw = JSON.parse(sse.data);
    return raw && typeof raw === "object" ? parseSessionEvent(raw as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A tool call paused on an `always_ask` policy — answer with `confirmTool`. */
export function sessionEventNeedsConfirmation(
  ev: ManagedAgentSessionEvent,
): ev is ManagedAgentToolUseEvent {
  return ev.kind === "tool_use" && ev.evaluatedPermission === "ask";
}

/** A client-side custom tool call — answer with `respondCustomTool`. */
export function isCustomToolUseEvent(
  ev: ManagedAgentSessionEvent,
): ev is ManagedAgentCustomToolUseEvent {
  return ev.kind === "custom_tool_use";
}

/**
 * True when this event ends the run: a terminated status, or an idle status whose
 * `stop_reason` is anything other than `requires_action` (idle also fires
 * transiently while the session waits on a tool confirmation / custom-tool result).
 */
export function isTerminalSessionEvent(ev: ManagedAgentSessionEvent): boolean {
  if (ev.kind !== "status") return false;
  if (ev.status === "terminated") return true;
  return ev.status === "idle" && ev.stopReason?.type !== "requires_action";
}

/** A finished grader iteration (`satisfied` / `needs_revision` / `max_iterations_reached` / `failed` / `interrupted`). */
export function isOutcomeEndEvent(
  ev: ManagedAgentSessionEvent,
): ev is ManagedAgentOutcomeEndEvent {
  return ev.kind === "outcome_end";
}

/** Any subagent-thread event (created / status / cross-thread message). */
export function isThreadEvent(
  ev: ManagedAgentSessionEvent,
): ev is
  | ManagedAgentThreadCreatedEvent
  | ManagedAgentThreadStatusEvent
  | ManagedAgentThreadMessageEvent {
  return (
    ev.kind === "thread_created" ||
    ev.kind === "thread_status" ||
    ev.kind === "thread_message"
  );
}
