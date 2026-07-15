import type { RuntimeRunStatus } from "./run.js";

const DEFAULT_CAPACITY = 256;

/**
 * A small bounded cache of terminal run statuses for synchronous providers
 * (Claude SDK, Gemini) whose runs complete during `startRun` and have no
 * server-side retrieval. It lets `getRun`/`cancelRun` degrade gracefully —
 * returning the already-terminal status instead of throwing — so the
 * `RuntimeClient` contract is uniform across providers ("swap providers, not
 * code"). Insertion-ordered with LRU-style eviction; capacity bounds memory.
 */
export class SynchronousRunStore {
  private readonly entries = new Map<string, RuntimeRunStatus>();

  constructor(private readonly capacity: number = DEFAULT_CAPACITY) {}

  /** Record a run's terminal status. No-op for a status with no `run_id`. */
  remember(status: RuntimeRunStatus): void {
    if (!status.run_id) return;
    if (this.entries.has(status.run_id)) this.entries.delete(status.run_id);
    this.entries.set(status.run_id, status);
    if (this.entries.size > this.capacity) {
      const oldest = this.entries.keys().next().value as string | undefined;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
  }

  /** The remembered terminal status for a run this client produced, if any. */
  get(runId: string): RuntimeRunStatus | undefined {
    return this.entries.get(runId);
  }
}

/**
 * Honest degraded status for a synchronous provider asked to retrieve a run it
 * did not itself produce. Synchronous runs are not retained server-side, so
 * there is nothing to fetch — we return `status: "unknown"` with an explanatory
 * `error` rather than throwing. Never throws.
 */
export function unknownSynchronousRun(providerKind: string, runId: string): RuntimeRunStatus {
  return {
    run_id: runId,
    status: "unknown",
    error:
      `${providerKind}: runs are synchronous and not retained server-side; ` +
      `getRun is only available for runs started via this client instance`,
  };
}
