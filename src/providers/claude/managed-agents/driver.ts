import { parseSseBlock, takeNextSseBlock } from "../../../core/sse/index.js";
import type {
  ConfirmToolParams,
  ManagedAgentEvent,
  RespondCustomToolParams,
} from "./client.js";
import {
  isCustomToolUseEvent,
  isOutcomeEndEvent,
  isTerminalSessionEvent,
  isThreadEvent,
  parseSessionEvent,
  parseSessionEventData,
  sessionEventNeedsConfirmation,
  type ManagedAgentCustomToolUseEvent,
  type ManagedAgentMessageEvent,
  type ManagedAgentOutcomeEndEvent,
  type ManagedAgentSessionEvent,
  type ManagedAgentThreadCreatedEvent,
  type ManagedAgentThreadMessageEvent,
  type ManagedAgentThreadStatusEvent,
  type ManagedAgentToolUseEvent,
} from "./events.js";

type ThreadEvent =
  | ManagedAgentThreadCreatedEvent
  | ManagedAgentThreadStatusEvent
  | ManagedAgentThreadMessageEvent;

/**
 * Interactive session driver — the steering loop the simple `streamRun` path
 * deliberately omits. It tails a session's SSE stream, answers `always_ask` tool
 * confirmations and custom-tool calls via caller-supplied handlers, survives
 * dropped streams with lossless reconnect, and dedupes so no event is double-
 * handled and no tool is double-answered.
 *
 * Deadlock-safe by construction: a tool-use id is marked `responded` only AFTER
 * its response send succeeds. If the stream drops mid-handler (before the
 * confirmation/result is sent), reconnect re-lists history, re-sees the request,
 * finds it un-responded, and answers it — instead of skipping it and hanging.
 */

/** The subset of `ClaudeManagedAgentClient` the driver needs (eases testing). */
export interface ManagedAgentDriverClient {
  openEventStream(sessionId: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>>;
  listEvents(sessionId: string): Promise<ManagedAgentEvent[]>;
  confirmTool(sessionId: string, params: ConfirmToolParams): Promise<void>;
  respondCustomTool(sessionId: string, params: RespondCustomToolParams): Promise<void>;
}

export type ToolConfirmationDecision = { result: "allow" | "deny"; denyMessage?: string };
export type CustomToolResponse = {
  content: readonly Record<string, unknown>[];
  isError?: boolean;
};

export type ManagedAgentDriverHandlers = {
  /** Every parsed event, in order (deduped — fires once per event id). */
  onEvent?: (event: ManagedAgentSessionEvent) => void | Promise<void>;
  /** Convenience for agent text output. */
  onMessage?: (text: string, event: ManagedAgentMessageEvent) => void;
  /** Decide an `always_ask` tool call. Omit → deny (the agent can adapt). */
  onToolConfirmation?: (
    request: ManagedAgentToolUseEvent,
  ) => ToolConfirmationDecision | Promise<ToolConfirmationDecision>;
  /** Execute a custom tool. Omit → respond with an error (an unanswered custom tool blocks the session). */
  onCustomTool?: (
    request: ManagedAgentCustomToolUseEvent,
  ) => CustomToolResponse | Promise<CustomToolResponse>;
  /** A finished grader iteration of a rubric-graded outcome. */
  onOutcomeEvaluation?: (event: ManagedAgentOutcomeEndEvent) => void;
  /** Subagent-thread activity in a multiagent session (created / status / cross-thread message). */
  onThreadEvent?: (event: ThreadEvent) => void;
  /** Fired once when the session reaches a terminal state (or reconnects are exhausted). */
  onComplete?: () => void;
  /** Transport error after reconnects are exhausted (lifecycle errors arrive via onEvent). */
  onError?: (error: unknown) => void;
};

export type ManagedAgentDriverOptions = {
  signal?: AbortSignal;
  /** Reconnect attempts after a dropped stream before giving up. Default 2. */
  maxReconnects?: number;
};

const DEFAULT_DENY: ToolConfirmationDecision = {
  result: "deny",
  denyMessage: "no confirmation handler registered",
};
const DEFAULT_CUSTOM_TOOL_ERROR: CustomToolResponse = {
  content: [{ type: "text", text: "no custom tool handler registered" }],
  isError: true,
};

/** Read an SSE body, invoking `onFrame` per event; returns true if a frame was terminal. */
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal | undefined,
  onFrame: (sse: { data: string }) => Promise<boolean>,
): Promise<boolean> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  const onAbort = (): void => {
    try {
      void reader.cancel();
    } catch {
      // best effort
    }
  };
  signal?.addEventListener("abort", onAbort);
  const drain = async (final: boolean): Promise<boolean> => {
    let next = takeNextSseBlock(buffer);
    while (next) {
      buffer = next.rest;
      const msg = parseSseBlock(next.block);
      if (msg && (await onFrame(msg))) {
        void reader.cancel();
        return true;
      }
      next = takeNextSseBlock(buffer);
    }
    if (final) {
      const trailing = parseSseBlock(buffer);
      if (trailing && (await onFrame(trailing))) return true;
    }
    return false;
  };
  try {
    while (true) {
      if (signal?.aborted) return false;
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        return await drain(true);
      }
      buffer += decoder.decode(value, { stream: true });
      if (await drain(false)) return true;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Drive an existing session: tail its events, answer tool/custom-tool requests,
 * and resolve when the session reaches a terminal state. Open the stream on a
 * session you've already created (and, for a fresh run, after sending the first
 * `user.message` — or use `client.sendMessage` once the driver is running).
 */
