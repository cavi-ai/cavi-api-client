import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude/messages";
import { CodexFilesClient } from "@cavi-ai/api-client/providers/codex/files";
import { GeminiFilesClient } from "@cavi-ai/api-client/providers/gemini/files";
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes/runtime";
import { OPENCLAW_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/openclaw/runtime";

export const narrowImports = {
  ClaudeApiClient,
  CodexFilesClient,
  GeminiFilesClient,
  HERMES_PROVIDER_MODULE,
  OPENCLAW_PROVIDER_MODULE,
};
