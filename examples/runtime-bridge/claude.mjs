import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude";

export function createRuntimeClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  return new ClaudeApiClient({ apiKey });
}
