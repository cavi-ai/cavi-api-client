import {
  IDEMPOTENCY_KEY_HEADER,
  PORTAL_CLIENT_ID_HEADER,
  type HttpApiClientOptions,
  type HttpApiHttpMethod,
  type HttpApiRequestInit,
  type HttpApiTrace,
  type HttpApiTransport,
} from "./types.js";
import { HttpApiError } from "./errors.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CLIENT_ID = "cavi-api-client";

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) throw new Error("Missing baseUrl for HTTP API client");
  return trimmed.replace(/\/+$/, "");
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "/";
  return trimmed.charAt(0) === "/" ? trimmed : `/${trimmed}`;
}

function normalizeBasePath(basePath?: string): string {
  if (!basePath) return "";
  const path = normalizePath(basePath).replace(/\/+$/, "");
  return path === "/" ? "" : path;
}

function previewErrorBody(body: string): string {
  return body.length > 500 ? `${body.slice(0, 500)}…` : body;
}

function buildUrl(baseUrl: string, basePath: string, path: string): string {
  return `${baseUrl}${basePath}${normalizePath(path)}`;
}

function buildJsonBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return JSON.stringify(body);
}

function createRequestAbortSignal(
  timeoutMs: number,
  inputSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const abort = (reason?: unknown): void => {
    if (controller.signal.aborted) return;
    if (reason !== undefined) {
      controller.abort(reason);
      return;
    }
    controller.abort();
  };
  const abortFromInputSignal = (): void => abort(inputSignal?.reason);

  if (inputSignal?.aborted) {
    abortFromInputSignal();
  } else {
    inputSignal?.addEventListener("abort", abortFromInputSignal, { once: true });
  }

  const timeout = setTimeout(() => abort(), timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      inputSignal?.removeEventListener("abort", abortFromInputSignal);
    },
  };
}

export class BaseHttpApiClient {
  readonly surface: HttpApiTrace["surface"];
  readonly baseUrl: string;
  readonly basePath: string;
  readonly authToken: string;
  readonly clientId: string;
  readonly defaultTimeoutMs: number;
  readonly cache: RequestCache;
  readonly credentials?: RequestCredentials;

  private readonly fetchImpl: typeof fetch;
  private readonly onTrace?: (trace: HttpApiTrace) => void;

  constructor(surface: HttpApiTrace["surface"], options: HttpApiClientOptions) {
    this.surface = surface;
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.basePath = normalizeBasePath(options.basePath);
    this.authToken = options.auth?.bearerToken?.trim() ?? "";
    this.clientId = options.auth?.clientId?.trim() || DEFAULT_CLIENT_ID;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cache = options.cache ?? "no-store";
    this.credentials = options.credentials;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.onTrace = options.onTrace;
  }

  protected resolvePath(path: string): string {
    return normalizePath(path);
  }

  protected resolveUrl(path: string): string {
    return buildUrl(this.baseUrl, this.basePath, path);
  }

  protected buildHeaders(init?: HttpApiRequestInit): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      [PORTAL_CLIENT_ID_HEADER]: this.clientId,
      ...(init?.headers ?? {}),
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }
    if (init?.idempotencyKey) {
      headers[IDEMPOTENCY_KEY_HEADER] = init.idempotencyKey;
    }
    if (init && "body" in init && init.body !== undefined) {
      headers["Content-Type"] = headers["Content-Type"] ?? "application/json";
    }
    return headers;
  }

  protected buildBody(init?: HttpApiRequestInit): string | undefined {
    if (!init || !("body" in init)) return undefined;
    return buildJsonBody(init.body);
  }

  protected buildFetchInit(
    method: HttpApiHttpMethod,
    headers: Record<string, string>,
    body: string | undefined,
    signal: AbortSignal,
    init?: HttpApiRequestInit,
  ): RequestInit {
    return {
      method,
      headers,
      body,
      cache: init?.cache ?? this.cache,
      credentials: init?.credentials ?? this.credentials,
      signal,
    };
  }

  protected emitTrace(trace: HttpApiTrace): void {
    try {
      this.onTrace?.(trace);
    } catch {
      // Trace observers must not change request behavior.
    }
  }

  protected async requestRaw(path: string, init?: HttpApiRequestInit): Promise<Response> {
    const normalizedPath = this.resolvePath(path);
    const method: HttpApiHttpMethod = init?.method ?? "GET";
    const startedAt = Date.now();
    const timeoutMs = init?.timeoutMs ?? this.defaultTimeoutMs;
    const abortSignal = createRequestAbortSignal(timeoutMs, init?.signal);
    const headers = this.buildHeaders(init);
    const body = this.buildBody(init);
    const url = this.resolveUrl(normalizedPath);

    try {
      const response = await this.fetchImpl(
        url,
        this.buildFetchInit(method, headers, body, abortSignal.signal, init),
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.emitTrace({
          at: Date.now(),
          surface: this.surface,
          method,
          path: normalizedPath,
          url,
          ok: false,
          status: response.status,
          durationMs: Date.now() - startedAt,
          error: previewErrorBody(errorText),
        });
        throw new HttpApiError({
          message: `${method} ${normalizedPath} failed with HTTP ${response.status}`,
          path: normalizedPath,
          url,
          method,
          status: response.status,
          body: errorText,
        });
      }

      this.emitTrace({
        at: Date.now(),
        surface: this.surface,
        method,
        path: normalizedPath,
        url,
        ok: true,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      if (error instanceof HttpApiError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      this.emitTrace({
        at: Date.now(),
        surface: this.surface,
        method,
        path: normalizedPath,
        url,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: message,
      });
      throw new HttpApiError({
        message: `${method} ${normalizedPath} failed: ${message}`,
        path: normalizedPath,
        url,
        method,
        status: 0,
        body: "",
      });
    } finally {
      abortSignal.cleanup();
    }
  }

  protected async requestJson<TResponse>(path: string, init?: HttpApiRequestInit): Promise<TResponse> {
    const response = await this.requestRaw(path, init);
    const text = await response.text();
    if (!text.trim()) {
      return {} as TResponse;
    }
    try {
      return JSON.parse(text) as TResponse;
    } catch {
      throw new HttpApiError({
        message: `${init?.method ?? "GET"} ${this.resolvePath(path)} returned invalid JSON`,
        path: this.resolvePath(path),
        url: this.resolveUrl(path),
        method: init?.method ?? "GET",
        status: response.status,
        body: text,
      });
    }
  }

  protected async requestBlob(path: string, init?: HttpApiRequestInit): Promise<Blob> {
    const response = await this.requestRaw(path, init);
    return response.blob();
  }

  createTransport(): HttpApiTransport {
    return <TResponse>(path: string, init?: HttpApiRequestInit): Promise<TResponse> =>
      this.requestJson<TResponse>(path, init);
  }
}
