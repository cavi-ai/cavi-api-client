import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../core/errors.js";
import type { ContractGap } from "../core/gateway/envelope/types.js";
import type { RuntimeRunStatus } from "../core/runtime/run.js";
import type { CapabilityClient } from "./capability-client.js";

export type RunWaitOptions = {
  /** Maximum retrieval attempts. Default: 60. Zero makes no retrieval calls. */
  maxPolls?: number;
  /** Delay before each retrieval, in integer milliseconds. Default: 1,000. */
  pollIntervalMs?: number;
  /** Local time budget, including pending retrievals. Default: 60,000 ms. */
  maxWaitMs?: number;
  /** Ends the local wait without cancelling backend work or the pending HTTP request. */
  signal?: AbortSignal;
};

/** Every stopped wait retains its last observed run and retrieval attempt count. */
export type RunWaitResult =
  | {
    reason: "terminal" | "state-not-pollable" | "poll-limit" | "timeout" | "aborted";
    run: RuntimeRunStatus;
    polls: number;
  }
  | { reason: "gap"; run: RuntimeRunStatus; polls: number; gap: ContractGap };

const MAX_TIMER_MS = 2 ** 31 - 1;

function observedStopReason(status: string): "terminal" | "state-not-pollable" | undefined {
  if (status === "completed" || status === "failed" || status === "cancelled") return "terminal";
  if (status === "started" || status === "running" || status === "stopping") return undefined;
  return "state-not-pollable";
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    }
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}

function observeOrStop<T>(
  request: Promise<T>,
  signal: AbortSignal,
): Promise<{ stopped: true } | { stopped: false; value: T }> {
  return new Promise((resolve, reject) => {
    function stop() {
      signal.removeEventListener("abort", stop);
      resolve({ stopped: true });
    }
    signal.addEventListener("abort", stop, { once: true });
    // Install both handlers even if the caller aborted synchronously inside
    // getRun: a late rejection must not become an unhandled rejection.
    request.then((value) => {
      signal.removeEventListener("abort", stop);
      resolve({ stopped: false, value });
    }, (error) => {
      signal.removeEventListener("abort", stop);
      reject(error);
    });
    if (signal.aborted) stop();
  });
}

/**
 * Wait on an existing run through the application facade. Only started,
 * running, and stopping states are polled. Terminal means completed, failed,
 * or cancelled; other states stop without inferring backend completion.
 *
 * Both budgets bound the local wait. Caller abort and timeout also end a wait
 * on an in-flight getRun, whose eventual result/rejection is safely ignored.
 * No submission, backend cancellation, transport abort, retry after a gap,
 * or client disposal is performed. Authentication and other rejected client
 * calls propagate unchanged. The caller owns the client and persists run IDs.
 */
export async function waitForRun(
  client: Pick<CapabilityClient, "getRun">,
  initialRun: RuntimeRunStatus,
  options: RunWaitOptions = {},
): Promise<RunWaitResult> {
  const { maxPolls = 60, pollIntervalMs = 1_000, maxWaitMs = 60_000, signal } = options;
  if (!Number.isSafeInteger(maxPolls) || maxPolls < 0 ||
      !Number.isInteger(pollIntervalMs) || pollIntervalMs < 0 || pollIntervalMs > MAX_TIMER_MS ||
      !Number.isInteger(maxWaitMs) || maxWaitMs < 0 || maxWaitMs > MAX_TIMER_MS) {
    throw new ApiClientError("Use a non-negative safe poll count and integer timer budgets up to 2,147,483,647 ms.", {
      type: ApiClientErrorType.Validation, code: ApiClientErrorCode.InvalidRequest,
    });
  }
  const initialReason = observedStopReason(initialRun.status);
  if (initialReason) return { reason: initialReason, run: initialRun, polls: 0 };
  if (signal?.aborted) return { reason: "aborted", run: initialRun, polls: 0 };
  if (maxPolls === 0) return { reason: "poll-limit", run: initialRun, polls: 0 };
  if (maxWaitMs === 0) return { reason: "timeout", run: initialRun, polls: 0 };

  let run = initialRun;
  let polls = 0;
  let interruption: "aborted" | "timeout" | undefined;
  const controller = new AbortController();
  function interrupt(reason: "aborted" | "timeout") {
    if (controller.signal.aborted) return;
    interruption = reason;
    controller.abort();
  }
  const callerAbort = () => interrupt("aborted");
  signal?.addEventListener("abort", callerAbort, { once: true });
  const deadline = setTimeout(() => interrupt("timeout"), maxWaitMs);
  try {
    if (signal?.aborted) callerAbort();
    while (true) {
      if (controller.signal.aborted) return { reason: interruption ?? "aborted", run, polls };
      const reason = observedStopReason(run.status);
      if (reason) return { reason, run, polls };
      if (polls >= maxPolls) return { reason: "poll-limit", run, polls };
      await pause(pollIntervalMs, controller.signal);
      if (controller.signal.aborted) return { reason: interruption ?? "aborted", run, polls };
      polls += 1;
      const observation = await observeOrStop(client.getRun(initialRun.run_id), controller.signal);
      if (observation.stopped) return { reason: interruption ?? "aborted", run, polls };
      if (!observation.value.ok) return { reason: "gap", run, polls, gap: observation.value.gap };
      run = observation.value.data;
    }
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener("abort", callerAbort);
  }
}
