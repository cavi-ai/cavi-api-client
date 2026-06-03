import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamApprovalChoice,
  type RunStreamEvent,
} from "../../core/gateway/run/contracts.js";
import { HERMES_API_ENDPOINTS } from "../../contracts/paths.js";
import { HermesSseRunEventProvider } from "./sse-run-event-provider.js";
import {
  RunPreviewPollProvider,
  createRunStreamWithToolFallback,
  type RunEventStreamSubscription,
  type RunPreviewSnapshotFetcher,
} from "../../core/gateway/run/event-stream.js";
import { toError } from "../../core/errors.js";
import { createRawHttpApiClient } from "../../core/http/raw-client.js";

/**
 * Provider-neutral metadata bag attached to a Hermes chat run. Free-form by
 * design — the gateway forwards untyped fields to route handlers. Use
 * {@link sanitizeHermesRouteMetadata} before sending to strip dict-valued
 * route binding keys some routers reject as malformed.
 */
export type HermesRouteMetadata = Record<string, unknown>;
export type GatewayRouteMetadata = HermesRouteMetadata;
export type HermesRouteSource = Record<string, unknown>;
export type GatewayRouteSource = HermesRouteSource;

const DICT_REJECTING_ROUTE_METADATA_KEYS = new Set(["binding", "routeBinding"]);

/**
 * Host-supplied route-channel policy. The provider knows no product agents; a
 * consumer maps its own default channel and agent→channel overrides (e.g. CAVI
 * passes `{ defaultChannel: "front-door", agentChannelOverrides: { tony: "front-door" } }`).
 */
export type RouteChannelConfig = {
  defaultChannel?: string;
  agentChannelOverrides?: Record<string, string>;
};

