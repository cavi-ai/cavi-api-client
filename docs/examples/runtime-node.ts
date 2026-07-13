import { CodexApiClient } from "@cavi-ai/api-client/providers/codex/runtime";

export async function runQuickstart(apiKey: string) {
  const client = new CodexApiClient({
    apiKey,
    defaultModel: "gpt-5",
  });
  return client.startRun({
    input: "Summarize why capability checks matter in one sentence.",
  });
}
