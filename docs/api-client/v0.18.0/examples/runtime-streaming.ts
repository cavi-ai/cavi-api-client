import type { CapabilityClient, StreamRunBody } from "@cavi-ai/api-client";

export async function streamText(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (text: string) => void,
  signal: AbortSignal,
) {
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") write(event.delta);
      if (event.event === "run.failed") console.error(event.error);
    },
    onError(error) {
      console.error("Stream transport/parse error:", error);
    },
  }, { signal });
  if (!result.ok) throw new Error(`${result.gap.reason}: ${result.gap.note}`);
  if (result.data.outcome !== "completed") {
    throw new Error(`Stream ended with outcome ${result.data.outcome ?? "unknown"}`);
  }
  return result.data;
}
