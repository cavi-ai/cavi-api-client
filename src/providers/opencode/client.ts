import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, getErrorMessage, toError } from "../../core/errors.js";
import { HttpApiError } from "../../core/http/errors.js";
import { BaseHttpApiClient } from "../../core/http/client.js";
import type { HttpApiClientOptions, HttpApiTransport } from "../../core/http/types.js";
import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../core/runtime/dry-run.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../core/runtime/run.js";
import {
  combineAbortSignals,
  consumeSseStream,
  isSseContentType,
} from "../../core/sse/index.js";
import {
  markNonTerminalStreamError,
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";
import { SynchronousRunStore } from "../../core/runtime/synchronous-run-store.js";
import {
  encodeOpenCodeSessionId,
  OPENCODE_SERVER_VERSION,
  validateOpenCodeScope,
  type OpenCodeScope,
} from "./protocol.js";
import {
  opencodeHealthPath,
  opencodeEventPath,
  opencodeSessionAbortPath,
  opencodeSessionCreatePath,
  opencodeSessionMessagePath,
  opencodeSessionPath,
  opencodeSessionPromptAsyncPath,
  opencodeSessionStatusPath,
} from "./paths.js";
import { buildOpenCodePromptBody, type OpenCodePromptBody } from "./request.js";
import {
  mapOpenCodeMessageHistoryToRunStatus,
  mapOpenCodePromptResponseToRunStatus,
  parseOpenCodeHealthResponse,
  parseOpenCodeSessionStatusResponse,
  parseOpenCodeSessionResponse,
  type OpenCodeHealthResponse,
  type OpenCodeSessionResponse,
} from "./response.js";
import { parseOpenCodeEvent, translateOpenCodeEvent } from "./stream.js";
import { OPENCODE_RUNTIME_SUPPORT } from "./capabilities.js";

const OPENCODE_DEFAULT_USERNAME = "opencode";
const OPENCODE_UNKNOWN_SESSION_ERROR = "opencode: session not found";

export type OpenCodeApiClientOptions = {
  baseUrl: string;
  scope: OpenCodeScope;
  username?: string;
  password?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
  onTrace?: HttpApiClientOptions["onTrace"];
  defaultTimeoutMs?: number;
  cache?: RequestCache;
  credentials?: RequestCredentials;
};

function invalidConfig(message: string): ApiClientError {
  return new ApiClientError(`opencode: ${message}`, {
    type: ApiClientErrorType.Configuration,
    code: ApiClientErrorCode.InvalidConfig,
  });
}

function validateBaseUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidConfig("baseUrl is required");
  }

  const baseUrl = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw invalidConfig("baseUrl must be an absolute http(s) URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw invalidConfig("baseUrl must be an absolute http(s) URL");
  }
  if (parsed.username || parsed.password) {
    throw invalidConfig("baseUrl must not contain URL credentials");
  }
  if (parsed.search || parsed.hash) {
    throw invalidConfig("baseUrl must not contain a query or hash component");
  }
  return baseUrl;
}

function encodeUtf8Base64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return globalThis.btoa(binary);
}

function basicAuthResolver(username: unknown, password: unknown): (() => Record<string, string>) | undefined {
  if (typeof password !== "string" || password.length === 0) return undefined;
  const configuredUsername = typeof username === "string" && username.trim()
    ? username
    : OPENCODE_DEFAULT_USERNAME;
  const encoded = encodeUtf8Base64(`${configuredUsername}:${password}`);
  return () => ({ Authorization: `Basic ${encoded}` });
}

function redactSecrets(value: string, secrets: readonly string[]): string {
  return secrets.reduce((current, secret) => {
    // A whitespace-only password is a valid credential, but replacing it in
    // free-form text would redact every word separator in an error message.
    if (!secret.trim()) return current;
    return current.split(secret).join("[REDACTED]");
  }, value);
}

