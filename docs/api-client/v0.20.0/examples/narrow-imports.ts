import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude/messages";
import { CodexFilesClient } from "@cavi-ai/api-client/providers/codex/files";
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes/runtime";
import { OPENCLAW_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/openclaw/runtime";
import type { TeamManifest } from "@cavi-ai/api-client/contracts";

export function readManifestVersion(manifest: TeamManifest) {
  return manifest.version;
}

export const narrowImports = {
  ClaudeApiClient,
  CodexFilesClient,
  HERMES_PROVIDER_MODULE,
  OPENCLAW_PROVIDER_MODULE,
};
