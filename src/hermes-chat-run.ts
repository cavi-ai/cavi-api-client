import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamApprovalChoice,
  type RunStreamEvent,
} from "./domain/runs.js";
import { HERMES_API_ENDPOINTS } from "./paths.js";
import { HermesSseRunEventProvider } from "./hermes-sse-provider.js";
import {
  RunPreviewPollProvider,
  createRunStreamWithToolFallback,
  type RunEventStreamSubscription,
  type RunPreviewSnapshotFetcher,
} from "./run-event-stream.js";

/**
 * Provider-neutral metadata bag attached to a Hermes chat run. Free-form by
 * design — the gateway forwards untyped fields to route handlers. Use
 * {@link sanitizeHermesRouteMetadata} before sending to strip dict-valued
 * route binding keys some routers reject as malformed.
 */
export type HermesRouteMetadata = Record<string, unknown>;

const DICT_REJECTING_ROUTE_METADATA_KEYS = new Set(["binding", "routeBinding"]);

function isDict(value: unknown): boolean {
  return Boolean(value) && typeof value === "object";
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
  input: string;
  sessionId: string;
  /** Defaults to {@link sessionId} when omitted. */
  sessionKey?: string;
  targetProfile?: string;
  targetAgent?: string;
  action?: string;
  metadata?: HermesRouteMetadata;
  attachments?: readonly HermesChatRunAttachment[];
  signal?: AbortSignal;
};

/**
 * POST `/v1/runs` to start a Hermes chat run. Sends route binding fields in
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
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Portal-Client-Id": params.clientId,
    "X-Hermes-Session-Key": sessionKey,
  };
  if (params.authToken.trim()) {
    headers.Authorization = `Bearer ${params.authToken.trim()}`;
  }

  const body: Record<string, unknown> = {
    input: params.input,
    session_id: params.sessionId,
  };
  addOptionalRunField(body, "targetProfile", params.targetProfile);
  addOptionalRunField(body, "target_profile", params.targetProfile);
  addOptionalRunField(body, "targetAgent", params.targetAgent);
  addOptionalRunField(body, "target_agent", params.targetAgent);
  addOptionalRunField(body, "action", params.action);

  if (params.metadata && Object.keys(params.metadata).length > 0) {
    const sanitized = sanitizeHermesRouteMetadata(params.metadata);
    if (sanitized) body.metadata = sanitized;
  }
  if (params.attachments && params.attachments.length > 0) {
    body.attachments = serializeAttachments(params.attachments);
  }

  const response = await fetch(`${params.httpBase}${HERMES_API_ENDPOINTS.runs}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
    signal: params.signal,
  });

  if (!response.ok) {
    throw new Error(`run start failed with HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { run_id?: string };
  const runId = typeof payload.run_id === "string" ? payload.run_id : "";
  if (!runId) {
    throw new Error("run start missing run_id");
  }
  return { runId };
}

export type ResolveHermesChatRunApprovalParams = {
  httpBase: string;
  authToken: string;
  clientId: string;
  runId: string;
  choice: RunStreamApprovalChoice;
  sessionKey?: string;
  signal?: AbortSignal;
};

/**
 * POST `/v1/runs/{run_id}/approval` to resolve a pending approval gate with
 * one of the canonical {@link RunStreamApprovalChoice} options.
 */
export async function resolveHermesChatRunApproval(
  params: ResolveHermesChatRunApprovalParams,
): Promise<void> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Portal-Client-Id": params.clientId,
  };
  if (params.authToken.trim()) {
    headers.Authorization = `Bearer ${params.authToken.trim()}`;
  }
  if (params.sessionKey?.trim()) {
    headers["X-Hermes-Session-Key"] = params.sessionKey.trim();
  }
  const response = await fetch(
    `${params.httpBase}${HERMES_API_ENDPOINTS.runApproval(params.runId)}`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ choice: params.choice }),
      cache: "no-store",
      signal: params.signal,
    },
  );
  if (!response.ok) {
    throw new Error(`approval resolve failed with HTTP ${response.status}`);
  }
}

export type StreamHermesChatRunResult = {
  /**
   * True when at least one terminal lifecycle event was observed (delta /
   * completed / failed / cancelled). Callers use this to detect a silent
   * stream (no response) and trigger a fallback transport.
   */
  sawAssistantResponseEvent: boolean;
};

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
    metadata: params.metadata,
    attachments: params.attachments,
    signal: params.signal,
  });

  const sseProvider = new HermesSseRunEventProvider({
    httpBase: params.httpBase,
    authToken: params.authToken,
    clientId: params.clientId,
    sessionKey,
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
      reject(error instanceof Error ? error : new Error(String(error)));
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
