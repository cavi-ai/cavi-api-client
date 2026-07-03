import { describe, expect, it } from "vitest";
import {
  buildCodexResponseBody,
  mapOpenAIResponseToRunStatus,
} from "../../../providers/codex/response";

describe("buildCodexResponseBody", () => {
  it("includes background/store/stream only when requested (run path)", () => {
    const body = buildCodexResponseBody(
      { input: "hi", instructions: "be terse", tools: [{ type: "function", name: "t" }], metadata: { trace: "1" } },
      "gpt-5-codex",
      { background: true, store: true },
    );
    expect(body).toEqual({
      model: "gpt-5-codex",
      input: "hi",
      background: true,
      store: true,
      instructions: "be terse",
      tools: [{ type: "function", name: "t" }],
      metadata: { trace: "1" },
    });
  });

  it("omits background/store/stream for batch lines (default options)", () => {
    const body = buildCodexResponseBody({ input: "hi", model: "m" }, "gpt-5-codex", {});
    expect(body).toEqual({ model: "m", input: "hi" });
    expect("background" in body).toBe(false);
    expect("store" in body).toBe(false);
    expect("stream" in body).toBe(false);
  });
});

describe("mapOpenAIResponseToRunStatus", () => {
  it("maps output + usage into a run status with normalized tokens", () => {
    const status = mapOpenAIResponseToRunStatus({
      id: "resp_1",
      status: "completed",
      model: "gpt-5-codex",
      output_text: "ok",
      usage: { input_tokens: 6, output_tokens: 4, total_tokens: 10 },
    });
    expect(status).toMatchObject({
      run_id: "resp_1",
      status: "completed",
      output: "ok",
      tokens: { inputTokens: 6, outputTokens: 4, totalTokens: 10 },
    });
  });
});
