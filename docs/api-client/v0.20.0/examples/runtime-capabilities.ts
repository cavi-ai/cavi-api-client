import { runtimeSupports, type RuntimeClient, type RuntimeBatchRequest } from "@cavi-ai/api-client";

export async function submitWhenBatchIsAvailable(client: RuntimeClient, requests: RuntimeBatchRequest[]) {
  const capabilities = await client.getRuntimeCapabilities();
  if (!runtimeSupports(capabilities, "batch") || !client.submitBatch) return null;
  return client.submitBatch(requests);
}
