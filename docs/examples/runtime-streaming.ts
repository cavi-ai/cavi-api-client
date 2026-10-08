import type { CapabilityClient, StreamRunBody } from "@cavi-ai/api-client";

export async function streamText(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (text: string) => void,
  signal: AbortSignal,
  reportError?: (error: unknown) => void,
) {
  let text = "";
  let terminalText: string | undefined;
  let runError: string | undefined;
  let transportError: unknown;
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") {
        text += event.delta;
        write(event.delta);
      }
      if (event.event === "run.completed") terminalText = event.output;
      if (event.event === "run.failed") runError = event.error;
    },
    onError(error) {
      transportError = error;
      reportError?.(error);
    },
  }, { signal });
  if (!result.ok) throw new Error(`${result.gap.reason}: ${result.gap.note}`, { cause: result.gap });
  if (result.data.outcome !== "completed") {
    throw new Error(`Stream ended with outcome ${result.data.outcome ?? "unknown"}`, {
      cause: runError ?? transportError ?? result.data,
    });
  }
  return { ...result.data, text: terminalText ?? text };
}
