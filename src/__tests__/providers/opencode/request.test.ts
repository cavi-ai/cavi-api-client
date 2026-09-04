import { describe, expect, it } from "vitest";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors";
import { buildOpenCodePromptBody } from "../../../providers/opencode/request";

describe("OpenCode request mapping", () => {
  it("maps text, system instructions, and provider/model on the wire", () => {
    expect(buildOpenCodePromptBody({
      input: "  preserve this text  ",
      instructions: "Be precise",
      model: "openai/gpt-5/mini",
    })).toEqual({
      parts: [{ type: "text", text: "  preserve this text  " }],
      model: { providerID: "openai", modelID: "gpt-5/mini" },
      system: "Be precise",
    });
  });

  it("uses a validated default model only when model is omitted", () => {
    expect(buildOpenCodePromptBody({ input: "hello" }, "anthropic/claude-sonnet")).toEqual({
      parts: [{ type: "text", text: "hello" }],
      model: { providerID: "anthropic", modelID: "claude-sonnet" },
    });
    expect(buildOpenCodePromptBody({ input: "hello", model: "google/gemini" }, "anthropic/claude-sonnet").model)
      .toEqual({ providerID: "google", modelID: "gemini" });
  });

  it("accepts explicitly empty tools and metadata containers", () => {
    expect(buildOpenCodePromptBody({ input: "hello", tools: [], metadata: {} })).toEqual({
      parts: [{ type: "text", text: "hello" }],
    });
  });

  it("rejects unsupported or malformed universal input with ValidationFailed", () => {
    const invalid = [
      { input: "" },
      { input: "   " },
      { input: [{ role: "user", content: "hello" }] },
      { input: "hello", tools: [{ name: "search" }] },
      { input: "hello", metadata: { traceId: "x" } },
      { input: "hello", model: "provider" },
      { input: "hello", model: "/model" },
      { input: "hello", model: "provider/" },
    ];
    for (const request of invalid) {
      expect(() => buildOpenCodePromptBody(request as never)).toThrowError(
        expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }),
      );
      expect(() => buildOpenCodePromptBody(request as never)).toThrowError(
        expect.objectContaining({ type: ApiClientErrorType.Validation }),
      );
      expect(() => buildOpenCodePromptBody(request as never)).toThrowError(ApiClientError);
    }
  });

  it("rejects invalid defaults and does not emit blank optional fields", () => {
    expect(() => buildOpenCodePromptBody({ input: "hello" }, "provider")).toThrowError(
      expect.objectContaining({ code: ApiClientErrorCode.ValidationFailed }),
    );
    expect(buildOpenCodePromptBody({ input: "hello", instructions: "   " })).toEqual({
      parts: [{ type: "text", text: "hello" }],
    });
  });
});
