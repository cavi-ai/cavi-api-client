import { runtimeSupports } from "../../core/runtime/capabilities";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream";
import type { RuntimeClient } from "../../core/runtime/client";
import type { RuntimeRunStartBody } from "../../core/runtime/run";
import type { RuntimeBatchRequest } from "../../core/runtime/batch";
import { ApiClientErrorCode, getErrorCode } from "../../core/errors";

export type RuntimeConformanceContext = {
  /** Build a fresh, mock-backed client for each check. */
  makeClient: () => RuntimeClient;
  /** A minimal valid run body for this provider. */
  runBody: RuntimeRunStartBody;
  /** A run body to stream; required only if the provider declares streaming + streamRun. */
  streamRunBody?: RuntimeRunStartBody;
  /** A batch submission fixture; required only for providers that declare supports.batch. */
  batchRequests?: RuntimeBatchRequest[];
  /**
   * Build a fresh client instrumented to count its own outbound transport
   * calls (fetch or RPC). Required only by the dryRun checks (A3).
   */
  makeInstrumentedClient?: () => { client: RuntimeClient; callCount: () => number };
  /**
   * A run body that fails this provider's own build/validate step (e.g.
   * missing model) — proves dryRun still validates before short-circuiting.
   * Omit for providers with no such client-side validation.
   */
  dryRunInvalidRunBody?: RuntimeRunStartBody;
};

export type ConformanceCheck = {
  name: string;
  run(ctx: RuntimeConformanceContext): Promise<void>;
};

export type ConformanceResult = { name: string; ok: boolean; error?: string };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`conformance: ${message}`);
}

const TERMINAL_EVENTS: ReadonlySet<string> = new Set([
  RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
  RUN_STREAM_EVENT_NAMES.RUN_FAILED,
  RUN_STREAM_EVENT_NAMES.RUN_CANCELLED,
]);
const VALID_EVENT_NAMES: ReadonlySet<string> = new Set(Object.values(RUN_STREAM_EVENT_NAMES));

export const RUNTIME_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  {
    name: "getRuntimeCapabilities returns a valid profile",
    run: async ({ makeClient }) => {
      const caps = await makeClient().getRuntimeCapabilities();
      assert(
        typeof caps.providerKind === "string" && caps.providerKind.length > 0,
        "providerKind must be a non-empty string",
      );
      assert(caps.supports != null && typeof caps.supports === "object", "supports must be an object");
    },
  },
  {
    name: "declares supports.runs",
    run: async ({ makeClient }) => {
      const caps = await makeClient().getRuntimeCapabilities();
      assert(runtimeSupports(caps, "runs"), "a runtime provider must declare supports.runs === true");
    },
  },
  {
    name: "startRun returns a non-empty run_id and status",
    run: async ({ makeClient, runBody }) => {
      const status = await makeClient().startRun(runBody);
      assert(typeof status.run_id === "string" && status.run_id.length > 0, "run_id must be a non-empty string");
      assert(typeof status.status === "string" && status.status.length > 0, "status must be a non-empty string");
    },
  },
  {
    name: "optional getRun/cancelRun, if present, are functions",
    run: async ({ makeClient }) => {
      const client = makeClient();
      if (client.getRun !== undefined) {
        assert(typeof client.getRun === "function", "getRun must be a function if present");
      }
      if (client.cancelRun !== undefined) {
        assert(typeof client.cancelRun === "function", "cancelRun must be a function if present");
      }
    },
  },
  {
    name: "normalizes reported usage into tokens",
    run: async ({ makeClient, runBody }) => {
      const status = await makeClient().startRun(runBody);
      if (status.usage == null) return; // provider reported no usage — nothing to normalize
      assert(status.tokens != null, "tokens must be present when usage is reported");
      if (typeof status.usage.input_tokens === "number") {
        assert(
          typeof status.tokens.inputTokens === "number",
          "tokens.inputTokens must be numeric when usage.input_tokens is present",
        );
      }
      if (typeof status.usage.output_tokens === "number") {
        assert(
          typeof status.tokens.outputTokens === "number",
          "tokens.outputTokens must be numeric when usage.output_tokens is present",
        );
      }
    },
  },
];

export const RUNTIME_STREAMING_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  {
    name: "streamRun emits canonical RunStreamEvents ending in a terminal event",
    run: async ({ makeClient, streamRunBody }) => {
      const client = makeClient();
      // F4: providers using the subscribe-by-runId model expose no streamRun — skip them.
      if (typeof client.streamRun !== "function") return;
      const caps = await client.getRuntimeCapabilities();
      if (!runtimeSupports(caps, "streaming")) return;
      assert(streamRunBody != null, "streamRunBody fixture required for a streaming provider");

      const events: RunStreamEvent[] = [];
      await client.streamRun(streamRunBody, { onEvent: (event) => events.push(event) });

      assert(events.length > 0, "streamRun emitted no events");
      for (const event of events) {
        assert(VALID_EVENT_NAMES.has(event.event), `unknown event name "${event.event}"`);
        const runId = (event as { runId?: unknown }).runId;
        assert(typeof runId === "string" && runId.length > 0, "every event must carry a non-empty runId");
      }
      assert(TERMINAL_EVENTS.has(events[events.length - 1]!.event), "stream must end with a terminal run.* event");
    },
  },
];

