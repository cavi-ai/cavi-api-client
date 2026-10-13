import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude";
import { CodexApiClient } from "@cavi-ai/api-client/providers/codex";

export function createRuntimeClient() {
  const options = { apiKey: "integration-key", baseUrl: process.env.TEST_BASE_URL, defaultModel: "test-model" };
  return process.env.TEST_PROVIDER === "codex" ? new CodexApiClient(options) : new ClaudeApiClient(options);
}
