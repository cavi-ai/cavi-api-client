import { requireRunText, waitForRun, type CapabilityClient, type RuntimeRunStatus, type RunWaitOptions } from "@cavi-ai/api-client";

export async function awaitBackgroundAnswer(
  client: CapabilityClient,
  run: RuntimeRunStatus,
  options: RunWaitOptions,
) {
  const waited = await waitForRun(client, run, options);
  if (waited.reason !== "terminal") return { kind: "wait-stopped" as const, ...waited };

  return {
    kind: "answer" as const,
    runId: waited.run.run_id,
    text: requireRunText(waited.run),
    tokens: waited.run.tokens,
  };
}
