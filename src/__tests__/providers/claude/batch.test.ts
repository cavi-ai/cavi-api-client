import { describe, expect, it } from "vitest";
import { mapMessageBatch, parseMessageBatchResults } from "../../../providers/claude/batch";
import { mapAnthropicMessageToRunStatus } from "../../../providers/claude/message";

describe("mapMessageBatch", () => {
  it("maps an in-progress batch", () => {
    const status = mapMessageBatch({
      id: "msgbatch_1",
      processing_status: "in_progress",
      request_counts: { processing: 2, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
      created_at: "2026-07-01T00:00:00Z",
      ended_at: null,
    });
    expect(status).toMatchObject({
      batch_id: "msgbatch_1",
      status: "in_progress",
      resultsAvailable: false,
      counts: { processing: 2, succeeded: 0, total: 2 },
      createdAt: "2026-07-01T00:00:00Z",
    });
  });

  it("maps an ended batch as completed with resultsAvailable", () => {
    const status = mapMessageBatch({ id: "b", processing_status: "ended", request_counts: { succeeded: 1 } });
    expect(status).toMatchObject({ status: "completed", resultsAvailable: true, counts: { succeeded: 1, total: 1 } });
  });

  it("maps canceling", () => {
    expect(mapMessageBatch({ id: "b", processing_status: "canceling" }).status).toBe("canceling");
  });
});

describe("parseMessageBatchResults", () => {
  it("maps succeeded/errored/canceled/expired lines to results", () => {
    const jsonl = [
      JSON.stringify({ custom_id: "a", result: { type: "succeeded", message: { id: "m", model: "x", stop_reason: "end_turn", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 3, output_tokens: 2 } } } }),
      JSON.stringify({ custom_id: "b", result: { type: "errored", error: { type: "error", error: { type: "invalid_request_error", message: "bad" } } } }),
      JSON.stringify({ custom_id: "c", result: { type: "canceled" } }),
      "",
      JSON.stringify({ custom_id: "d", result: { type: "expired" } }),
    ].join("\n");

    const results = parseMessageBatchResults(jsonl, mapAnthropicMessageToRunStatus);
    expect(results).toHaveLength(4);
    expect(results[0]).toMatchObject({ customId: "a", outcome: "succeeded", run: { output: "ok", tokens: { inputTokens: 3, outputTokens: 2 } } });
    expect(results[1]).toMatchObject({ customId: "b", outcome: "errored", error: "bad" });
    expect(results[2]).toMatchObject({ customId: "c", outcome: "canceled" });
    expect(results[3]).toMatchObject({ customId: "d", outcome: "expired" });
  });
});
