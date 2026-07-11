import type { RuntimeRunStatus } from "./run.js";
import { RUN_STREAM_EVENT_NAMES, type RunStreamRunCompletedEvent } from "./run-stream.js";

function newDryRunId(): string {
  return `dryrun-${globalThis.crypto.randomUUID()}`;
}

/**
 * Build the canonical `dry_run` RuntimeRunStatus every provider's dryRun
 * short-circuit returns (A3). Single-source shape — same pattern as
 * normalizeRuntimeUsage: `dryRun: true` always builds + validates the
 * provider request first, then returns this WITHOUT any network call.
 */
export function buildDryRunStatus(model?: string): RuntimeRunStatus {
  return {
    run_id: newDryRunId(),
    status: "dry_run",
    ...(model ? { model } : {}),
  };
}

/** Build the single terminal stream event a dryRun streamRun() emits (A3). */
export function buildDryRunStreamEvent(model?: string): RunStreamRunCompletedEvent {
  const dryRunStatus = buildDryRunStatus(model);
  return {
    event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
    runId: dryRunStatus.run_id,
    status: dryRunStatus.status,
  };
}
