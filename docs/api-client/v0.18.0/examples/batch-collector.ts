import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, type CapabilityClient, type RuntimeBatchResult } from "@cavi-ai/api-client";

export async function collectBatch(client: CapabilityClient, batchId: string) {
  const status = await client.getBatch(batchId);
  if (!status.ok) return status;
  const batch = status.data;
  if (!status.data.resultsAvailable) {
    const kind = ["completed", "failed", "cancelled", "expired"].includes(batch.status)
      ? "terminal" as const : "pending" as const;
    return { ok: true as const, source: status.source, data: { kind, batch } };
  }
  const results = await client.getBatchResults(batchId);
  if (!results.ok) return results;
  const items = new Map<string, RuntimeBatchResult>();
  for (const item of results.data) {
    if (!item.customId.trim() || items.has(item.customId)) {
      throw new ApiClientError("Batch results have missing or duplicate correlation IDs.", {
        type: ApiClientErrorType.Validation, code: ApiClientErrorCode.ProtocolMismatch,
        cause: { batch, customId: item.customId },
      });
    }
    items.set(item.customId, item);
  }
  return {
    ok: true as const,
    source: results.source,
    data: {
      kind: "results" as const,
      batch,
      items,
    },
  };
}
