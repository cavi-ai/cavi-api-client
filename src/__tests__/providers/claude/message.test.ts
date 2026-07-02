import { describe, expect, it } from "vitest";
import {
  buildAnthropicMessageParams,
  mapAnthropicMessageToRunStatus,
} from "../../../providers/claude/message";

describe("buildAnthropicMessageParams", () => {
  it("throws ValidationFailed when no model is resolvable", () => {
    expect(() => buildAnthropicMessageParams({ input: "hi" }, { defaultMaxTokens: 4096 })).toThrow(/model is required/);
  });

  it("builds params from a string input + defaults, with system + tools", () => {
    const params = buildAnthropicMessageParams(
      { input: "hi", instructions: "be terse", tools: [{ name: "t" }] },
      { defaultModel: "claude-opus-4-8", defaultMaxTokens: 4096 },
    );
    expect(params).toEqual({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      messages: [{ role: "user", content: "hi" }],
      system: "be terse",
      tools: [{ name: "t" }],
    });
  });

  it("honors metadata.max_tokens and a message-array input", () => {
    const params = buildAnthropicMessageParams(
      { input: [{ role: "user", content: "q" }], model: "m", metadata: { max_tokens: 128 } },
      { defaultMaxTokens: 4096 },
    );
    expect(params).toMatchObject({ model: "m", max_tokens: 128, messages: [{ role: "user", content: "q" }] });
  });
});

describe("mapAnthropicMessageToRunStatus", () => {
  it("maps content/usage into a run status with normalized tokens", () => {
    const status = mapAnthropicMessageToRunStatus({
      id: "msg_1",
      model: "claude-opus-4-8",
      stop_reason: "end_turn",
      content: [{ type: "text", text: "ok" }],
      usage: { input_tokens: 10, output_tokens: 4 },
    });
    expect(status).toMatchObject({
      run_id: "msg_1",
      status: "completed",
      output: "ok",
      tokens: { inputTokens: 10, outputTokens: 4, totalTokens: 14 },
    });
  });
});
