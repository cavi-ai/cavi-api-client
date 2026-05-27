export type GatewayJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "canceled"
  | "stopping"
  | "stopped"
  | string;

export type GatewayJobLike = {
  status?: GatewayJobStatus | null;
  error?: unknown;
};

export const GATEWAY_JOB_SUCCESS_STATUSES = [
  "completed",
  "succeeded",
  "success",
] as const;

export const GATEWAY_JOB_TERMINAL_STATUSES = [
  ...GATEWAY_JOB_SUCCESS_STATUSES,
  "failed",
  "error",
  "cancelled",
  "canceled",
  "stopped",
] as const;

export type GatewayJobWaitUpdate<TJob extends GatewayJobLike> = {
  attempt: number;
  elapsedMs: number;
  job: TJob;
};

export type GatewayJobSleep = (
  delayMs: number,
  signal?: AbortSignal,
) => Promise<void>;

export type GatewayJobWaitOptions<TJob extends GatewayJobLike> = {
  fetchJob: () => Promise<TJob>;
  intervalMs?: number;
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  onUpdate?: (update: GatewayJobWaitUpdate<TJob>) => void;
  isTerminal?: (job: TJob) => boolean;
  sleep?: GatewayJobSleep;
  now?: () => number;
};

export class GatewayJobTimeoutError<TJob extends GatewayJobLike> extends Error {
  readonly name = "GatewayJobTimeoutError";
  readonly attempts: number;
  readonly elapsedMs: number;
  readonly lastJob: TJob | null;

  constructor(params: {
    attempts: number;
    elapsedMs: number;
    lastJob: TJob | null;
  }) {
    super(
      `gateway job: timed out after ${params.attempts} attempt${
        params.attempts === 1 ? "" : "s"
      }`,
    );
    this.attempts = params.attempts;
    this.elapsedMs = params.elapsedMs;
    this.lastJob = params.lastJob;
  }
}

export class GatewayJobAbortError extends Error {
  readonly name = "GatewayJobAbortError";
  readonly reason: unknown;

  constructor(reason?: unknown) {
    super("gateway job: wait aborted");
    this.reason = reason;
  }
}

function normalizeStatus(status: GatewayJobStatus | null | undefined): string {
  return typeof status === "string" ? status.trim().toLowerCase() : "";
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || Math.floor(value) !== value) {
    throw new Error(`gateway job: ${label} must be a positive integer`);
  }
  return value;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new GatewayJobAbortError(signal.reason);
  }
}

function defaultSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  let abort: (() => void) | null = null;
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    abort = (): void => {
      clearTimeout(timeout);
      reject(new GatewayJobAbortError(signal?.reason));
    };

    signal?.addEventListener("abort", abort, { once: true });
  }).finally(() => {
    if (abort) signal?.removeEventListener("abort", abort);
  });
}

export function isGatewayJobSuccessfulStatus(
  status: GatewayJobStatus | null | undefined,
): boolean {
  const normalized = normalizeStatus(status);
  return GATEWAY_JOB_SUCCESS_STATUSES.includes(
    normalized as (typeof GATEWAY_JOB_SUCCESS_STATUSES)[number],
  );
}

export function isGatewayJobTerminalStatus(
  status: GatewayJobStatus | null | undefined,
): boolean {
  const normalized = normalizeStatus(status);
  return GATEWAY_JOB_TERMINAL_STATUSES.includes(
    normalized as (typeof GATEWAY_JOB_TERMINAL_STATUSES)[number],
  );
}

export async function waitForGatewayJob<TJob extends GatewayJobLike>(
  options: GatewayJobWaitOptions<TJob>,
): Promise<TJob> {
  const intervalMs = assertPositiveInteger(options.intervalMs ?? 1_000, "intervalMs");
  const timeoutMs = options.timeoutMs === undefined
    ? 60_000
    : assertPositiveInteger(options.timeoutMs, "timeoutMs");
  const maxAttempts = options.maxAttempts === undefined
    ? null
    : assertPositiveInteger(options.maxAttempts, "maxAttempts");
  const isTerminal = options.isTerminal ??
    ((job: TJob): boolean => isGatewayJobTerminalStatus(job.status));
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let attempts = 0;
  let lastJob: TJob | null = null;

  while (true) {
    throwIfAborted(options.signal);
    attempts += 1;
    const job = await options.fetchJob();
    lastJob = job;
    const elapsedMs = Math.max(0, now() - startedAt);
    options.onUpdate?.({ attempt: attempts, elapsedMs, job });

    if (isTerminal(job)) {
      return job;
    }

    if (maxAttempts !== null && attempts >= maxAttempts) {
      throw new GatewayJobTimeoutError({ attempts, elapsedMs, lastJob });
    }
    if (elapsedMs >= timeoutMs) {
      throw new GatewayJobTimeoutError({ attempts, elapsedMs, lastJob });
    }

    await sleep(Math.min(intervalMs, timeoutMs - elapsedMs), options.signal);
  }
}
