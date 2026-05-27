export const PORTAL_CLIENT_ID_HEADER = "X-Portal-Client-Id" as const;
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

// A free-form surface label used only for tracing/observability. Core stays
// surface-agnostic: callers (extensions/cavi, providers/*) pass whatever name
// identifies their surface. (A `"literal" | string` union collapses to `string`
// in TypeScript, so naming specific surfaces here bought no type safety — only
// leaked domain names into core.)
export type HttpApiClientSurface = string;

export type HttpApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpApiRequestInit = {
  method?: HttpApiHttpMethod;
  body?: unknown;
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
  idempotencyKey?: string;
  cache?: RequestCache;
  credentials?: RequestCredentials;
};

export type HttpApiTrace = {
  at: number;
  surface: HttpApiClientSurface;
  method: HttpApiHttpMethod;
  path: string;
  url: string;
  ok: boolean;
  status?: number;
  durationMs: number;
  error?: string;
};

export type HttpApiTransport = <TResponse>(
  path: string,
  init?: HttpApiRequestInit,
) => Promise<TResponse>;

export type HttpApiClientAuth = {
  bearerToken?: string | null;
  clientId?: string | null;
};

export type HttpApiClientOptions = {
  baseUrl: string;
  basePath?: string;
  allowRelativeBaseUrl?: boolean;
  auth?: HttpApiClientAuth;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  onTrace?: (trace: HttpApiTrace) => void;
};

export { HttpApiError, isHttpApiError } from "./errors.js";
