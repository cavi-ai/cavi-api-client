import { runtimeSupports, type RuntimeClient } from "@cavi-ai/api-client";

export async function submitWhenBatchIsAvailable(client: RuntimeClient) {
  const capabilities = await client.getRuntimeCapabilities();
  if (!runtimeSupports(capabilities, "batch") || !client.submitBatch) return null;
  return client.submitBatch([{ customId: "summary", body: { input: "Summarize this." } }]);
}
