import { describe, expect, it } from "vitest";
import { RUNTIME_SURFACES } from "../../../core/runtime/capabilities";
import type {
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
} from "../../../core/runtime/batch";

describe("batch surface + types", () => {
  it("declares the batch runtime surface", () => {
    expect(RUNTIME_SURFACES).toContain("batch");
  });

  it("accepts well-formed batch values at the type level", () => {
    const request: RuntimeBatchRequest = { customId: "a", body: { input: "hi", model: "m" } };
    const status: RuntimeBatchStatus = {
      batch_id: "b1",
      status: "in_progress",
      counts: { total: 1, processing: 1 },
      resultsAvailable: false,
    };
    const result: RuntimeBatchResult = {
      customId: "a",
      outcome: "succeeded",
      run: { run_id: "r", status: "completed", tokens: { inputTokens: 1 } },
    };
    expect([request.customId, status.batch_id, result.outcome]).toEqual(["a", "b1", "succeeded"]);
  });
});
