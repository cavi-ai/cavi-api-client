import { describe, expect, it } from "vitest";
import { ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";
import { parseOpenCodeEvent, translateOpenCodeEvent } from "../../../providers/opencode/stream";

const RUN = "ses_run_1";

function frame(type: string, properties: unknown): string {
  return JSON.stringify({ type, properties });
}

function delta(properties: Record<string, unknown> = {}): string {
  return frame("message.part.delta", {
    sessionID: RUN,
    messageID: "msg_1",
    partID: "part_1",
    field: "text",
    delta: "hello",
    ...properties,
  });
}

function info(properties: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "msg_1",
    sessionID: RUN,
    role: "assistant",
    time: { created: 1 },
    ...properties,
  };
}

describe("parseOpenCodeEvent", () => {
  it("parses one well-formed SSE data payload and preserves unknown event types", () => {
    expect(parseOpenCodeEvent(frame("future.event", { value: 1 }))).toEqual({
      type: "future.event",
      properties: { value: 1 },
    });
  });

  it.each([
    "not json",
    "null",
    "[]",
    JSON.stringify({ properties: {} }),
    JSON.stringify({ type: 42, properties: {} }),
  ])("rejects malformed top-level payload %j", (data) => {
    expect(() => parseOpenCodeEvent(data)).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });

  it.each([
    ["message.part.delta", { sessionID: RUN, messageID: "msg_1", partID: "part_1", field: "text" }],
    ["session.idle", {}],
    ["message.updated", { sessionID: RUN, info: { sessionID: RUN } }],
    ["message.updated", { info: info() }],
  ])("rejects malformed recognized event %s", (type, properties) => {
    expect(() => parseOpenCodeEvent(frame(type, properties))).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });

  it.each([
    ["server.connected", []],
    ["message.part.delta", { sessionID: 1, messageID: "msg_1", partID: "part_1", field: "text", delta: "x" }],
    ["session.idle", { sessionID: 1 }],
    ["session.error", { sessionID: 1, error: "boom" }],
    ["message.updated", { sessionID: RUN, info: [] }],
  ])("rejects a wrong property type for recognized event %s", (type, properties) => {
    expect(() => parseOpenCodeEvent(frame(type, properties))).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });

  it.each([
    ["server.connected", { unexpected: true }],
    ["message.part.delta", { sessionID: RUN, messageID: "msg_1", partID: "part_1", field: "text", delta: "x", unexpected: true }],
    ["session.idle", { sessionID: RUN, unexpected: true }],
    ["session.error", { sessionID: RUN, error: "boom", unexpected: true }],
    ["message.updated", { sessionID: RUN, info: info(), unexpected: true }],
  ])("rejects unexpected properties for recognized event %s", (type, properties) => {
    expect(() => parseOpenCodeEvent(frame(type, properties))).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });

  it.each([
    ["direct string", "boom", "boom"],
    ["reason", { reason: "because" }, "because"],
    ["non-informative object", { code: "E_FAIL" }, '{"code":"E_FAIL"}'],
    ["absent error", undefined, "opencode session error"],
  ])("extracts a stable session.error message from %s", (_label, error, expected) => {
    expect(
      translateOpenCodeEvent(
        parseOpenCodeEvent(frame("session.error", { sessionID: RUN, ...(error === undefined ? {} : { error }) })),
        RUN,
        { promptAccepted: true },
      ),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: expected });
  });

  it.each([
    {},
    { sessionID: RUN },
    { error: "boom" },
    { sessionID: RUN, error: "boom" },
  ])("accepts schema-valid session.error properties %#", (properties) => {
    expect(parseOpenCodeEvent(frame("session.error", properties))).toMatchObject({
      type: "session.error",
      properties,
    });
  });

  it.each([
    { time: "not a record" },
    { time: { created: 1, completed: "later" } },
    { role: "system" },
  ])("rejects malformed nested message.updated info %#", (nested) => {
    expect(() => parseOpenCodeEvent(frame("message.updated", { sessionID: RUN, info: info(nested) }))).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });

  it("rejects contradictory outer and inner message.updated session IDs", () => {
    expect(() => parseOpenCodeEvent(frame("message.updated", { sessionID: "ses_outer", info: info() }))).toThrowError(
      expect.objectContaining({
        code: ApiClientErrorCode.ProtocolMismatch,
        type: ApiClientErrorType.Transport,
      }),
    );
  });
});

