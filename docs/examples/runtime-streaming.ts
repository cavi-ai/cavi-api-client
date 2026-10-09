import { ApiClientError, ApiClientErrorCode, type CapabilityClient, type StreamRunBody } from "@cavi-ai/api-client";

export async function streamText(
  client: CapabilityClient,
  body: StreamRunBody,
  write: (text: string) => void,
  signal: AbortSignal,
  reportError?: (error: unknown) => void,
) {
  let text: string | undefined;
  let terminalText: string | undefined;
  let runError: string | undefined;
  let transportError: unknown;
  const result = await client.streamRun(body, {
    onEvent(event) {
      if (event.event === "message.delta") {
        text = (text ?? "") + event.delta;
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
  if (!result.ok) throw new ApiClientError(result.gap.note, {
    code: ApiClientErrorCode.RequestFailed, cause: result.gap,
  });
  if (result.data.outcome !== "completed") {
    const code = result.data.outcome === "failed" ? "run_failed"
      : result.data.outcome === "cancelled" ? "run_cancelled" : "run_incomplete";
    throw new ApiClientError(`Stream ended with outcome ${result.data.outcome ?? "unknown"}`, {
      type: "run", code, cause: { ...result.data, error: runError, transportError },
    });
  }
  const answer = terminalText ?? text;
  if (answer === undefined) {
    throw new ApiClientError("Stream completed without a text answer.", {
      type: "run", code: "run_output_missing", cause: result.data,
    });
  }
  return { ...result.data, text: answer };
}
