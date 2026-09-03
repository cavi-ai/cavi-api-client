import { describe, expect, it } from "vitest";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors";
import {
  mapOpenCodePromptResponseToRunStatus,
  parseOpenCodeHealthResponse,
  parseOpenCodeSessionResponse,
} from "../../../providers/opencode/response";

const session = { id: "ses_123", directory: "/workspace/project", version: "1.18.27" };

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
});