describe("translateOpenCodeEvent", () => {
  it("maps a same-session text delta with the canonical ordered event shape", () => {
    const event = translateOpenCodeEvent(parseOpenCodeEvent(delta()), RUN, { promptAccepted: true });
    expect(event).toEqual({ event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: RUN, delta: "hello" });
  });

  it("ignores foreign, non-text, and empty deltas", () => {
    expect(translateOpenCodeEvent(parseOpenCodeEvent(delta({ sessionID: "ses_other" })), RUN, { promptAccepted: true })).toBeNull();
    expect(translateOpenCodeEvent(parseOpenCodeEvent(delta({ field: "reasoning" })), RUN, { promptAccepted: true })).toBeNull();
    expect(translateOpenCodeEvent(parseOpenCodeEvent(delta({ delta: "" })), RUN, { promptAccepted: true })).toBeNull();
  });

  it("ignores server connected, tool, permission, and unknown events", () => {
    for (const event of [
      frame("server.connected", {}),
      frame("tool.execute", { sessionID: RUN }),
      frame("permission.asked", { sessionID: RUN }),
      frame("future.event", { sessionID: RUN }),
    ]) {
      expect(translateOpenCodeEvent(parseOpenCodeEvent(event), RUN, { promptAccepted: true })).toBeNull();
    }
  });

  it("does not synthesize completion from an initial idle before prompt acceptance", () => {
    const parsed = parseOpenCodeEvent(frame("session.idle", { sessionID: RUN }));
    expect(translateOpenCodeEvent(parsed, RUN, { promptAccepted: false })).toBeNull();
    expect(translateOpenCodeEvent(parsed, RUN, { promptAccepted: true })).toEqual({
      event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
      runId: RUN,
    });
  });

  it("ignores foreign session idle events", () => {
    expect(
      translateOpenCodeEvent(parseOpenCodeEvent(frame("session.idle", { sessionID: "ses_other" })), RUN, { promptAccepted: true }),
    ).toBeNull();
  });

  it("maps a same-session session error to run.failed with stable message extraction", () => {
    const event = translateOpenCodeEvent(
      parseOpenCodeEvent(frame("session.error", { sessionID: RUN, error: { data: { message: "boom" } } })),
      RUN,
      { promptAccepted: true },
    );
    expect(event).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: "boom" });
  });

  it("ignores foreign session errors", () => {
    expect(
      translateOpenCodeEvent(
        parseOpenCodeEvent(frame("session.error", { sessionID: "ses_other", error: { message: "boom" } })),
        RUN,
        { promptAccepted: true },
      ),
    ).toBeNull();
  });

  it("ignores global session errors that have no correlating session ID", () => {
    for (const properties of [{}, { error: "boom" }]) {
      expect(
        translateOpenCodeEvent(parseOpenCodeEvent(frame("session.error", properties)), RUN, { promptAccepted: true }),
      ).toBeNull();
    }
  });

  it("maps a same-session assistant message.updated completion", () => {
    expect(
      translateOpenCodeEvent(parseOpenCodeEvent(frame("message.updated", { sessionID: RUN, info: info({ time: { created: 1, completed: 2 } }) })), RUN, { promptAccepted: true }),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: RUN });
  });

  it("maps a same-session assistant message.updated error to run.failed", () => {
    expect(
      translateOpenCodeEvent(parseOpenCodeEvent(frame("message.updated", { sessionID: RUN, info: info({ error: { message: "failed" } }) })), RUN, { promptAccepted: true }),
    ).toEqual({ event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: RUN, error: "failed" });
  });

  it("ignores nonterminal, foreign, and non-assistant message updates", () => {
    expect(translateOpenCodeEvent(parseOpenCodeEvent(frame("message.updated", { sessionID: RUN, info: info() })), RUN, { promptAccepted: true })).toBeNull();
    expect(translateOpenCodeEvent(parseOpenCodeEvent(frame("message.updated", { sessionID: "ses_other", info: info({ sessionID: "ses_other", time: { completed: 2 } }) })), RUN, { promptAccepted: true })).toBeNull();
    expect(translateOpenCodeEvent(parseOpenCodeEvent(frame("message.updated", { sessionID: RUN, info: info({ role: "user", time: { completed: 2 } }) })), RUN, { promptAccepted: true })).toBeNull();
  });
});