function sanitizeRunStatus(status: RuntimeRunStatus, secrets: readonly string[]): RuntimeRunStatus {
  if (typeof status.error !== "string") return status;
  const error = redactSecrets(status.error, secrets);
  return error === status.error ? status : { ...status, error };
}

function statusFromAbortResponse(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new ApiClientError("opencode: abort response must be a boolean", {
      type: ApiClientErrorType.Transport,
      code: ApiClientErrorCode.ProtocolMismatch,
    });
  }
  return value;
}

function sanitizeTransportError(error: unknown, secrets: readonly string[]): unknown {
  const message = getErrorMessage(error);
  const redacted = redactSecrets(message, secrets);
  if (error instanceof HttpApiError) {
    const redactedBody = redactSecrets(error.body, secrets);
    if (redacted === message && redactedBody === error.body) return error;
    return new HttpApiError({
      message: redacted,
      path: error.path,
      url: error.url,
      method: error.method,
      status: error.status,
      body: redactedBody,
    });
  }
  return new ApiClientError(redacted, {
    type: error instanceof ApiClientError ? error.type : ApiClientErrorType.Transport,
    code: error instanceof ApiClientError ? error.code : ApiClientErrorCode.RequestFailed,
  });
}

function isTerminalStreamEvent(event: RunStreamEvent): boolean {
  return event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED ||
    event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED ||
    event.event === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED;
}

function sanitizeStreamEvent(event: RunStreamEvent, secrets: readonly string[]): RunStreamEvent {
  if (event.event !== RUN_STREAM_EVENT_NAMES.RUN_FAILED || typeof event.error !== "string") return event;
  const error = redactSecrets(event.error, secrets);
  return error === event.error ? event : { ...event, error };
}

function streamProtocolError(message: string): ApiClientError {
  return new ApiClientError(`opencode: ${message}`, {
    type: ApiClientErrorType.Transport,
    code: ApiClientErrorCode.ProtocolMismatch,
  });
}

function raceWithCallerAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal | undefined,
  onLateResolve?: (value: T) => void | Promise<void>,
): Promise<T> {
  if (!signal) return operation;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => signal.removeEventListener("abort", onAbort);
    const handleLateResolve = (value: T): void => {
      if (!onLateResolve) return;
      try {
        void Promise.resolve(onLateResolve(value)).catch(() => undefined);
      } catch {
        // Late cleanup is best effort and must not become an unhandled rejection.
      }
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(signal.reason);
    };
    const onResolve = (value: T): void => {
      if (settled) {
        handleLateResolve(value);
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };
    const onReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener("abort", onAbort, { once: true });
    }
    operation.then(onResolve, onReject);
  });
}

function cancelResponseBody(response: Response): void {
  try {
    const cancellation = response.body?.cancel();
    if (cancellation) void cancellation.catch(() => undefined);
  } catch {
    // Late response cleanup is best effort.
  }
}

function sanitizeFetch(
  fetchImpl: typeof fetch,
  secrets: readonly string[],
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const response = await fetchImpl(input, init);
      if (response.ok || secrets.length === 0) return response;
      const body = await response.text();
      const redactedBody = redactSecrets(body, secrets);
      return new Response(redactedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      throw sanitizeTransportError(error, secrets);
    }
  }) as typeof fetch;
}

export class OpenCodeApiClient extends BaseHttpApiClient implements RuntimeClient {
  readonly request: HttpApiTransport;
  readonly scope: OpenCodeScope;
  private readonly defaultModel?: string;
  private readonly configuredPassword: boolean;
  private readonly authSecrets: readonly string[];
  private readonly runStore = new SynchronousRunStore();
  private healthPromise?: Promise<void>;

