import { describe, expect, it } from "vitest";
import type { RuntimeClient } from "../../../core/runtime/client";
import type {
  RuntimeBatchRequest,
  RuntimeBatchResult,
  RuntimeBatchStatus,
} from "../../../core/runtime/batch";

describe("RuntimeClient batch methods", () => {
  it("allows a client that implements the optional batch methods", async () => {
    const client: RuntimeClient = {
      getRuntimeCapabilities: async () => ({ providerKind: "x", supports: { batch: true } }),
      startRun: async () => ({ run_id: "r", status: "completed" }),
      submitBatch: async (_requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus> => ({
        batch_id: "b",
        status: "in_progress",
      }),
      getBatch: async (id: string): Promise<RuntimeBatchStatus> => ({ batch_id: id, status: "completed", resultsAvailable: true }),
      cancelBatch: async (id: string): Promise<RuntimeBatchStatus> => ({ batch_id: id, status: "canceling" }),
      getBatchResults: async (): Promise<RuntimeBatchResult[]> => [{ customId: "a", outcome: "succeeded" }],
    };
    const status = await client.submitBatch!([{ customId: "a", body: { input: "hi" } }]);
    expect(status.batch_id).toBe("b");
  });
});
