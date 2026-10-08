import { requireRunText, type CapabilityClient, type RuntimeRunInput } from "@cavi-ai/api-client";

export function createAnswerService(client: CapabilityClient, model: string) {
  return {
    async answer(input: RuntimeRunInput) {
      const result = await client.startRun({ model, input });
      if (!result.ok) return result;

      const run = result.data;
      const text = requireRunText(run);
      return {
        ok: true as const,
        source: result.source,
        data: { runId: run.run_id, text, tokens: run.tokens },
      };
    },
  };
}
