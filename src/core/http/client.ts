import { invalidConfigError } from "../error-factories.js";
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
import { redactPreviewText } from "./redaction.js";
import { getErrorMessage, isAbortError } from "../errors.js";

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CLIENT_ID = "cavi-api-client";

function normalizeBaseUrl(baseUrl: string, allowRelative = false): string {
  const trimmed = baseUrl.trim();
  if (!trimmed && allowRelative) return "";
  if (!trimmed) throw invalidConfigError("Missing baseUrl for HTTP API client");
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
  return redactPreviewText(body, 500);
}

function previewTraceText(value: string): string {
  return redactPreviewText(value, 2_000);
}

function buildUrl(baseUrl: string, basePath: string, path: string): string {
  return `${baseUrl}${basePath}${normalizePath(path)}`;
}

function buildRequestBody(init?: HttpApiRequestInit): BodyInit | undefined {
  if (!init) return undefined;
  if ("rawBody" in init && init.rawBody !== undefined) return init.rawBody;
  if (!("body" in init) || init.body === undefined) return undefined;
  return JSON.stringify(init.body);
}

function createRequestAbortSignal(
  timeoutMs: number,
  inputSignal?: AbortSignal,
): { signal: AbortSignal; source: () => "caller" | "timeout" | undefined; cleanup: () => void } {
  const controller = new AbortController();
  let source: "caller" | "timeout" | undefined;
  const abort = (nextSource: "caller" | "timeout", reason?: unknown): void => {
    if (controller.signal.aborted) return;
    source = nextSource;
    if (reason !== undefined) {
      controller.abort(reason);
      return;
    }
    controller.abort();
  };
  const abortFromInputSignal = (): void => abort("caller", inputSignal?.reason);

  if (inputSignal?.aborted) {
    abortFromInputSignal();
  } else {
    inputSignal?.addEventListener("abort", abortFromInputSignal, { once: true });
  }

  const timeout = setTimeout(() => abort("timeout"), timeoutMs);

  return {
    signal: controller.signal,
    source: () => source,
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
  readonly sendsPortalClientId: boolean;
  readonly defaultHeaders: Record<string, string>;
  readonly resolveAuthHeaders?: () => Record<string, string>;
  readonly defaultTimeoutMs: number;
  readonly cache: RequestCache;
  readonly credentials?: RequestCredentials;

  private readonly fetchImpl: typeof fetch;
  private readonly onTrace?: (trace: HttpApiTrace) => void;

  constructor(surface: HttpApiTrace["surface"], options: HttpApiClientOptions) {
    this.surface = surface;
    this.baseUrl = normalizeBaseUrl(options.baseUrl, options.allowRelativeBaseUrl);
    this.basePath = normalizeBasePath(options.basePath);
    this.authToken = options.auth?.bearerToken?.trim() ?? "";
    this.clientId = options.auth?.clientId?.trim() || DEFAULT_CLIENT_ID;
    this.sendsPortalClientId = options.includePortalClientIdHeader ?? true;
    this.defaultHeaders = { ...(options.defaultHeaders ?? {}) };
    this.resolveAuthHeaders = options.auth?.resolveHeaders;
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
    const headers: Record<string, string> = {};
    const names = new Map<string, string>();
    const mergeHeaders = (values: Record<string, string>): void => {
      for (const [name, value] of Object.entries(values)) {
        const normalized = name.toLowerCase();
        const previous = names.get(normalized);
        if (previous !== undefined && previous !== name) delete headers[previous];
        Object.defineProperty(headers, name, {
          value, enumerable: true, configurable: true, writable: true,
        });
        names.set(normalized, name);
      }
    };
    mergeHeaders({
      Accept: "application/json",
      ...(this.sendsPortalClientId ? { [PORTAL_CLIENT_ID_HEADER]: this.clientId } : {}),
    });
    mergeHeaders(this.defaultHeaders);
    mergeHeaders(init?.headers ?? {});

    if (this.resolveAuthHeaders) {
      mergeHeaders(this.resolveAuthHeaders());
    } else if (this.authToken) {
      mergeHeaders({ Authorization: `Bearer ${this.authToken}` });
    }
    if (init?.idempotencyKey) {
      mergeHeaders({ [IDEMPOTENCY_KEY_HEADER]: init.idempotencyKey });
    }
    if (init && "body" in init && init.body !== undefined && !names.has("content-type")) {
      mergeHeaders({ "Content-Type": "application/json" });
    }
    return headers;
  }

  protected buildBody(init?: HttpApiRequestInit): BodyInit | undefined {
    return buildRequestBody(init);
  }

  protected buildFetchInit(
    method: HttpApiHttpMethod,
    headers: Record<string, string>,
    body: BodyInit | undefined,
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
    return this.requestWithResponse(path, init, async (response) => response);
  }

  /** Keep the request deadline and caller signal active until the body consumer settles. */
  protected async requestWithResponse<T>(
    path: string,
    init: HttpApiRequestInit | undefined,
    consume: (response: Response) => Promise<T>,
  ): Promise<T> {
    const normalizedPath = this.resolvePath(path);
    const method: HttpApiHttpMethod = init?.method ?? "GET";
    const startedAt = Date.now();
    const timeoutMs = init?.timeoutMs ?? this.defaultTimeoutMs;
    const headers = this.buildHeaders(init);
    const body = this.buildBody(init);
    const url = this.resolveUrl(normalizedPath);
    const tracePath = previewTraceText(normalizedPath);
    const traceUrl = previewTraceText(url);
    const abortSignal = createRequestAbortSignal(timeoutMs, init?.signal);
    let consumingBody = false;

    try {
      if (init?.signal?.aborted) {
        throw init.signal.reason;
      }
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
          path: tracePath,
          url: traceUrl,
          ok: false,
          status: response.status,
          durationMs: Date.now() - startedAt,
          error: previewErrorBody(errorText),
        });
        throw new HttpApiError({
          message: `${method} ${tracePath} failed with HTTP ${response.status}`,
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
        path: tracePath,
        url: traceUrl,
        ok: true,
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      consumingBody = true;
      return await consume(response);
    } catch (error) {
      if (error instanceof HttpApiError) {
        throw error;
      }
      if (abortSignal.source() === "caller" && init?.signal && (error === init.signal.reason || isAbortError(error))) {
        throw init.signal.reason;
      }
      // Existing body/parser failures belong to their consumer. Only the
      // request deadline introduces a new transport failure during that phase.
      if (consumingBody && abortSignal.source() !== "timeout") throw error;
      const message = getErrorMessage(error);
      const safeMessage = previewErrorBody(message);
      this.emitTrace({
        at: Date.now(),
        surface: this.surface,
        method,
        path: tracePath,
        url: traceUrl,
        ok: false,
        durationMs: Date.now() - startedAt,
        error: safeMessage,
      });
      throw new HttpApiError({
        message: `${method} ${tracePath} failed: ${safeMessage}`,
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
    return this.requestWithResponse(path, init, async (response) => {
      const text = await response.text();
      if (!text.trim()) {
        return {} as TResponse;
      }
      try {
        return JSON.parse(text) as TResponse;
      } catch (error) {
        const contentType = response.headers.get("content-type") ?? "unknown";
        const preview = previewErrorBody(text.trim());
        const parseMessage = getErrorMessage(error);
        const safePath = previewTraceText(this.resolvePath(path));
        throw new HttpApiError({
          message: `${init?.method ?? "GET"} ${safePath} returned invalid JSON (${parseMessage}; content-type=${contentType}; preview=${preview})`,
          path: this.resolvePath(path),
          url: this.resolveUrl(path),
          method: init?.method ?? "GET",
          status: response.status,
          body: text,
        });
      }
    });
  }

  protected async requestBlob(path: string, init?: HttpApiRequestInit): Promise<Blob> {
    return this.requestWithResponse(path, init, (response) => response.blob());
  }

  createTransport(): HttpApiTransport {
    return <TResponse>(path: string, init?: HttpApiRequestInit): Promise<TResponse> =>
      this.requestJson<TResponse>(path, init);
  }
}
