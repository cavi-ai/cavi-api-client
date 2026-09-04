import { describe, expect, it } from "vitest";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors";
import {
  mapOpenCodeMessageHistoryToRunStatus,
  mapOpenCodePromptResponseToRunStatus,
  parseOpenCodeHealthResponse,
  parseOpenCodeSessionStatusResponse,
  parseOpenCodeSessionResponse,
} from "../../../providers/opencode/response";

const session = { id: "ses_123", directory: "/workspace/project", version: "1.18.27" };

const assistantInfo = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_1",
  sessionID: "ses_123",
  role: "assistant",
  providerID: "openai",
  modelID: "gpt-5",
  ...overrides,
});

const assistantMessage = (overrides: Record<string, unknown> = {}, parts: unknown[] = []) => ({
  info: assistantInfo(overrides),
  parts,
});

describe("OpenCode response mapping", () => {
  it("accepts only the exact supported healthy server version", () => {
    expect(parseOpenCodeHealthResponse({ healthy: true, version: "1.18.27" })).toEqual({
      healthy: true,
      version: "1.18.27",
    });
    for (const value of [
      undefined,
      null,
      [],
      { healthy: false, version: "1.18.27" },
      { healthy: true, version: "1.18.26" },
      { healthy: true, version: "1.18.27", extra: true },
    ]) {
      expect(() => parseOpenCodeHealthResponse(value)).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch }),
      );
      expect(() => parseOpenCodeHealthResponse(value)).toThrowError(
        expect.objectContaining({ type: ApiClientErrorType.Transport }),
      );
    }
  });

  it("validates session identity, exact scope, and server version", () => {
    expect(parseOpenCodeSessionResponse(session, "/workspace/project")).toEqual(session);
    for (const value of [
      { ...session, id: "session_123" },
      { ...session, directory: "/other" },
      { ...session, version: "1.18.26" },
      { ...session, id: "" },
      { ...session, directory: 42 },
      { ...session, version: undefined },
    ]) {
      expect(() => parseOpenCodeSessionResponse(value, "/workspace/project")).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch }),
      );
      expect(() => parseOpenCodeSessionResponse(value, "/workspace/project")).toThrowError(
        expect.objectContaining({ type: ApiClientErrorType.Transport }),
      );
    }
  });

  it("concatenates text parts, ignores recognized non-text parts, and normalizes usage", () => {
    const result = mapOpenCodePromptResponseToRunStatus({
      info: {
        id: "msg_1",
        sessionID: "ses_123",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5/mini",
        tokens: {
          input: 12,
          output: 7,
          reasoning: 3,
          cache: { read: 2, write: 1 },
        },
      },
      parts: [
        { type: "text", text: "hello" },
        { type: "tool", callID: "call_1" },
        { type: "text", text: " world" },
        { type: "reasoning", text: "internal" },
      ],
    }, "ses_123");
    expect(result).toEqual({
      run_id: "ses_123",
      status: "completed",
      model: "openai/gpt-5/mini",
      output: "hello world",
      usage: {
        input_tokens: 12,
        output_tokens: 7,
        reasoning_tokens: 3,
        cache_read_input_tokens: 2,
        cache_creation_input_tokens: 1,
      },
      tokens: {
        inputTokens: 12,
        outputTokens: 7,
        totalTokens: 19,
        cacheReadTokens: 2,
        cacheWriteTokens: 1,
        raw: {
          input_tokens: 12,
          output_tokens: 7,
          reasoning_tokens: 3,
          cache_read_input_tokens: 2,
          cache_creation_input_tokens: 1,
        },
      },
    });
  });

  it("ignores every non-text part type in the pinned OpenAPI union", () => {
    const nonTextTypes = [
      "subtask",
      "reasoning",
      "file",
      "tool",
      "step-start",
      "step-finish",
      "snapshot",
      "patch",
      "agent",
      "retry",
      "compaction",
    ];
    const result = mapOpenCodePromptResponseToRunStatus({
      info: {
        id: "msg_1",
        sessionID: "ses_123",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5",
      },
      parts: [
        ...nonTextTypes.map((type) => ({ type })),
        { type: "text", text: "kept" },
      ],
    }, "ses_123");
    expect(result.output).toBe("kept");
  });

  it("rejects non-text part types outside the pinned OpenAPI union", () => {
    for (const type of ["redacted-reasoning", "source-url", "source-document"]) {
      expect(() => mapOpenCodePromptResponseToRunStatus({
        info: {
          id: "msg_1",
          sessionID: "ses_123",
          role: "assistant",
          providerID: "openai",
          modelID: "gpt-5",
        },
        parts: [{ type }],
      }, "ses_123")).toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch }));
    }
  });

  it("maps assistant errors to failed status with stable extraction", () => {
    expect(mapOpenCodePromptResponseToRunStatus({
      info: {
        id: "msg_2",
        sessionID: "ses_123",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5",
        error: { message: "rate limited" },
      },
      parts: [],
    }, "ses_123")).toMatchObject({
      run_id: "ses_123",
      status: "failed",
      error: "rate limited",
      model: "openai/gpt-5",
    });
    expect(mapOpenCodePromptResponseToRunStatus({
      info: {
        id: "msg_3",
        sessionID: "ses_123",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5",
        error: { reason: "provider rejected request" },
      },
      parts: [],
    }, "ses_123")).toMatchObject({ status: "failed", error: "provider rejected request" });
    expect(mapOpenCodePromptResponseToRunStatus({
      info: {
        id: "msg_4",
        sessionID: "ses_123",
        role: "assistant",
        providerID: "openai",
        modelID: "gpt-5",
        error: { data: { message: "nested failure" } },
      },
      parts: [],
    }, "ses_123")).toMatchObject({ status: "failed", error: "nested failure" });
  });

  it("rejects malformed token counters as protocol mismatches", () => {
    const base = {
      info: { id: "msg_1", sessionID: "ses_123", role: "assistant", providerID: "openai", modelID: "gpt-5" },
      parts: [],
    };
    const invalidTokens = [
      { input: "12" },
      { input: 1, output: 2, cache: "invalid" },
      { input: 1, output: 2, cache: { read: "2" } },
      { input: 1, output: "2" },
      { input: 1, output: 2, reasoning: null },
      { input: 1, output: 2, cache: { write: false } },
    ];
    for (const tokens of invalidTokens) {
      expect(() => mapOpenCodePromptResponseToRunStatus({ ...base, info: { ...base.info, tokens } }, "ses_123"))
        .toThrowError(expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch, type: ApiClientErrorType.Transport }));
    }
  });

  it("rejects incompatible prompt shapes, roles, and session IDs", () => {
    const valid = {
      info: { id: "msg_1", sessionID: "ses_123", role: "assistant", providerID: "openai", modelID: "gpt-5" },
      parts: [{ type: "text", text: "hello" }],
    };
    const invalid = [
      undefined,
      null,
      [],
      { ...valid, info: { ...valid.info, role: "user" } },
      { ...valid, info: { ...valid.info, sessionID: "ses_other" } },
      { ...valid, parts: undefined },
      { ...valid, parts: [{ type: "text", text: 42 }] },
      { ...valid, parts: [{ type: "future-part" }] },
      { ...valid, info: { ...valid.info, providerID: "" } },
      { ...valid, info: { ...valid.info, modelID: 42 } },
    ];
    for (const value of invalid) {
      expect(() => mapOpenCodePromptResponseToRunStatus(value, "ses_123")).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch }),
      );
      expect(() => mapOpenCodePromptResponseToRunStatus(value, "ses_123")).toThrowError(
        expect.objectContaining({ type: ApiClientErrorType.Transport }),
      );
    }
  });

  it("strictly parses only the requested session status", () => {
    expect(parseOpenCodeSessionStatusResponse({}, "ses_123")).toBeUndefined();
    expect(parseOpenCodeSessionStatusResponse({ unrelated: null }, "ses_123")).toBeUndefined();
    expect(parseOpenCodeSessionStatusResponse({ ses_123: { type: "idle" } }, "ses_123")).toEqual({ type: "idle" });
    expect(parseOpenCodeSessionStatusResponse({ ses_123: { type: "busy" } }, "ses_123")).toEqual({ type: "busy" });
    expect(parseOpenCodeSessionStatusResponse({ ses_123: { type: "retry", attempt: 2, message: "retrying", next: 1000 } }, "ses_123"))
      .toEqual({ type: "retry", attempt: 2, message: "retrying", next: 1000 });

    for (const value of [
      undefined,
      null,
      [],
      { ses_123: null },
      { ses_123: [] },
      { ses_123: { type: "idle", extra: true } },
      { ses_123: { type: "busy", attempt: 1 } },
      { ses_123: { type: "unknown" } },
      { ses_123: { type: "retry" } },
      { ses_123: { type: "retry", attempt: Infinity, message: "retrying", next: 1000 } },
      { ses_123: { type: "retry", attempt: 1, message: " ", next: 1000 } },
      { ses_123: { type: "retry", attempt: 1, message: "retrying", next: "later" } },
      { ses_123: { type: "retry", attempt: 1, message: "retrying", next: 1000, extra: true } },
    ]) {
      expect(() => parseOpenCodeSessionStatusResponse(value, "ses_123")).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch, type: ApiClientErrorType.Transport }),
      );
    }
  });

  it("selects the newest terminal assistant message, using array order to break time ties", () => {
    const result = mapOpenCodeMessageHistoryToRunStatus([
      assistantMessage({ id: "old", time: { created: 20, completed: 21 } }, [{ type: "text", text: "old" }]),
      { info: { sessionID: "ses_123", role: "user", time: { created: 30 } }, parts: [] },
      assistantMessage({ id: "newer", time: { created: 30, completed: 31 } }, [{ type: "text", text: "first tie" }]),
      assistantMessage({ id: "latest", time: { created: 30, completed: 32 } }, [{ type: "text", text: "second tie" }]),
      assistantMessage({ id: "older-late", time: { created: 25, completed: 26 } }, [{ type: "text", text: "older late" }]),
    ], "ses_123");
    expect(result).toMatchObject({
      run_id: "ses_123",
      status: "completed",
      output: "second tie",
    });
  });

  it("maps the newest assistant error as terminal failure without completion time", () => {
    expect(mapOpenCodeMessageHistoryToRunStatus([
      assistantMessage({ time: { created: 10 }, error: { message: "failed" } }),
    ], "ses_123")).toMatchObject({
      run_id: "ses_123",
      status: "failed",
      error: "failed",
    });
  });

  it("returns an honest unknown status when no assistant terminal evidence exists", () => {
    expect(mapOpenCodeMessageHistoryToRunStatus([
      assistantMessage({ time: { created: 10 } }, [{ type: "text", text: "still working" }]),
    ], "ses_123")).toEqual({
      run_id: "ses_123",
      status: "unknown",
      error: "opencode: no terminal assistant message",
    });
    expect(mapOpenCodeMessageHistoryToRunStatus([
      assistantMessage({ time: { created: 10, completed: 11 } }),
      assistantMessage({ id: "latest", time: { created: 20 } }),
    ], "ses_123")).toEqual({
      run_id: "ses_123",
      status: "unknown",
      error: "opencode: no terminal assistant message",
    });
  });

  it("rejects malformed history records, contradictory identities, invalid times, and unknown parts", () => {
    const malformed = [
      undefined,
      null,
      {},
      [null],
      [{ info: assistantInfo(), parts: [], extra: true }],
      [{ info: null, parts: [] }],
      [{ info: { sessionID: "ses_other", role: "assistant", time: { created: 1 } }, parts: [] }],
      [{ info: { sessionID: "ses_123", role: "assistant", time: { created: "later" } }, parts: [] }],
      [{ info: { sessionID: "ses_123", role: "assistant", time: { completed: NaN } }, parts: [] }],
      [{ info: { sessionID: "ses_123", role: "assistant" }, parts: [{ type: "future-part" }] }],
      [{ info: { sessionID: "ses_123", role: "assistant" }, parts: [{ type: "text", text: 42 }] }],
    ];
    for (const value of malformed) {
      expect(() => mapOpenCodeMessageHistoryToRunStatus(value, "ses_123")).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ProtocolMismatch, type: ApiClientErrorType.Transport }),
      );
    }
  });
});
