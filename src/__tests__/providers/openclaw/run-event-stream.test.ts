import { describe, expect, it, vi } from "vitest";
import {
  createOpenClawRunNativeEventStream,
  translateOpenClawRunEvent,
} from "../../../providers/openclaw/run-event-stream.js";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream.js";
import type { OpenClawRpc, OpenClawRpcEvent } from "../../../providers/openclaw/control-plane/rpc.js";

const RUN = "cavi-run-1784849223806-1";

// Payloads captured verbatim from a live OpenClaw gateway (2026-07-23) so this
// can never drift from the wire shape again.
const LIVE = {
  lifecycleStart: {
    event: "agent",
    payload: { runId: RUN, agentId: "tony", stream: "lifecycle", data: { phase: "start", startedAt: 1 }, seq: 1 },
  },
  chatDelta1: {
    event: "chat",
    payload: { runId: RUN, agentId: "tony", seq: 2, state: "delta", deltaText: "p", message: { role: "assistant", content: [{ type: "text", text: "p" }] } },
  },
  chatDelta2: {
    event: "chat",
    payload: { runId: RUN, seq: 4, state: "delta", deltaText: "ong", message: { role: "assistant", content: [{ type: "text", text: "pong" }] } },
  },
  lifecycleEnd: {
    event: "agent",
    payload: { runId: RUN, stream: "lifecycle", data: { phase: "end", endedAt: 3 }, seq: 5 },
  },
  chatFinal: {
    event: "chat",
    payload: { runId: RUN, seq: 5, state: "final", message: { role: "assistant", content: [{ type: "text", text: "pong" }] } },
  },
  health: { event: "health", payload: { ok: true, ts: 1 } },
  tick: { event: "tick", payload: { ts: 1 } },
} satisfies Record<string, OpenClawRpcEvent>;

describe("translateOpenClawRunEvent", () => {
  it("maps live chat delta frames to message.delta", () => {
    expect(translateOpenClawRunEvent(LIVE.chatDelta1, RUN)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      runId: RUN,
      delta: "p",
    });
    expect(translateOpenClawRunEvent(LIVE.chatDelta2, RUN)).toMatchObject({
      event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
      delta: "ong",
    });
  });

  it("maps chat final to run.completed with the assembled message text", () => {
    expect(translateOpenClawRunEvent(LIVE.chatFinal, RUN)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: RUN,
      output: "pong",
    });
  });

  it("maps agent lifecycle end to run.completed and error/cancel to their terminals", () => {
    expect(translateOpenClawRunEvent(LIVE.lifecycleEnd, RUN)).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: RUN,
    });
    const err = { event: "agent", payload: { runId: RUN, stream: "lifecycle", data: { phase: "error" } } };
    expect(translateOpenClawRunEvent(err, RUN)).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED });
    const cancel = { event: "agent", payload: { runId: RUN, stream: "lifecycle", data: { phase: "cancel" } } };
    expect(translateOpenClawRunEvent(cancel, RUN)).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_CANCELLED });
  });

  it("ignores heartbeat/health frames and lifecycle start (no run-stream projection)", () => {
    expect(translateOpenClawRunEvent(LIVE.health, RUN)).toBeNull();
    expect(translateOpenClawRunEvent(LIVE.tick, RUN)).toBeNull();
    expect(translateOpenClawRunEvent(LIVE.lifecycleStart, RUN)).toBeNull();
  });

  it("ignores frames for a different run", () => {
    expect(translateOpenClawRunEvent(LIVE.chatDelta1, "other-run")).toBeNull();
  });
});

describe("createOpenClawRunNativeEventStream", () => {
  it("forwards translated frames for the subscribed run and detaches on dispose", async () => {
    let listener: ((e: OpenClawRpcEvent) => void) | null = null;
    const detach = vi.fn();
    const rpc = {
      subscribe: (l: (e: OpenClawRpcEvent) => void) => {
        listener = l;
        return detach;
      },
    } as unknown as OpenClawRpc;

    const seen: string[] = [];
    const sub = await createOpenClawRunNativeEventStream(rpc).subscribe(
      { runId: RUN },
      { onEvent: (e) => seen.push(e.event) },
    );
    listener!(LIVE.chatDelta1); // delivered
    listener!(LIVE.health); // dropped
    listener!(LIVE.chatFinal); // delivered
    expect(seen).toEqual([RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, RUN_STREAM_EVENT_NAMES.RUN_COMPLETED]);

    await sub.dispose();
    expect(detach).toHaveBeenCalledTimes(1);
    await sub.dispose(); // idempotent
    expect(detach).toHaveBeenCalledTimes(1);
  });
});
