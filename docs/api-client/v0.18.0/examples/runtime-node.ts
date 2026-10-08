import type { CapabilityClient, RuntimeRunStartBody } from "@cavi-ai/api-client";

export async function runAndWait(
  client: CapabilityClient,
  body: RuntimeRunStartBody,
  options: { maxPolls?: number; pollIntervalMs?: number } = {},
) {
  const { maxPolls = 60, pollIntervalMs = 1_000 } = options;
  if (!Number.isInteger(maxPolls) || maxPolls < 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error("Use a non-negative poll count and interval.");
  }
  let result = await client.startRun(body);
  if (!result.ok) throw new Error(result.gap.note, { cause: result.gap });
  let run = result.data;
  const active = (status: string) => ["started", "running", "stopping"].includes(status);
  for (let poll = 0; active(run.status) && poll < maxPolls; poll += 1) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    result = await client.getRun(run.run_id);
    if (!result.ok) throw new Error(result.gap.note, { cause: result.gap });
    run = result.data;
  }
  // A limited wait returns the last observed state; callers decide whether to cancel.
  return run;
}