export async function driveManagedAgentSession(
  client: ManagedAgentDriverClient,
  sessionId: string,
  handlers: ManagedAgentDriverHandlers = {},
  options: ManagedAgentDriverOptions = {},
): Promise<void> {
  const { signal } = options;
  const maxReconnects = options.maxReconnects ?? 2;
  const dispatched = new Set<string>();
  const responded = new Set<string>();
  let reconnects = 0;

  const answerConfirmation = async (event: ManagedAgentToolUseEvent): Promise<void> => {
    if (!event.id || responded.has(event.id)) return;
    const decision = handlers.onToolConfirmation
      ? await handlers.onToolConfirmation(event)
      : DEFAULT_DENY;
    await client.confirmTool(sessionId, {
      toolUseId: event.id,
      result: decision.result,
      ...(decision.denyMessage ? { denyMessage: decision.denyMessage } : {}),
      ...(event.sessionThreadId ? { sessionThreadId: event.sessionThreadId } : {}),
    });
    responded.add(event.id); // only after the send succeeds — drop-safe
  };

  const answerCustomTool = async (event: ManagedAgentCustomToolUseEvent): Promise<void> => {
    if (!event.id || responded.has(event.id)) return;
    const response = handlers.onCustomTool
      ? await handlers.onCustomTool(event)
      : DEFAULT_CUSTOM_TOOL_ERROR;
    await client.respondCustomTool(sessionId, {
      toolUseId: event.id,
      content: response.content,
      ...(response.isError ? { isError: true } : {}),
      ...(event.sessionThreadId ? { sessionThreadId: event.sessionThreadId } : {}),
    });
    responded.add(event.id); // only after the send succeeds — drop-safe
  };

  // Returns true when the event ends the run.
  const handleEvent = async (event: ManagedAgentSessionEvent): Promise<boolean> => {
    const fresh = !event.id || !dispatched.has(event.id);
    if (fresh) {
      if (event.id) dispatched.add(event.id);
      await handlers.onEvent?.(event);
      if (event.kind === "message") handlers.onMessage?.(event.text, event);
      if (isOutcomeEndEvent(event)) handlers.onOutcomeEvaluation?.(event);
      else if (isThreadEvent(event)) handlers.onThreadEvent?.(event);
    }
    // Tool answers are gated on `responded`, not `dispatched`, so a request seen
    // again after a mid-send reconnect still gets answered.
    if (sessionEventNeedsConfirmation(event)) await answerConfirmation(event);
    else if (isCustomToolUseEvent(event)) await answerCustomTool(event);
    return isTerminalSessionEvent(event);
  };

  while (true) {
    if (signal?.aborted) return;
    try {
      const body = await client.openEventStream(sessionId, signal); // stream-first
      let consumed = false;
      try {
        // History first (covers any gap before the stream attached); deduped.
        for (const raw of await client.listEvents(sessionId)) {
          const event = parseSessionEvent(raw);
          if (event && (await handleEvent(event))) {
            handlers.onComplete?.();
            return;
          }
        }
        consumed = true;
        const terminal = await readSseStream(body, signal, (sse) => {
          const event = parseSessionEventData(sse);
          return event ? handleEvent(event) : Promise.resolve(false);
        });
        if (terminal) {
          handlers.onComplete?.();
          return;
        }
      } finally {
        if (!consumed) {
          try {
            void body.cancel();
          } catch {
            // best effort
          }
        }
      }
      // Stream closed without a terminal event.
      if (signal?.aborted) return;
      if (reconnects++ >= maxReconnects) {
        handlers.onComplete?.();
        return;
      }
    } catch (error) {
      if (signal?.aborted) return;
      if (reconnects++ >= maxReconnects) {
        if (handlers.onError) {
          handlers.onError(error);
          return;
        }
        throw error;
      }
      // otherwise loop and reconnect
    }
  }
}
