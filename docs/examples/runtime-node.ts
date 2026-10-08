import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

export async function runQuickstart(
  apiKey: string,
  model: string,
  options: { maxPolls?: number; pollIntervalMs?: number; fetchImpl?: typeof fetch } = {},
) {
  const { maxPolls = 60, pollIntervalMs = 1_000 } = options;
  if (!Number.isInteger(maxPolls) || maxPolls < 0 || !Number.isFinite(pollIntervalMs) || pollIntervalMs < 0) {
    throw new Error("Use a non-negative poll count and interval.");
  }
  const registry = createRuntimeProviderRegistry({
    modules: [createCodexProviderModule({ apiKey })],
  });
  const client = createApiClient("codex", {
    registry,
    defaultTimeoutMs: 30_000,
    fetchImpl: options.fetchImpl,
  });
  try {
    let result = await client.startRun({
      model,
      input: "Summarize why capability checks matter in one sentence.",
    });
    if (!result.ok) throw new Error(result.gap.note);
    let run = result.data;
    let polls = 0;
    while (["started", "running", "stopping"].includes(run.status) && polls < maxPolls) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      result = await client.getRun(run.run_id);
      if (!result.ok) throw new Error(result.gap.note);
      run = result.data;
      polls += 1;
    }
    if (["started", "running", "stopping"].includes(run.status)) {
      const cancel = await client.cancelRun(run.run_id);
      const note = cancel.ok ? cancel.data.status : cancel.gap.note;
      throw new Error(`Run ${run.run_id} exceeded the poll limit; cancellation response: ${note}`);
    }
    if (run.status !== "completed") {
      throw new Error(`Run ${run.run_id} ended as ${run.status}: ${run.error ?? "no completed output"}`);
    }
    return run;
  } finally {
    await client.dispose();
  }
}
