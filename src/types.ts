export const PORTAL_CLIENT_ID_HEADER = "X-Portal-Client-Id" as const;
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key" as const;

export type HttpApiClientSurface =
  | "cavi-control-api"
  | "hermes-api-server"
  | "library-api"
  | "portal-api"
  | string;

export type HttpApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpApiRequestInit = {
  method?: HttpApiHttpMethod;
  body?: unknown;
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
  auth?: HttpApiClientAuth;
  defaultTimeoutMs?: number;
  fetchImpl?: typeof fetch;
  cache?: RequestCache;
  credentials?: RequestCredentials;
  onTrace?: (trace: HttpApiTrace) => void;
};

export class HttpApiError extends Error {
  readonly path: string;
  readonly url: string;
  readonly method: HttpApiHttpMethod;
  readonly status: number;
  readonly body: string;

  constructor(params: {
    message: string;
    path: string;
    url: string;
    method: HttpApiHttpMethod;
    status: number;
    body: string;
  }) {
    super(params.message);
    this.name = "HttpApiError";
    this.path = params.path;
    this.url = params.url;
    this.method = params.method;
    this.status = params.status;
    this.body = params.body;
  }
}