export const RUNTIME_BATCH_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  {
    name: "batch: methods present and round-trip when supports.batch",
    run: async ({ makeClient, batchRequests }) => {
      const client = makeClient();
      const caps = await client.getRuntimeCapabilities();
      if (!runtimeSupports(caps, "batch")) return; // provider doesn't declare batch — skip
      assert(typeof client.submitBatch === "function", "submitBatch must be a function when supports.batch");
      assert(typeof client.getBatch === "function", "getBatch must be a function");
      assert(typeof client.cancelBatch === "function", "cancelBatch must be a function");
      assert(typeof client.getBatchResults === "function", "getBatchResults must be a function");
      assert(batchRequests != null && batchRequests.length > 0, "batchRequests fixture required for a batch provider");

      const submitted = await client.submitBatch!(batchRequests);
      assert(typeof submitted.batch_id === "string" && submitted.batch_id.length > 0, "submitBatch returns a non-empty batch_id");
      const got = await client.getBatch!(submitted.batch_id);
      assert(typeof got.status === "string" && got.status.length > 0, "getBatch returns a status");
      if (got.resultsAvailable) {
        const results = await client.getBatchResults!(submitted.batch_id);
        assert(Array.isArray(results), "getBatchResults returns an array");
        for (const result of results) {
          assert(typeof result.customId === "string", "each result carries a customId");
          if (result.outcome === "succeeded") {
            assert(result.run != null, "a succeeded result carries a run");
            // Batch results normalize usage like any run: if the run reports raw
            // usage, it must also expose normalized tokens (parity with startRun).
            if (result.run!.usage != null) {
              assert(result.run!.tokens != null, "a succeeded batch result with usage must expose normalized tokens");
            }
          }
        }
      }
    },
  },
];

export const RUNTIME_DRYRUN_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  {
    name: "dryRun: startRun makes zero network calls and returns a dry_run status",
    run: async ({ makeInstrumentedClient, runBody }) => {
      if (!makeInstrumentedClient) return; // provider fixture doesn't opt into instrumentation
      const { client, callCount } = makeInstrumentedClient();
      const status = await client.startRun({ ...runBody, dryRun: true });
      assert(callCount() === 0, `startRun with dryRun:true must make zero network calls, made ${callCount()}`);
      assert(status.status === "dry_run", `status must be "dry_run", got "${status.status}"`);
      assert(typeof status.run_id === "string" && status.run_id.length > 0, "run_id must be present");
      assert(status.tokens === undefined, "tokens must be absent on a dry run");
      assert(status.output === undefined, "output must be absent on a dry run");
      if (typeof runBody.model === "string" && runBody.model) {
        assert(
          status.model === runBody.model,
          `resolved model must be echoed on the dry_run status, expected "${runBody.model}", got "${status.model}"`,
        );
      }
    },
  },
  {
    name: "dryRun: a malformed request still throws ValidationFailed before the network short-circuit",
    run: async ({ makeInstrumentedClient, dryRunInvalidRunBody }) => {
      if (!makeInstrumentedClient || !dryRunInvalidRunBody) return; // provider has no such validation to prove
      const { client, callCount } = makeInstrumentedClient();
      let threw = false;
      try {
        await client.startRun({ ...dryRunInvalidRunBody, dryRun: true });
      } catch (error) {
        threw = true;
        assert(
          getErrorCode(error) === ApiClientErrorCode.ValidationFailed,
          `expected ValidationFailed, got ${String(getErrorCode(error))}`,
        );
      }
      assert(threw, "a malformed dryRun request must still throw");
      assert(callCount() === 0, "a validation failure must not make a network call either");
    },
  },
  {
    name: "dryRun: streamRun emits exactly one terminal dry_run event, zero network calls",
    run: async ({ makeInstrumentedClient, streamRunBody }) => {
      if (!makeInstrumentedClient || streamRunBody == null) return;
      const { client, callCount } = makeInstrumentedClient();
      if (typeof client.streamRun !== "function") return;
      const events: RunStreamEvent[] = [];
      await client.streamRun({ ...streamRunBody, dryRun: true }, { onEvent: (event) => events.push(event) });
      assert(callCount() === 0, `streamRun with dryRun:true must make zero network calls, made ${callCount()}`);
      assert(events.length === 1, `streamRun dryRun must emit exactly one event, got ${events.length}`);
      assert(events[0]!.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, "dry-run stream event must be RUN_COMPLETED-shaped");
      assert((events[0] as { status?: string }).status === "dry_run", "dry-run stream event must carry status dry_run");
    },
  },
];

export const ALL_RUNTIME_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  ...RUNTIME_CONFORMANCE_CHECKS,
  ...RUNTIME_STREAMING_CONFORMANCE_CHECKS,
  ...RUNTIME_BATCH_CONFORMANCE_CHECKS,
  ...RUNTIME_DRYRUN_CONFORMANCE_CHECKS,
];

/** Run a set of checks, collecting per-check pass/fail (never throws). */
export async function runRuntimeConformance(
  ctx: RuntimeConformanceContext,
  checks: ConformanceCheck[] = ALL_RUNTIME_CONFORMANCE_CHECKS,
): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];
  for (const check of checks) {
    try {
      await check.run(ctx);
      results.push({ name: check.name, ok: true });
    } catch (error) {
      results.push({ name: check.name, ok: false, error: String(error) });
    }
  }
  return results;
}
