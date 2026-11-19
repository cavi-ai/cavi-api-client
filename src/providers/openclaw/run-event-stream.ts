import {
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import { readNativeRunErrorDetails } from "../../core/runtime/run-error-details.js";
import type { OpenClawRpc, OpenClawRpcEvent } from "./control-plane/rpc.js";

/**
 * OpenClaw run events are delivered over the shared socket as native `chat`
 * and `agent` frames keyed by `runId` — a different vocabulary from the
 * control-plane `operation.*` frames. `chat` frames are the canonical run
 * surface (clean `state` + `deltaText` + terminal `message`); `agent`
 * lifecycle frames provide a terminal fallback. Both are keyed by `runId`, so
 * a single shared subscription fans out to every in-flight run by id.
 *
 * Verified against a live gateway (2026-07-23):
 *   chat  { runId, state:"delta", deltaText:"p", message } → message.delta
 *   chat  { runId, state:"final", message:{content:[{type:"text",text}]} } → run.completed
 *   agent { runId, stream:"lifecycle", data:{phase:"end"} } → run.completed
 *   agent { runId, stream:"lifecycle", data:{phase:"error"} } → run.failed
 */
export function createOpenClawRunNativeEventStream(
  rpc: OpenClawRpc,
): RunEventStreamProvider {
  // One native socket listener fans out to every in-flight run by id, so N
  // concurrent streamRun subscriptions share a single `rpc.subscribe` (R11).
  const subscribers = new Set<{ runId: string; handlers: RunEventStreamHandlers }>();
  let detachNative: (() => void) | undefined;

  return {
    async subscribe(
      params: RunEventStreamSubscribeParams,
      handlers: RunEventStreamHandlers,
    ): Promise<RunEventStreamSubscription> {
      const entry = { runId: params.runId, handlers };
      subscribers.add(entry);
      detachNative ??= rpc.subscribe((native) => {
        for (const sub of [...subscribers]) {
          const event = translateOpenClawRunEvent(native, sub.runId);
          if (event) sub.handlers.onEvent(event);
        }
      });

      let disposed = false;
      return {
        dispose: () => {
          if (disposed) return;
          disposed = true;
          subscribers.delete(entry);
          if (subscribers.size === 0) {
            detachNative?.();
            detachNative = undefined;
          }
        },
      };
    },
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/** Concatenate the text parts of an OpenClaw assistant message payload. */
function messageText(message: unknown): string | undefined {
  const record = asRecord(message);
  const content = record?.content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return undefined;
  let hasTextPart = false;
  let text = "";
  for (const part of content) {
    const p = asRecord(part);
    if (p && p.type === "text" && typeof p.text === "string") {
      hasTextPart = true;
      text += p.text;
    }
  }
  return hasTextPart ? text : undefined;
}

/**
 * Translate a native OpenClaw run frame onto the canonical run-stream union.
 * Frames for a different run (or with no run-visible projection) map to null.
 */
export function translateOpenClawRunEvent(
  native: OpenClawRpcEvent,
  runId: string,
): RunStreamEvent | null {
  const payload = asRecord(native.payload);
  if (!payload || payload.runId !== runId) return null;

  if (native.event === "chat") {
    switch (payload.state) {
      case "delta": {
        const delta = optionalString(payload.deltaText);
        return delta ? { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId, delta } : null;
      }
      case "final": {
        const output = messageText(payload.message);
        return {
          event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
          runId,
          ...(output !== undefined ? { output } : {}),
        };
      }
      case "error": {
        const errorDetails =
          readNativeRunErrorDetails(payload.errorDetails) ??
          readNativeRunErrorDetails(payload.error) ??
          readNativeRunErrorDetails(payload);
        return {
          event: RUN_STREAM_EVENT_NAMES.RUN_FAILED,
          runId,
          error:
            nonEmptyString(payload.errorMessage) ??
            nonEmptyString(payload.error) ??
            "run failed",
          ...(errorDetails ? { errorDetails } : {}),
        };
      }
      case "cancelled":
      case "canceled":
      case "aborted":
        return { event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED, runId };
      default:
        return null;
    }
  }

  if (native.event === "agent" && payload.stream === "lifecycle") {
    const phase = asRecord(payload.data)?.phase;
    if (phase === "end") return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId };
    if (phase === "error")
      return { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId, error: "run failed" };
    if (phase === "cancel" || phase === "cancelled" || phase === "aborted")
      return { event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED, runId };
  }

  return null;
}