function isDict(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function cleanOptionalString(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function deriveThreadIdFromSessionKey(sessionKey: string): string | undefined {
  const parts = sessionKey.split(":");
  return cleanOptionalString(parts[parts.length - 1]);
}

function deriveRouteSourceChannelId(params: {
  targetProfile?: string;
  targetAgent?: string;
  routeChannel?: RouteChannelConfig;
}): string | undefined {
  const targetProfile = cleanOptionalString(params.targetProfile);
  if (targetProfile && targetProfile !== "default") {
    return targetProfile;
  }
  const targetAgent = cleanOptionalString(params.targetAgent);
  const config = params.routeChannel;
  if (targetProfile === "default") {
    const override = targetAgent
      ? cleanOptionalString(config?.agentChannelOverrides?.[targetAgent])
      : undefined;
    if (override) {
      return override;
    }
    if (!targetAgent && config?.defaultChannel) {
      return cleanOptionalString(config.defaultChannel);
    }
  }
  return targetProfile ?? targetAgent;
}

/**
 * Gateway route bindings are scalar fields (`targetProfile`, `targetAgent`,
 * `sessionKey`, `action`). Some routers validate dict-valued `binding` /
 * `routeBinding` keys and reject the whole chat turn — strip those before
 * forwarding metadata.
 */
export function sanitizeHermesRouteMetadata(
  metadata: HermesRouteMetadata | undefined,
): HermesRouteMetadata | undefined {
  if (!metadata || Object.keys(metadata).length === 0) {
    return undefined;
  }
  const out: HermesRouteMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (DICT_REJECTING_ROUTE_METADATA_KEYS.has(key) && isDict(value)) {
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const sanitizeGatewayRouteMetadata = sanitizeHermesRouteMetadata;

export function sanitizeHermesRouteSource(
  source: HermesRouteSource | undefined,
): HermesRouteSource | undefined {
  if (!source || Object.keys(source).length === 0) {
    return undefined;
  }
  const out: HermesRouteSource = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export const sanitizeGatewayRouteSource = sanitizeHermesRouteSource;

export function resolveHermesRouteSource(input: {
  clientId: string;
  sessionKey: string;
  targetProfile?: string;
  targetAgent?: string;
  harness?: string;
  source?: HermesRouteSource;
  routeChannel?: RouteChannelConfig;
}): HermesRouteSource | undefined {
  const explicit = sanitizeHermesRouteSource(input.source);
  const harness = cleanOptionalString(input.harness);
  if (!harness) {
    return explicit;
  }

  const generated = sanitizeHermesRouteSource({
    platform: "mobile_app",
    app_env: input.clientId,
    channel_id: deriveRouteSourceChannelId(input),
    conversation_id: input.sessionKey,
    thread_id: deriveThreadIdFromSessionKey(input.sessionKey),
    gateway_implementation: harness,
  });
  return sanitizeHermesRouteSource({ ...generated, ...explicit });
}

export const resolveGatewayRouteSource = resolveHermesRouteSource;

/**
 * A file sent with a chat turn. Base64 keeps it on the HTTP run path (gateway
 * field names are sent in snake AND camel case so the server can read whichever
 * casing it accepts).
 */
export type HermesChatRunAttachment = {
  name: string;
  mimeType: string;
  size: number;
  /** Base64-encoded file bytes (no data: prefix). */
  dataBase64: string;
};
export type GatewayChatRunAttachment = HermesChatRunAttachment;

function serializeAttachments(
  attachments: readonly HermesChatRunAttachment[],
): Record<string, unknown>[] {
  return attachments.map((a) => ({
    name: a.name,
    mime_type: a.mimeType,
    mimeType: a.mimeType,
    size: a.size,
    data_base64: a.dataBase64,
    dataBase64: a.dataBase64,
  }));
}

function addOptionalRunField(
  body: Record<string, unknown>,
  key: string,
  value: string | undefined,
): void {
  const trimmed = value?.trim();
  if (trimmed) body[key] = trimmed;
}

export type StartHermesChatRunParams = {
  httpBase: string;
  authToken: string;
  clientId: string;
  headers?: Record<string, string>;
  input: string;
  sessionId: string;
  /** Defaults to {@link sessionId} when omitted. */
  sessionKey?: string;
  targetProfile?: string;
  targetAgent?: string;
  action?: string;
  harness?: string;
  source?: HermesRouteSource;
  /** Host-supplied default/agent channel mapping (the provider bakes in none). */
  routeChannel?: RouteChannelConfig;
  metadata?: HermesRouteMetadata;
  attachments?: readonly HermesChatRunAttachment[];
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};
export type StartGatewayChatRunParams = StartHermesChatRunParams;

function createHermesChatRunHttpClient(params: {
  httpBase: string;
  authToken: string;
  clientId: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}) {
  return createRawHttpApiClient({
    surface: "hermes-chat-run",
    baseUrl: params.httpBase,
    authToken: params.authToken,
    clientId: params.clientId,
    defaultHeaders: params.headers,
    fetchImpl: params.fetchImpl,
  });
}

async function parseJsonResponse(
  response: Response,
  label: string,
): Promise<unknown> {
  const text = await response.text();
  try {
    return text.trim() ? (JSON.parse(text) as unknown) : {};
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

/**
 * Starts a Hermes chat run through the configured run endpoint. Sends route binding fields in
 * both snake AND camel case for cross-version gateway compatibility. Sanitizes
 * metadata via {@link sanitizeHermesRouteMetadata} before forwarding.
 *
 * Returns the new `run_id`. Pair with {@link HermesSseRunEventProvider} or
 * {@link streamHermesChatRun} to consume the event stream.
 */
export async function startHermesChatRun(
  params: StartHermesChatRunParams,
): Promise<{ runId: string }> {
  const sessionKey = params.sessionKey?.trim() || params.sessionId;
  const body: Record<string, unknown> = {
    input: params.input,
    session_id: params.sessionId,
    sessionKey,
    session_key: sessionKey,
  };
  addOptionalRunField(body, "targetProfile", params.targetProfile);
  addOptionalRunField(body, "target_profile", params.targetProfile);
  addOptionalRunField(body, "targetAgent", params.targetAgent);
  addOptionalRunField(body, "target_agent", params.targetAgent);
  addOptionalRunField(body, "action", params.action);

  const source = resolveHermesRouteSource({
    clientId: params.clientId,
    sessionKey,
    targetProfile: params.targetProfile,
    targetAgent: params.targetAgent,
    harness: params.harness,
    source: params.source,
    routeChannel: params.routeChannel,
  });
  if (source) {
    body.source = source;
  }

  if (params.metadata && Object.keys(params.metadata).length > 0) {
    const sanitized = sanitizeHermesRouteMetadata(params.metadata);
    if (sanitized) body.metadata = sanitized;
  }
  if (params.attachments && params.attachments.length > 0) {
    body.attachments = serializeAttachments(params.attachments);
  }

  const response = await createHermesChatRunHttpClient(params).raw(HERMES_API_ENDPOINTS.runs, {
    method: "POST",
    headers: { "X-Hermes-Session-Key": sessionKey },
    body,
    cache: "no-store",
    signal: params.signal,
  });

  const payload = await parseJsonResponse(response, "run start");
  const runId = isDict(payload) && typeof payload.run_id === "string"
    ? payload.run_id
    : "";
  if (!runId) {
    throw new Error("run start missing run_id");
  }
  return { runId };
}

export const startGatewayChatRun = startHermesChatRun;

export type ResolveHermesChatRunApprovalParams = {
  httpBase: string;
  authToken: string;
  clientId: string;
  headers?: Record<string, string>;
  runId: string;
  choice: RunStreamApprovalChoice;
  sessionKey?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};
export type ResolveGatewayChatRunApprovalParams = ResolveHermesChatRunApprovalParams;

/**
 * Resolves a pending approval gate through the configured run approval endpoint with
 * one of the canonical {@link RunStreamApprovalChoice} options.
 */
export async function resolveHermesChatRunApproval(
  params: ResolveHermesChatRunApprovalParams,
): Promise<void> {
  const headers: Record<string, string> = {};
  Object.assign(headers, params.headers ?? {});
  if (params.sessionKey?.trim()) {
    headers["X-Hermes-Session-Key"] = params.sessionKey.trim();
  }
  await createHermesChatRunHttpClient(params).raw(
    HERMES_API_ENDPOINTS.runApproval(params.runId),
    {
      method: "POST",
      headers,
      body: { choice: params.choice },
      cache: "no-store",
      signal: params.signal,
    },
  );
}

export const resolveGatewayChatRunApproval = resolveHermesChatRunApproval;

export type StreamHermesChatRunResult = {
  /**
   * True when at least one terminal lifecycle event was observed (delta /
   * completed / failed / cancelled). Callers use this to detect a silent
   * stream (no response) and trigger a fallback transport.
   */
  sawAssistantResponseEvent: boolean;
};
export type StreamGatewayChatRunResult = StreamHermesChatRunResult;

export type StreamHermesChatRunParams = StartHermesChatRunParams & {
  onEvent: (event: RunStreamEvent) => void;
  /**
   * Optional snapshot fetcher — when present, composes a tool-event fallback
   * via {@link RunPreviewPollProvider} so tool calls land in the stream even
   * when the Hermes SSE doesn't surface them. Once Hermes SSE catches up on
   * tool events, the fallback becomes a no-op automatically.
   */
  fetchToolEventSnapshot?: RunPreviewSnapshotFetcher;
};
export type StreamGatewayChatRunParams = StreamHermesChatRunParams;

/**
 * Canonical orchestrator: starts a Hermes chat run, subscribes to its event
 * stream via {@link HermesSseRunEventProvider}, and optionally stitches in
 * tool events from the post-hoc run preview via
 * {@link createRunStreamWithToolFallback}. Consumers receive canonical
 * {@link RunStreamEvent}s on `onEvent` — switch on `event.event` against
 * {@link RUN_STREAM_EVENT_NAMES}, never inline strings.
 */
export async function streamHermesChatRun(
  params: StreamHermesChatRunParams,
): Promise<StreamHermesChatRunResult> {
  const sessionKey = params.sessionKey?.trim() || params.sessionId;
  const { runId } = await startHermesChatRun({
    httpBase: params.httpBase,
    authToken: params.authToken,
    clientId: params.clientId,
    input: params.input,
    sessionId: params.sessionId,
    sessionKey,
    targetProfile: params.targetProfile,
    targetAgent: params.targetAgent,
    action: params.action,
    harness: params.harness,
    source: params.source,
    routeChannel: params.routeChannel,
    metadata: params.metadata,
    attachments: params.attachments,
    signal: params.signal,
    fetchImpl: params.fetchImpl,
  });

  const sseProvider = new HermesSseRunEventProvider({
    httpBase: params.httpBase,
    authToken: params.authToken,
    clientId: params.clientId,
    sessionKey,
    headers: params.headers,
    fetchImpl: params.fetchImpl,
  });

  const composed = params.fetchToolEventSnapshot
    ? createRunStreamWithToolFallback({
        primary: sseProvider,
        toolEventFallback: new RunPreviewPollProvider({
          fetchSnapshot: params.fetchToolEventSnapshot,
        }),
      })
    : sseProvider;

  let sawAssistantResponseEvent = false;

  return await new Promise<StreamHermesChatRunResult>((resolve, reject) => {
    let subscription: RunEventStreamSubscription | null = null;
    let settled = false;
    const settleResolve = (): void => {
      if (settled) return;
      settled = true;
      resolve({ sawAssistantResponseEvent });
    };
    const settleReject = (error: unknown): void => {
      if (settled) return;
      settled = true;
      reject(toError(error));
    };

    composed
      .subscribe(
        { runId, signal: params.signal },
        {
          onEvent: (event) => {
            if (
              event.event === RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA ||
              event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED ||
              event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED ||
              event.event === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED
            ) {
              sawAssistantResponseEvent = true;
            }
            try {
              params.onEvent(event);
            } catch (handlerError) {
              settleReject(handlerError);
            }
          },
          onError: settleReject,
          onComplete: settleResolve,
        },
      )
      .then((sub) => {
        subscription = sub;
        if (settled) {
          void Promise.resolve(sub.dispose());
        }
      })
      .catch(settleReject);

    if (params.signal) {
      const onAbort = (): void => {
        if (subscription) void Promise.resolve(subscription.dispose());
        settleReject(new Error("aborted"));
      };
      if (params.signal.aborted) {
        onAbort();
      } else {
        params.signal.addEventListener("abort", onAbort, { once: true });
      }
    }
  });
}

export const streamGatewayChatRun = streamHermesChatRun;
