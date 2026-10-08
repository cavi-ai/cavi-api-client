import type { CapabilityClient, RuntimeBatchRequest } from "@cavi-ai/api-client";

export async function submitBatchAndCollect(
  client: CapabilityClient,
  requests: RuntimeBatchRequest[],
  options: { maxPolls?: number; pollIntervalMs?: number } = {},
) {
  const { maxPolls = 60, pollIntervalMs = 60_000 } = options;
  if (!Number.isInteger(maxPolls) || maxPolls < 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error("Use a non-negative poll count and interval.");
  }
  const submitted = await client.submitBatch(requests);
  if (!submitted.ok) throw new Error(submitted.gap.note);
  let batch = submitted.data;
  for (let poll = 0; !batch.resultsAvailable && poll < maxPolls; poll += 1) {
    if (["failed", "cancelled"].includes(batch.status)) break;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    const next = await client.getBatch(batch.batch_id);
    if (!next.ok) throw new Error(next.gap.note);
    batch = next.data;
  }
  if (!batch.resultsAvailable) {
    // Keep the ID: stopping this local wait does not cancel the backend batch.
    throw new Error(`Batch ${batch.batch_id} is not ready (status: ${batch.status}); retrieve it later or cancel explicitly.`);
  }
  const results = await client.getBatchResults(batch.batch_id);
  if (!results.ok) throw new Error(results.gap.note);
  // Callers must inspect each item's outcome, including errored/canceled/expired.
  return results.data;
}
