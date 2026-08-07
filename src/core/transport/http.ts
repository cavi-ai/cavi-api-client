import { isAbortError } from "../errors.js";
import { TransportError } from "./error.js";
import { createTransportLifecycle, runTransportAttempts } from "./lifecycle.js";
import type {
  TransportAuthResolver,
  TransportDependencies,
  TransportLifecycleEvent,
  TransportOperationSafety,
  TransportRetryPolicy,
} from "./types.js";

export type HttpTransportRequest = Readonly<{
  method: "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  headers?: Readonly<Record<string, string>>;
  body?: BodyInit | null;
  response?: "response" | "json" | "text" | "bytes";
  idempotencyKey?: string;
  retry?: TransportRetryPolicy;
  signal?: AbortSignal;
}>;

export interface HttpTransport {
  request<T = unknown>(request: HttpTransportRequest): Promise<T>;
}

export type HttpTransportOptions = Readonly<{
  baseUrl: string;
  defaultHeaders?: Readonly<Record<string, string>>;
  auth?: TransportAuthResolver;
  fetchImpl?: typeof fetch;
  dependencies?: Partial<TransportDependencies>;
  onLifecycleEvent?: (event: TransportLifecycleEvent) => void;
}>;

const noRetry: TransportRetryPolicy = {
  maxAttempts: 1,
  baseDelayMs: 0,
  maxDelayMs: 0,
};

function normalizeBaseUrl(baseUrl: string): URL {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(normalized);
}

function normalizeIdempotencyKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}

function operationSafety(
  request: HttpTransportRequest,
  idempotencyKey: string | undefined,
): TransportOperationSafety {
  if (request.method === "GET" || request.method === "HEAD") return "read";
  return idempotencyKey === undefined ? "mutation" : "idempotent";
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (value === null) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, timestamp - now);
}

function mergeHeaders(
  defaults: Readonly<Record<string, string>> | undefined,
  request: HttpTransportRequest,
  authHeaders: Readonly<Record<string, string>>,
  idempotencyKey: string | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const setHeader = (name: string, value: string): void => {
    const existing = Object.keys(headers).find((candidate) =>
      candidate.toLowerCase() === name.toLowerCase());
    if (existing !== undefined) delete headers[existing];
    headers[name] = value;
  };
  for (const [name, value] of Object.entries(defaults ?? {})) setHeader(name, value);
  for (const [name, value] of Object.entries(request.headers ?? {})) setHeader(name, value);
  for (const [name, value] of Object.entries(authHeaders)) setHeader(name, value);
  const suppliedIdempotencyHeader = Object.keys(headers).find((name) =>
    name.toLowerCase() === "idempotency-key");
  if (suppliedIdempotencyHeader !== undefined) delete headers[suppliedIdempotencyHeader];
  if (idempotencyKey !== undefined) headers["Idempotency-Key"] = idempotencyKey;
  return headers;
}

async function decodeResponse(
  response: Response,
  mode: HttpTransportRequest["response"],
  operation: string,
  attempt: number,
): Promise<unknown> {
  if (mode === undefined || mode === "response") return response;
  if (response.status === 204 || response.status === 205) return undefined;
  try {
    if (mode === "json") return await response.json();
    if (mode === "text") return await response.text();
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new TransportError("HTTP response decoding failed", {
      metadata: {
        kind: "http",
        phase: "decode",
        operation,
        retryable: false,
        attempt,
        status: response.status,
      },
    });
  }
}

export function createHttpTransport(options: HttpTransportOptions): HttpTransport {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const lifecycle = createTransportLifecycle(options.onLifecycleEvent);
  const now = options.dependencies?.now ?? (() => Date.now());

  return {
    async request<T = unknown>(request: HttpTransportRequest): Promise<T> {
      const idempotencyKey = normalizeIdempotencyKey(request.idempotencyKey);
      const safety = operationSafety(request, idempotencyKey);
      const operation = `${request.method} ${request.path}`;
      const resolvedUrl = new URL(request.path, baseUrl);
      if (resolvedUrl.origin !== baseUrl.origin) {
        throw new TransportError("HTTP request URL must use the configured origin", {
          metadata: {
            kind: "http",
            phase: "configure",
            operation,
            retryable: false,
            attempt: 1,
          },
        });
      }
      const url = resolvedUrl.toString();

      return await runTransportAttempts<T>({
        kind: "http",
        operation,
        safety,
        policy: request.retry ?? noRetry,
        auth: options.auth,
        dependencies: options.dependencies,
        lifecycle,
        signal: request.signal,
        execute: async ({ attempt, headers: freshHeaders, signal }) => {
          const headers = mergeHeaders(options.defaultHeaders, request, freshHeaders, idempotencyKey);
          let response: Response;
          try {
            response = await fetchImpl(url, {
              method: request.method,
              headers,
              body: request.body,
              signal,
              redirect: "error",
            });
          } catch (error) {
            if (signal?.aborted || isAbortError(error)) throw error;
            throw new TransportError("HTTP request failed", {
              metadata: {
                kind: "http",
                phase: "request",
                operation,
                retryable: safety !== "mutation",
                attempt,
              },
            });
          }

          if (!response.ok) {
            const retryable = safety !== "mutation" && isTransientStatus(response.status);
            throw new TransportError(`HTTP request failed with status ${response.status}`, {
              metadata: {
                kind: "http",
                phase: "request",
                operation,
                retryable,
                attempt,
                status: response.status,
                retryAfterMs: retryable
                  ? parseRetryAfter(response.headers.get("Retry-After"), now())
                  : undefined,
              },
            });
          }

          return await decodeResponse(response, request.response, operation, attempt) as T;
        },
      });
    },
  };
}
