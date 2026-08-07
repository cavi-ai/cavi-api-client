import { isAbortError } from "../errors.js";
import { consumeSseStream, isSseContentType } from "../sse/stream.js";
import type { SseMessage } from "../sse/stream.js";
import { resolveTransportHeaders } from "./auth.js";
import {
  abortableSleep,
  computeBackoffDelay,
  validateTransportRetryPolicy,
} from "./backoff.js";
import { TransportError } from "./error.js";
import { createTransportLifecycle } from "./lifecycle.js";
import type {
  TransportAuthResolver,
  TransportDependencies,
  TransportLifecycleEvent,
  TransportReconnectPolicy,
} from "./types.js";

export type SseConnectOptions = Readonly<{
  path: string;
  headers?: Readonly<Record<string, string>>;
  cursor?: string;
  reconnect?: TransportReconnectPolicy;
  signal?: AbortSignal;
  onMessage: (message: SseMessage) => void;
}>;

export interface SseSubscription {
  readonly done: Promise<void>;
  close(): void;
}

export interface SseTransport {
  subscribe(options: SseConnectOptions): SseSubscription;
}

export type SseTransportOptions = Readonly<{
  baseUrl: string;
  defaultHeaders?: Readonly<Record<string, string>>;
  auth?: TransportAuthResolver;
  fetchImpl?: typeof fetch;
  /** Maximum incomplete event buffer in UTF-8 bytes. Defaults to 16 MiB. */
  maxBufferBytes?: number;
  dependencies?: Partial<TransportDependencies>;
  onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;

const noReconnect: TransportReconnectPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

function normalizeBaseUrl(baseUrl: string): URL {
  return new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
}

function setHeader(headers: Record<string, string>, name: string, value: string): void {
  const existing = Object.keys(headers).find((candidate) =>
    candidate.toLowerCase() === name.toLowerCase());
  if (existing !== undefined) delete headers[existing];
  headers[name] = value;
}

function mergeHeaders(
  defaults: Readonly<Record<string, string>> | undefined,
  request: Readonly<Record<string, string>> | undefined,
  auth: Readonly<Record<string, string>>,
  cursor: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(defaults ?? {})) setHeader(headers, name, value);
  for (const [name, value] of Object.entries(request ?? {})) setHeader(headers, name, value);
  for (const [name, value] of Object.entries(auth)) setHeader(headers, name, value);
  if (cursor !== undefined && cursor.length > 0) setHeader(headers, "Last-Event-ID", cursor);
  return headers;
}

function validateDedupeCapacity(value: number | undefined): number {
  const capacity = value ?? 1_024;
  if (!Number.isInteger(capacity) || capacity < 0) {
    throw new TypeError("dedupeCapacity must be a non-negative integer");
  }
  return capacity;
}

function isSseBufferLimitError(error: unknown): boolean {
  return error instanceof RangeError &&
    (error as RangeError & { code?: unknown }).code === "sse-buffer-limit";
}

