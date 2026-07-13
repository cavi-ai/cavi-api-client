import { isAbortError } from "../errors.js";
import { resolveTransportHeaders } from "./auth.js";
import {
  abortableSleep,
  computeBackoffDelay,
  normalizeTransportAbort,
  validateTransportRetryPolicy,
} from "./backoff.js";
import { getTransportErrorMetadata } from "./error.js";
import type {
  TransportAuthResolver,
  TransportDependencies,
  TransportKind,
  TransportLifecycle,
  TransportLifecycleEvent,
  TransportRetryPolicy,
} from "./types.js";

const defaultDependencies: TransportDependencies = {
  now: () => Date.now(),
  random: () => Math.random(),
  sleep: abortableSleep,
};

export function createTransportLifecycle(
  listener?: (event: TransportLifecycleEvent) => void,
): TransportLifecycle {
  const listeners = new Set<(event: TransportLifecycleEvent) => void>();
  if (listener) listeners.add(listener);
  return {
    emit(event) {
      for (const current of [...listeners]) current(event);
    },
    subscribe(current) {
      listeners.add(current);
      return () => listeners.delete(current);
    },
  };
}

export type TransportAttemptContext = Readonly<{
  attempt: number;
  headers: Readonly<Record<string, string>>;
  signal?: AbortSignal;
}>;

export async function runTransportAttempts<T>(options: Readonly<{
  kind: TransportKind;
  operation: string;
  policy: TransportRetryPolicy;
  execute: (context: TransportAttemptContext) => Promise<T>;
  auth?: TransportAuthResolver;
  headers?: Readonly<Record<string, string>>;
  dependencies?: Partial<TransportDependencies>;
  lifecycle?: TransportLifecycle;
  signal?: AbortSignal;
}>): Promise<T> {
  validateTransportRetryPolicy(options.policy);
  const dependencies = { ...defaultDependencies, ...options.dependencies };
  const startedAt = dependencies.now();

  for (let attempt = 1; attempt <= options.policy.maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw normalizeTransportAbort(options.signal);
    try {
      const headers = await resolveTransportHeaders(options.headers, options.auth);
      if (options.signal?.aborted) throw normalizeTransportAbort(options.signal);
      return await options.execute({ attempt, headers, signal: options.signal });
    } catch (error) {
      if (options.signal?.aborted || isAbortError(error)) {
        throw normalizeTransportAbort(options.signal, error);
      }
      const metadata = getTransportErrorMetadata(error);
      if (!metadata?.retryable || attempt >= options.policy.maxAttempts) throw error;
      const delayMs = computeBackoffDelay(
        options.policy,
        attempt,
        dependencies.random(),
        metadata.retryAfterMs,
      );
      if (options.policy.deadlineMs !== undefined &&
        dependencies.now() - startedAt + delayMs > options.policy.deadlineMs) {
        throw error;
      }
      options.lifecycle?.emit({
        state: "retrying",
        kind: options.kind,
        operation: options.operation,
        attempt,
        delayMs,
      });
      try {
        await dependencies.sleep(delayMs, options.signal);
      } catch (sleepError) {
        if (options.signal?.aborted || isAbortError(sleepError)) {
          throw normalizeTransportAbort(options.signal, sleepError);
        }
        throw sleepError;
      }
    }
  }
  throw new Error("Transport attempts exhausted");
}
