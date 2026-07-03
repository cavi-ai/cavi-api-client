import { describe, expect, it } from "vitest";
import { buildBatchInputJsonl, mapOpenAIBatch, parseOpenAIBatchOutput } from "../../../providers/codex/batch";
import { mapOpenAIResponseToRunStatus } from "../../../providers/codex/response";

describe("buildBatchInputJsonl", () => {
  it("emits one /v1/responses line per request", () => {
    const jsonl = buildBatchInputJsonl(
      [{ customId: "a", body: { input: "hi", model: "m" } }],
      (b) => ({ model: b.model, input: b.input }),
    );
    expect(JSON.parse(jsonl)).toEqual({ custom_id: "a", method: "POST", url: "/v1/responses", body: { model: "m", input: "hi" } });
  });
});

describe("mapOpenAIBatch", () => {
  it("maps an in-progress batch", () => {
    const s = mapOpenAIBatch({ id: "batch_1", status: "in_progress", request_counts: { total: 2, completed: 0, failed: 0 }, created_at: 1720000000 });
    expect(s).toMatchObject({ batch_id: "batch_1", status: "in_progress", resultsAvailable: false, counts: { total: 2, succeeded: 0, errored: 0 }, createdAt: 1720000000 });
  });
  it("maps a completed batch with an output file as resultsAvailable", () => {
    const s = mapOpenAIBatch({ id: "b", status: "completed", output_file_id: "file-out", request_counts: { total: 1, completed: 1, failed: 0 }, completed_at: 1 });
    expect(s).toMatchObject({ status: "completed", resultsAvailable: true, counts: { succeeded: 1 }, endedAt: 1 });
  });
  it("marks a failed batch with only an error file as resultsAvailable", () => {
    const s = mapOpenAIBatch({ id: "b", status: "failed", error_file_id: "file-err", request_counts: { total: 1, completed: 0, failed: 1 } });
    expect(s).toMatchObject({ status: "failed", resultsAvailable: true, counts: { errored: 1 } });
  });
  it("maps cancelling/cancelled/expired", () => {
    expect(mapOpenAIBatch({ id: "b", status: "cancelling" }).status).toBe("canceling");
    expect(mapOpenAIBatch({ id: "b", status: "cancelled" }).status).toBe("cancelled");
    expect(mapOpenAIBatch({ id: "b", status: "expired" }).status).toBe("expired");
  });
});

describe("parseOpenAIBatchOutput", () => {
  it("maps 2xx lines to succeeded runs and error lines to errored", () => {
    const jsonl = [
      JSON.stringify({ custom_id: "a", response: { status_code: 200, body: { id: "r", status: "completed", model: "m", output_text: "ok", usage: { input_tokens: 3, output_tokens: 2 } } }, error: null }),
      JSON.stringify({ custom_id: "b", response: { status_code: 400, body: { error: { message: "bad request" } } }, error: null }),
      "",
      JSON.stringify({ custom_id: "c", response: null, error: { message: "request failed" } }),
    ].join("\n");
    const results = parseOpenAIBatchOutput(jsonl, mapOpenAIResponseToRunStatus);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ customId: "a", outcome: "succeeded", run: { output: "ok", tokens: { inputTokens: 3, outputTokens: 2 } } });
    expect(results[1]).toMatchObject({ customId: "b", outcome: "errored", error: "bad request" });
    expect(results[2]).toMatchObject({ customId: "c", outcome: "errored", error: "request failed" });
  });
});