export function createSseTransport(transportOptions: SseTransportOptions): SseTransport {
  const baseUrl = normalizeBaseUrl(transportOptions.baseUrl);
  const fetchImpl = transportOptions.fetchImpl ?? globalThis.fetch;
  const dependencies: TransportDependencies = {
    now: transportOptions.dependencies?.now ?? (() => Date.now()),
    random: transportOptions.dependencies?.random ?? (() => Math.random()),
    sleep: transportOptions.dependencies?.sleep ?? abortableSleep,
  };
  const lifecycle = createTransportLifecycle(transportOptions.onLifecycleEvent);

  return {
    subscribe(connectOptions): SseSubscription {
      const policy = connectOptions.reconnect ?? noReconnect;
      validateTransportRetryPolicy(policy);
      const dedupeCapacity = validateDedupeCapacity(policy.dedupeCapacity);
      const controller = new AbortController();
      const operation = "subscribe";
      const resolvedUrl = new URL(connectOptions.path, baseUrl);
      if (resolvedUrl.origin !== baseUrl.origin) {
        throw new TransportError("SSE subscription URL must use the configured origin", {
          metadata: {
            kind: "sse",
            phase: "configure",
            operation,
            retryable: false,
            attempt: 1,
          },
        });
      }
      const url = resolvedUrl.toString();
      const seenIds = new Set<string>();
      let cursor = connectOptions.cursor;
      let closed = false;
      let finalAttempt = 1;
      let serverRetryMs: number | undefined;
      const startedAt = dependencies.now();

      const close = (): void => {
        if (!controller.signal.aborted) controller.abort();
      };
      const onExternalAbort = (): void => close();
      if (connectOptions.signal?.aborted) close();
      else connectOptions.signal?.addEventListener("abort", onExternalAbort, { once: true });

      const emitClosed = (): void => {
        if (closed) return;
        closed = true;
        lifecycle.emit({ state: "closed", kind: "sse", operation, attempt: finalAttempt });
      };

      const done = (async (): Promise<void> => {
        try {
          for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
            finalAttempt = attempt;
            if (controller.signal.aborted) return;
            lifecycle.emit({ state: "connecting", kind: "sse", operation, attempt });

            let response: Response;
            try {
              let authHeaders: Readonly<Record<string, string>>;
              try {
                authHeaders = (await resolveTransportHeaders(undefined, transportOptions.auth));
              } catch (error) {
                if (controller.signal.aborted || isAbortError(error)) return;
                throw new TransportError("Transport authentication failed", {
                  metadata: { kind: "sse", phase: "authenticate", operation, retryable: false, attempt },
                });
              }
              if (controller.signal.aborted) return;
              const headers = mergeHeaders(
                transportOptions.defaultHeaders,
                connectOptions.headers,
                authHeaders,
                cursor,
              );
              response = await fetchImpl(url, {
                method: "GET",
                headers,
                signal: controller.signal,
                redirect: "error",
              });
            } catch (error) {
              if (controller.signal.aborted || isAbortError(error)) return;
              const normalized = error instanceof TransportError ? error : new TransportError(
                "SSE connection failed",
                {
                  metadata: { kind: "sse", phase: "connect", operation, retryable: true, attempt },
                },
              );
              if (!normalized.transport.retryable || attempt >= policy.maxAttempts) throw normalized;
              await waitForReconnect(attempt, normalized.transport.retryAfterMs);
              continue;
            }

            if (!response.ok) {
              const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
              const error = new TransportError(`SSE connection failed with status ${response.status}`, {
                metadata: { kind: "sse", phase: "connect", operation, retryable, attempt, status: response.status },
              });
              if (!retryable || attempt >= policy.maxAttempts) throw error;
              await waitForReconnect(attempt);
              continue;
            }
            if (!isSseContentType(response.headers.get("Content-Type"))) {
              throw new TransportError("SSE response has an invalid content type", {
                metadata: { kind: "sse", phase: "decode", operation, retryable: false, attempt, status: response.status },
              });
            }
            if (!response.body) {
              throw new TransportError("SSE response body is unavailable", {
                metadata: { kind: "sse", phase: "decode", operation, retryable: false, attempt, status: response.status },
              });
            }

            lifecycle.emit({
              state: attempt === 1 ? "connected" : "reconnected",
              kind: "sse",
              operation,
              attempt,
            });
            try {
              await consumeSseStream(response.body, controller.signal, (message) => {
                if (message.retry !== undefined && message.retry >= 0) serverRetryMs = message.retry;
                const id = message.id;
                if (id !== undefined && id.length > 0) {
                  if (seenIds.has(id)) return;
                  cursor = id;
                  if (dedupeCapacity > 0) {
                    seenIds.add(id);
                    while (seenIds.size > dedupeCapacity) {
                      const oldest = seenIds.values().next().value as string | undefined;
                      if (oldest === undefined) break;
                      seenIds.delete(oldest);
                    }
                  }
                }
                try {
                  connectOptions.onMessage(message);
                } catch {
                  throw new TransportError("SSE message handler failed", {
                    metadata: {
                      kind: "sse",
                      phase: "decode",
                      operation,
                      retryable: false,
                      attempt,
                    },
                  });
                }
              }, { maxBufferBytes: transportOptions.maxBufferBytes });
            } catch (error) {
              if (controller.signal.aborted || isAbortError(error)) return;
              if (isSseBufferLimitError(error)) {
                throw new TransportError("SSE stream exceeds the configured size limit", {
                  metadata: {
                    kind: "sse",
                    phase: "decode",
                    operation,
                    retryable: false,
                    attempt,
                  },
                });
              }
              if (error instanceof TransportError && !error.transport.retryable) throw error;
              const normalized = new TransportError("SSE stream decoding failed", {
                metadata: { kind: "sse", phase: "decode", operation, retryable: true, attempt },
              });
              if (attempt >= policy.maxAttempts) throw normalized;
              await waitForReconnect(attempt, serverRetryMs);
              continue;
            }

            if (controller.signal.aborted || attempt >= policy.maxAttempts) return;
            await waitForReconnect(attempt, serverRetryMs);
          }
        } finally {
          connectOptions.signal?.removeEventListener("abort", onExternalAbort);
          emitClosed();
        }
      })();

      async function waitForReconnect(attempt: number, retryAfterMs?: number): Promise<void> {
        const delayMs = computeBackoffDelay(policy, attempt, dependencies.random(), retryAfterMs);
        if (policy.deadlineMs !== undefined &&
          dependencies.now() - startedAt + delayMs > policy.deadlineMs) {
          throw new TransportError("SSE reconnect deadline exceeded", {
            metadata: { kind: "sse", phase: "connect", operation, retryable: true, attempt },
          });
        }
        lifecycle.emit({ state: "retrying", kind: "sse", operation, attempt, delayMs });
        try {
          await dependencies.sleep(delayMs, controller.signal);
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          throw error;
        }
      }

      return { done, close };
    },
  };
}
