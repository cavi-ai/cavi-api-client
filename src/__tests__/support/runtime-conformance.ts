import { runtimeSupports } from "../../core/runtime/capabilities";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream";
import type { RuntimeClient } from "../../core/runtime/client";
import type { RuntimeRunStartBody } from "../../core/runtime/run";

export type RuntimeConformanceContext = {
  /** Build a fresh, mock-backed client for each check. */
  makeClient: () => RuntimeClient;
  /** A minimal valid run body for this provider. */
  runBody: RuntimeRunStartBody;
  /** A run body to stream; required only if the provider declares streaming + streamRun. */
  streamRunBody?: RuntimeRunStartBody;
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

export const ALL_RUNTIME_CONFORMANCE_CHECKS: ConformanceCheck[] = [
  ...RUNTIME_CONFORMANCE_CHECKS,
  ...RUNTIME_STREAMING_CONFORMANCE_CHECKS,
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