  constructor(options: OpenCodeApiClientOptions) {
    const baseUrl = validateBaseUrl(options?.baseUrl);
    const scope = validateOpenCodeScope(options?.scope);
    const auth = basicAuthResolver(options?.username, options?.password);
    const username = typeof options?.username === "string" && options.username.trim()
      ? options.username
      : OPENCODE_DEFAULT_USERNAME;
    const password = typeof options?.password === "string" ? options.password : "";
    const secrets = auth
      ? [username, password, encodeUtf8Base64(`${username}:${password}`)].filter((secret) => secret.trim())
      : [];
    const fetchImpl = options.fetchImpl ?? fetch;

    super("opencode", {
      baseUrl,
      includePortalClientIdHeader: false,
      ...(auth ? { auth: { resolveHeaders: auth } } : {}),
      defaultTimeoutMs: options.defaultTimeoutMs,
      cache: options.cache,
      credentials: options.credentials,
      fetchImpl: sanitizeFetch(fetchImpl, secrets),
      onTrace: options.onTrace,
    });
    this.request = this.createTransport();
    this.scope = scope;
    this.defaultModel = options.defaultModel;
    this.configuredPassword = Boolean(auth);
    this.authSecrets = secrets;
  }

  async getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
    return {
      providerKind: "opencode",
      protocolVersion: OPENCODE_SERVER_VERSION,
      auth: { type: "basic", required: this.configuredPassword },
      supports: OPENCODE_RUNTIME_SUPPORT,
    };
  }

  async probeHealth(): Promise<OpenCodeHealthResponse> {
    try {
      const response = await this.request<unknown>(opencodeHealthPath(), { method: "GET" });
      return parseOpenCodeHealthResponse(response);
    } catch (error) {
      throw sanitizeTransportError(error, this.authSecrets);
    }
  }

  private async ensureHealth(): Promise<void> {
    if (!this.healthPromise) {
      const attempt = this.probeHealth().then(() => undefined);
      const shared = attempt.catch((error: unknown) => {
        if (this.healthPromise === shared) this.healthPromise = undefined;
        throw error;
      });
      this.healthPromise = shared;
    }
    return this.healthPromise;
  }

  private async requestChecked<TResponse>(path: string, init?: Parameters<HttpApiTransport>[1]): Promise<TResponse> {
    try {
      return await this.request<TResponse>(path, init);
    } catch (error) {
      throw sanitizeTransportError(error, this.authSecrets);
    }
  }

  async startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus> {
    const payload = buildOpenCodePromptBody(body, this.defaultModel);
    if (body.dryRun) {
      return buildDryRunStatus(this.modelString(payload));
    }

    await this.ensureHealth();
    const created = parseOpenCodeSessionResponse(
      await this.requestChecked<unknown>(opencodeSessionCreatePath(this.scope), { method: "POST", body: {} }),
      this.scope,
    );
    const response = await this.requestChecked<unknown>(opencodeSessionMessagePath(this.scope, created.id), {
      method: "POST",
      body: payload,
    });
    const status = sanitizeRunStatus(mapOpenCodePromptResponseToRunStatus(response, created.id), this.authSecrets);
    this.runStore.remember(status);
    return status;
  }

  private modelString(payload: OpenCodePromptBody): string | undefined {
    return payload.model ? `${payload.model.providerID}/${payload.model.modelID}` : undefined;
  }

  async getRun(runId: string): Promise<RuntimeRunStatus> {
    encodeOpenCodeSessionId(runId);
    const remembered = this.runStore.get(runId);
    if (remembered) return remembered;

    await this.ensureHealth();
    let session: OpenCodeSessionResponse;
    try {
      session = parseOpenCodeSessionResponse(
        await this.requestChecked<unknown>(opencodeSessionPath(this.scope, runId), { method: "GET" }),
        this.scope,
      );
    } catch (error) {
      if (error instanceof HttpApiError && error.status === 404) {
        return { run_id: runId, status: "unknown", error: OPENCODE_UNKNOWN_SESSION_ERROR };
      }
      throw error;
    }
    if (session.id !== runId) {
      throw new ApiClientError("opencode: session ID does not match the requested run", {
        type: ApiClientErrorType.Transport,
        code: ApiClientErrorCode.ProtocolMismatch,
      });
    }

    const sessionStatus = parseOpenCodeSessionStatusResponse(
      await this.requestChecked<unknown>(opencodeSessionStatusPath(this.scope), { method: "GET" }),
      runId,
    );
    if (sessionStatus?.type === "busy" || sessionStatus?.type === "retry") {
      return { run_id: runId, status: "running" };
    }

    const status = sanitizeRunStatus(mapOpenCodeMessageHistoryToRunStatus(
      await this.requestChecked<unknown>(opencodeSessionMessagePath(this.scope, session.id), { method: "GET" }),
      runId,
    ), this.authSecrets);
    if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
      this.runStore.remember(status);
    }
    return status;
  }

  async cancelRun(runId: string): Promise<{ status: string }> {
    encodeOpenCodeSessionId(runId);
    await this.ensureHealth();
    const aborted = statusFromAbortResponse(
      await this.requestChecked<unknown>(opencodeSessionAbortPath(this.scope, runId), { method: "POST" }),
    );
    if (aborted) {
      this.runStore.remember({ run_id: runId, status: "cancelled" });
      return { status: "cancelled" };
    }
    return { status: this.runStore.get(runId)?.status ?? "unknown" };
  }

  async streamRun(
    body: RuntimeRunStartBody,
    handlers: RunEventStreamHandlers,
    options: { signal?: AbortSignal } = {},
  ): Promise<void> {
    const payload = buildOpenCodePromptBody(body, this.defaultModel);
    const callerSignal = options.signal;
    if (callerSignal?.aborted) return;
    if (body.dryRun) {
      handlers.onEvent(buildDryRunStreamEvent(this.modelString(payload)));
      handlers.onComplete?.();
      return;
    }

    const streamController = new AbortController();
    const streamSignal = combineAbortSignals(streamController.signal, callerSignal);
    let sessionId: string | undefined;
    let cleanupPromise: Promise<void> | undefined;
    let consumer: Promise<void> | undefined;
    let terminalSeen = false;
    let handlerFailure = false;
    const state = { promptAccepted: false };

    const cleanupCallerAbort = (): Promise<void> => {
      if (!sessionId) return Promise.resolve();
      if (!cleanupPromise) {
        const cleanupSignal = new AbortController().signal;
        cleanupPromise = this.requestChecked<unknown>(opencodeSessionAbortPath(this.scope, sessionId), {
          method: "POST",
          signal: cleanupSignal,
        }).then(() => undefined).catch(() => undefined);
      }
      return cleanupPromise;
    };
    const onCallerAbort = (): void => {
      streamController.abort();
      void cleanupCallerAbort();
    };
    if (callerSignal) callerSignal.addEventListener("abort", onCallerAbort, { once: true });

    const emitEvent = (event: RunStreamEvent): void => {
      try {
        handlers.onEvent(event);
      } catch (error) {
        handlerFailure = true;
        throw error;
      }
    };
    const reportError = (error: unknown): void => {
      if (!handlers.onError) throw error;
      try {
        handlers.onError(error);
      } catch (handlerError) {
        handlerFailure = true;
        throw handlerError;
      }
    };
    const settleConsumer = async (): Promise<void> => {
      if (!consumer) return;
      try {
        await consumer;
      } catch (error) {
        if (handlerFailure || (!terminalSeen && !callerSignal?.aborted)) throw error;
      }
    };

    try {
      await raceWithCallerAbort(this.ensureHealth(), callerSignal);
      if (callerSignal?.aborted) return;

      const sessionRequest = this.requestChecked<unknown>(opencodeSessionCreatePath(this.scope), {
        method: "POST",
        body: {},
        signal: callerSignal,
      });
      const created = parseOpenCodeSessionResponse(
        await raceWithCallerAbort(sessionRequest, callerSignal, (value) => {
          try {
            sessionId = parseOpenCodeSessionResponse(value, this.scope).id;
            void cleanupCallerAbort();
          } catch {
            // A malformed late response cannot identify a session to clean up.
          }
        }),
        this.scope,
      );
      sessionId = created.id;
      if (callerSignal?.aborted) {
        void cleanupCallerAbort();
        return;
      }

      const eventRequest = this.requestRaw(opencodeEventPath(this.scope), {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        signal: streamSignal,
      });
      const eventResponse = await raceWithCallerAbort(eventRequest, callerSignal, cancelResponseBody);
      if (callerSignal?.aborted || streamSignal.aborted) {
        cancelResponseBody(eventResponse);
        void cleanupCallerAbort();
        return;
      }
      if (!isSseContentType(eventResponse.headers.get("content-type"))) {
        cancelResponseBody(eventResponse);
        throw streamProtocolError("event response must use text/event-stream content type");
      }
      if (!eventResponse.body) {
        throw new ApiClientError("opencode: event response had no body", {
          type: ApiClientErrorType.Transport,
          code: ApiClientErrorCode.RequestFailed,
        });
      }
      if (callerSignal?.aborted || streamSignal.aborted) {
        cancelResponseBody(eventResponse);
        void cleanupCallerAbort();
        return;
      }

      consumer = consumeSseStream(eventResponse.body, streamSignal, (sse) => {
        if (terminalSeen || callerSignal?.aborted) return;
        let event: RunStreamEvent | null;
        try {
          event = translateOpenCodeEvent(parseOpenCodeEvent(sse.data), sessionId!, state);
        } catch (error) {
          reportError(markNonTerminalStreamError(toError(error)));
          return;
        }
        if (!event) return;
        const sanitized = sanitizeStreamEvent(event, this.authSecrets);
        if (isTerminalStreamEvent(sanitized)) {
          terminalSeen = true;
          if (sanitized.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED) {
            this.runStore.remember({ run_id: sanitized.runId, status: "completed" });
          } else if (sanitized.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED) {
            this.runStore.remember({ run_id: sanitized.runId, status: "failed", error: sanitized.error });
          } else {
            this.runStore.remember({ run_id: sanitized.runId, status: "cancelled" });
          }
        }
        emitEvent(sanitized);
        if (terminalSeen) streamController.abort();
      });

      const promptRequest = this.requestRaw(opencodeSessionPromptAsyncPath(this.scope, sessionId), {
        method: "POST",
        body: payload,
        signal: callerSignal,
      });
      const promptResponse = await raceWithCallerAbort(promptRequest, callerSignal);
      if (promptResponse.status !== 204) {
        cancelResponseBody(promptResponse);
        throw streamProtocolError(`prompt response must return HTTP 204, received ${promptResponse.status}`);
      }
      state.promptAccepted = true;

      await settleConsumer();
      if (callerSignal?.aborted) {
        void cleanupCallerAbort();
        return;
      }
      if (!terminalSeen) {
        const eof = new ApiClientError("opencode: SSE stream ended before a terminal event", {
          type: ApiClientErrorType.Transport,
          code: ApiClientErrorCode.TransportProtocolError,
        });
        reportError(eof);
        return;
      }
      try {
        handlers.onComplete?.();
      } catch (error) {
        handlerFailure = true;
        throw error;
      }
    } catch (error) {
      if (callerSignal?.aborted) {
        streamController.abort();
        void cleanupCallerAbort();
        void consumer?.catch(() => undefined);
        return;
      }
      streamController.abort();
      try {
        await consumer;
      } catch {
        // Preserve the original terminal failure below.
      }
      if (handlerFailure) throw error;
      const safeError = sanitizeTransportError(error, this.authSecrets);
      reportError(safeError);
    } finally {
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }
}
