import { createRuntimeClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

export function selectRuntime(config: { provider: "claude" | "codex"; apiKey: string; baseUrl: string }) {
  const module = config.provider === "claude"
    ? createClaudeProviderModule({ apiKey: config.apiKey })
    : createCodexProviderModule({ apiKey: config.apiKey });
  const registry = createRuntimeProviderRegistry({ modules: [module] });
  return createRuntimeClient(config.provider, { registry, clientOptions: { baseUrl: config.baseUrl } });
}
