import { requireStreamText, type CapabilityClient, type RuntimeUsage, type StreamRunBody } from "@cavi-ai/api-client";

export async function streamAnswer(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (delta: string) => void,
  signal: AbortSignal,
  reportError: (error: unknown) => void,
) {
  let deltas: string | undefined;
  let terminalText: string | undefined;
  let tokens: RuntimeUsage | undefined;
  let runError: string | undefined;
  let transportError: unknown;
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") {
        deltas = (deltas ?? "") + event.delta;
        write(event.delta);
      }
      if (event.event === "run.completed") {
        terminalText = event.output;
        tokens = event.usage;
      }
      if (event.event === "run.failed") runError = event.error;
    },
    onError(error) {
      transportError = error;
      reportError(error);
    },
  }, { signal });
  if (!result.ok) return result;

  const text = requireStreamText({
    ...result.data, output: terminalText ?? deltas, error: runError, transportError,
  });
  return {
    ok: true as const,
    source: result.source,
    data: { runId: result.data.runId, text, tokens },
  };
}
