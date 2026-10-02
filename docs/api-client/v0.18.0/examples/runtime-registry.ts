import { createRuntimeClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

export function selectRuntime(provider: "claude" | "codex", apiKey: string) {
  const registry = createRuntimeProviderRegistry({
    modules: [createClaudeProviderModule({ apiKey }), createCodexProviderModule({ apiKey })],
  });
  return createRuntimeClient(provider, {
    registry,
    clientOptions: { baseUrl: provider === "claude" ? "https://api.anthropic.com" : "https://api.openai.com" },
  });
}
