import { CodexApiClient } from "@cavi-ai/api-client/providers/codex/runtime";

export async function runQuickstart(apiKey: string) {
  const client = new CodexApiClient({
    apiKey,
    defaultModel: "gpt-5",
  });
  let run = await client.startRun({
    input: "Summarize why capability checks matter in one sentence.",
  });

  while (run.status === "started" || run.status === "running") {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    run = await client.getRun(run.run_id);
  }

  return run;
}
