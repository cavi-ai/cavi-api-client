import { createRuntimeClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

export async function inspectNodeRuntime(apiKey: string) {
  const registry = createRuntimeProviderRegistry({
    modules: [createCodexProviderModule({ apiKey })],
  });
  const client = createRuntimeClient("codex", {
    registry,
    clientOptions: { baseUrl: "https://api.openai.com" },
  });
  return client.getRuntimeCapabilities();
}
