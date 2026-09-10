import { createRuntimeClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createGeminiProviderModule } from "@cavi-ai/api-client/providers/gemini/runtime";

export function createBrowserRuntime(apiKey: string) {
  const registry = createRuntimeProviderRegistry({
    modules: [createGeminiProviderModule({ apiKey })],
  });
  return createRuntimeClient("google", {
    registry,
    clientOptions: { baseUrl: "https://generativelanguage.googleapis.com", fetchImpl: fetch },
  });
}
