import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";

export function createAssistant(config: { apiKey: string; model: string }) {
  const registry = createRuntimeProviderRegistry({
    modules: [createClaudeProviderModule({ apiKey: config.apiKey })],
  });
  const client = createApiClient("claude", { registry, defaultTimeoutMs: 30_000 });

  return {
    async answer(question: string) {
      const result = await client.startRun({ model: config.model, input: question });
      if (!result.ok) return result;

      const run = result.data;
      if (run.status !== "completed") {
        throw new Error(`Run ${run.run_id} ended as ${run.status}`, { cause: run });
      }
      const text = run.output ?? run.response;
      if (text === undefined) {
        throw new Error(`Run ${run.run_id} completed with no text`, { cause: run });
      }
      return {
        ok: true as const,
        source: result.source,
        data: { runId: run.run_id, text, tokens: run.tokens },
      };
    },
    dispose: () => client.dispose(),
  };
}
