import { describe, expect, it } from "vitest";
import {
  buildGeminiBatchInlineEntries,
  buildGeminiBatchInputJsonl,
  estimateGeminiBatchInlineBytes,
  mapGeminiBatch,
  parseGeminiBatchOutputJsonl,
  parseGeminiInlineBatchResults,
  resolveGeminiBatchModel,
} from "../../../providers/gemini/batch";

describe("resolveGeminiBatchModel", () => {
  it("requires a shared model across requests", () => {
    expect(() =>
      resolveGeminiBatchModel(
        [
          { customId: "a", body: { input: "hi", model: "gemini-2.5-flash" } },
          { customId: "b", body: { input: "yo", model: "gemini-2.5-pro" } },
        ],
      ),
    ).toThrowError(/same model/);
  });
});

describe("mapGeminiBatch", () => {
  it("maps pending and succeeded batches", () => {
    expect(
      mapGeminiBatch({ name: "batches/1", metadata: { state: "JOB_STATE_PENDING" } }),
    ).toMatchObject({ batch_id: "batches/1", status: "in_progress", resultsAvailable: false });
    expect(
      mapGeminiBatch({ name: "batches/2", metadata: { state: "JOB_STATE_SUCCEEDED" } }),
    ).toMatchObject({ batch_id: "batches/2", status: "completed", resultsAvailable: true });
  });
});

describe("parseGeminiInlineBatchResults", () => {
  it("maps inline successes and errors", () => {
    const results = parseGeminiInlineBatchResults(
      {
        response: {
          inlinedResponses: [
            {
              metadata: { key: "a" },
              response: {
                candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
                usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
              },
            },
            { metadata: { key: "b" }, error: { message: "bad" } },
          ],
        },
      },
      "gemini-2.5-flash",
    );
    expect(results[0]).toMatchObject({
      customId: "a",
      outcome: "succeeded",
      run: { output: "ok", tokens: { inputTokens: 2, outputTokens: 1, totalTokens: 3 } },
    });
    expect(results[1]).toMatchObject({ customId: "b", outcome: "errored", error: "bad" });
  });
});

describe("parseGeminiBatchOutputJsonl", () => {
  it("parses file output JSONL", () => {
    const jsonl = [
      JSON.stringify({
        key: "a",
        response: {
          candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
        },
      }),
      JSON.stringify({ key: "b", error: { message: "boom" } }),
    ].join("\n");
    const results = parseGeminiBatchOutputJsonl(jsonl, "gemini-2.5-flash");
    expect(results).toMatchObject([
      { customId: "a", outcome: "succeeded", run: { output: "ok" } },
      { customId: "b", outcome: "errored", error: "boom" },
    ]);
  });
});

describe("batch submit sizing", () => {
  it("estimates inline payload bytes for thresholding", () => {
    const { entries } = buildGeminiBatchInlineEntries([
      { customId: "a", body: { input: "hi", model: "gemini-2.5-flash" } },
    ]);
    expect(estimateGeminiBatchInlineBytes(entries)).toBeGreaterThan(0);
    const { jsonl } = buildGeminiBatchInputJsonl([
      { customId: "a", body: { input: "hi", model: "gemini-2.5-flash" } },
    ]);
    expect(jsonl).toContain('"key":"a"');
  });
});
