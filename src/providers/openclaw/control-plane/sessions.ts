import { toError } from "../../../core/errors.js";
import type {
  RuntimeSessionSummary,
  RuntimeSessionState,
} from "../../../core/runtime/control-plane/sessions.js";
import type { RuntimeControlPlaneMetadata } from "../../../core/runtime/control-plane/types.js";

import { normalizeTimestamp } from "./normalize.js";
import type { OpenClawRpc } from "./rpc.js";
import { parseOpenClaw } from "./protocol-error.js";
import {
  parseSessionsAbort,
  parseSessionsDescribe,
  parseSessionsList,
} from "./wire.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_UPSTREAM_SESSIONS = 200;
// Cursor offsets are zero-based positions inside the upstream's capped
// 200-session window, so 199 is the highest valid externally supplied offset.
const MAX_CURSOR_OFFSET = MAX_UPSTREAM_SESSIONS - 1;

type RequestOptions = { signal?: AbortSignal };
type ListOptions = RequestOptions & { cursor?: string; limit?: number };
type CancelOptions = RequestOptions & { operationId?: string };
type WireSession = {
  key: string;
  sessionId?: string;
  createdAt?: string | number;
  updatedAt?: string | number;
};
type WireAbort = {
  ok: true;
  abortedRunId: string | null;
  status: "aborted" | "no-active-run";
};

function metadata(
  method: string,
  providerData?: Record<string, unknown>,
): RuntimeControlPlaneMetadata {
  const result: RuntimeControlPlaneMetadata = {
    provider: "openclaw",
    stability: "experimental",
    source: { transport: "websocket", method },
  };
  if (providerData && Object.keys(providerData).length > 0) result.providerData = providerData;
  return result;
}

async function request(
  rpc: OpenClawRpc,
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  try {
    return await rpc.request(method, params, { signal });
  } catch (error) {
    throw toError(error, `OpenClaw ${method} request failed`);
  }
}

function encodeCursor(offset: number): string {
  const json = JSON.stringify({ v: 1, offset });
  return btoa(json).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    if (cursor.length === 0 || !/^[A-Za-z0-9_-]+$/u.test(cursor)) throw new TypeError();
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const value: unknown = JSON.parse(decoded);
    if (
      value === null
      || typeof value !== "object"
      || Array.isArray(value)
      || Object.keys(value).length !== 2
      || (value as { v?: unknown }).v !== 1
      || !Number.isSafeInteger((value as { offset?: unknown }).offset)
      || ((value as { offset: number }).offset < 0)
      || ((value as { offset: number }).offset > MAX_CURSOR_OFFSET)
      || encodeCursor((value as { offset: number }).offset) !== cursor
    ) throw new TypeError();
    return (value as { offset: number }).offset;
  } catch {
    throw new TypeError("Invalid OpenClaw session cursor");
  }
}

function pageSize(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1) throw new TypeError("Session page limit must be a positive integer");
  return Math.min(limit, MAX_UPSTREAM_SESSIONS);
}

function mapSession(
  session: WireSession,
  method: string,
  state: RuntimeSessionState = "unknown",
  providerData?: Record<string, unknown>,
): RuntimeSessionSummary {
  return {
    id: session.key,
    providerId: session.sessionId ?? session.key,
    state,
    ...(session.createdAt === undefined ? {} : { createdAt: normalizeTimestamp(session.createdAt) }),
    ...(session.updatedAt === undefined ? {} : { updatedAt: normalizeTimestamp(session.updatedAt) }),
    providerKind: "openclaw",
    metadata: metadata(method, providerData),
  };
}

export function createOpenClawSessionClient(rpc: OpenClawRpc) {
  return {
    async listSessions(options: ListOptions = {}) {
      const offset = decodeCursor(options.cursor);
      const limit = pageSize(options.limit);
      const upstreamLimit = Math.min(offset + limit, MAX_UPSTREAM_SESSIONS);
      const payload = await request(
        rpc,
        "sessions.list",
        { limit: upstreamLimit },
        options.signal,
      );
      return parseOpenClaw("sessions.list", () => {
        const parsed = parseSessionsList(payload);
        const sessions = parsed.sessions as WireSession[];
        const data = sessions.slice(offset, offset + limit).map((session) => mapSession(session, "sessions.list"));
        const nextOffset = offset + data.length;
        const hasNext = nextOffset < Math.min(parsed.count as number, MAX_UPSTREAM_SESSIONS)
          && nextOffset < sessions.length;
        return { data, ...(hasNext ? { nextCursor: encodeCursor(nextOffset) } : {}) };
      });
    },

    async getSession(id: string, options: RequestOptions = {}): Promise<RuntimeSessionSummary> {
      const payload = await request(
        rpc,
        "sessions.describe",
        { key: id },
        options.signal,
      );
      return parseOpenClaw("sessions.describe", () => {
        const parsed = parseSessionsDescribe(payload);
        if (parsed.session === null) throw new Error(`OpenClaw session not found: ${id}`);
        return mapSession(parsed.session as WireSession, "sessions.describe");
      });
    },

    async cancelSession(id: string, options: CancelOptions = {}): Promise<RuntimeSessionSummary> {
      const params: Record<string, unknown> = { key: id };
      if (options.operationId !== undefined) params.runId = options.operationId;
      const payload = await request(
        rpc,
        "sessions.abort",
        params,
        options.signal,
      );
      const parsed = parseOpenClaw("sessions.abort", () => parseSessionsAbort(payload)) as WireAbort;
      const cancelled = parsed.status === "aborted";
      const providerData: Record<string, unknown> = {
        found: cancelled,
        cancelled,
      };
      if (parsed.abortedRunId !== null) providerData.abortedRunId = parsed.abortedRunId;
      return mapSession(
        { key: id },
        "sessions.abort",
        cancelled ? "cancelled" : "unknown",
        providerData,
      );
    },
  };
}
