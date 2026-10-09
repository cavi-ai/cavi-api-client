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
  const output = [
    { type: "reasoning", summary: [{ type: "summary_text", text: "private reasoning" }] },
    { type: "message", content: [
      { type: "output_text", text: "First " },
      { type: "refusal", refusal: "refusal text" },
      { type: "output_text", text: "message.\n" },
    ] },
    { type: "function_call", arguments: "tool input", content: [{ type: "output_text", text: "not a message" }] },
    { type: "message", content: [{ type: "output_text", text: "Second message." }] },
  ];

  it("concatenates native message text in wire order without adding separators", () => {
    const response = { id: "resp_native", status: "completed", output };
    expect(mapOpenAIResponseToRunStatus(response)).toEqual({
      run_id: "resp_native", status: "completed", output: "First message.\nSecond message.",
    });
  });

  it.each(["explicit", "", " "])("preserves explicit output_text %j over native items", (output_text) => {
    const response = { id: "resp_precedence", status: "completed", output_text, output };
    const status = mapOpenAIResponseToRunStatus(response);
    expect(status.output).toBe(output_text);
  });

  it.each([
    undefined, null, {}, [], [null, 3, "text"],
    [{ type: "message", content: null }],
    [{ type: "message", content: [{ type: "output_text", text: 3 }, null, { type: "refusal", text: "ignore" }] }],
    [{ type: "function_call", text: "ignore", arguments: "ignore" }],
  ])("omits output for absent, non-text, or malformed native items %j", (output) => {
    const response = { id: "resp_empty", status: "completed", output };
    expect(mapOpenAIResponseToRunStatus(response)).toEqual({ run_id: "resp_empty", status: "completed" });
  });

  it("preserves an observed empty native message", () => {
    expect(mapOpenAIResponseToRunStatus({ id: "empty", status: "completed", output: [
      { type: "message", content: [{ type: "output_text", text: "" }] },
    ] })).toEqual({ run_id: "empty", status: "completed", output: "" });
  });

  it("skips malformed entries without dropping valid message text", () => {
    const response = { id: "resp_mixed", status: "completed", output: [
      null, { type: "message", content: [null, { type: "output_text", text: "ok" }, { type: "output_text", text: false }] },
    ] };
    expect(mapOpenAIResponseToRunStatus(response).output).toBe("ok");
  });

  it.each([
    { status: "failed", error: { message: "backend failure" }, expected: "backend failure" },
    { status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, expected: "max_output_tokens" },
  ])("keeps $status failures while exposing partial native text", ({ expected, ...failure }) => {
    const response = { id: "resp_failed", ...failure, output };
    expect(mapOpenAIResponseToRunStatus(response)).toMatchObject({
      status: "failed", error: expected, output: "First message.\nSecond message.",
    });
  });

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
