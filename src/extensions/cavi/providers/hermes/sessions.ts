import type { GatewaySessionOperations } from "../../../../core/gateway/snapshots/session-operations.js";
import type { RuntimeSessionSummary, SessionClient } from "../../../../core/runtime/control-plane/sessions.js";
import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { getHermesInterruptOperation } from "./session-operations.js";

type RequestOptions = { signal?: AbortSignal };
type ListOptions = RequestOptions & { cursor?: string; limit?: number };
type HermesSessionClient = SessionClient & {
  listSessions(options?: ListOptions): ReturnType<SessionClient["listSessions"]>;
  getSession(id: string, options?: RequestOptions): ReturnType<SessionClient["getSession"]>;
  cancelSession(id: string, options?: RequestOptions): Promise<RuntimeSessionSummary>;
};

const DEFAULT_LIMIT = 50;

function metadata(method: string, providerData?: Record<string, unknown>, transport: "json-rpc" | "http" = "json-rpc"): RuntimeSessionSummary["metadata"] {
  return {
    provider: "hermes", stability: "experimental", source: { transport, method },
    ...(providerData ? { providerData } : {}),
  };
}

function encodeCursor(offset: number): string {
  return btoa(JSON.stringify({ v: 1, offset })).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    if (!/^[A-Za-z0-9_-]+$/u.test(cursor)) throw new TypeError();
    const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/");
    const value = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="))) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== 2 || (value as { v?: unknown }).v !== 1
      || !Number.isSafeInteger((value as { offset?: unknown }).offset)
      || (value as { offset: number }).offset < 0
      || encodeCursor((value as { offset: number }).offset) !== cursor) throw new TypeError();
    return (value as { offset: number }).offset;
  } catch {
    throw new TypeError("Invalid Hermes session cursor");
  }
}

function pageLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("Session page limit must be a positive integer");
  return value;
}

function timestamp(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return new Date(value).toISOString();
}

function mapRow(value: unknown, method: string, transport: "json-rpc" | "http" = "json-rpc"): RuntimeSessionSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Hermes canonical session response failed schema validation");
  const row = value as Record<string, unknown>;
  if (typeof row.key !== "string" || row.key.length === 0) throw new Error("Hermes canonical session response failed schema validation");
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  const state = row.state === "active" || row.state === "completed" ? row.state : "unknown";
  return {
    id: row.key, providerId: row.key,
    ...(typeof row.label === "string" ? { title: row.label } : {}),
    state,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    providerKind: "hermes", metadata: metadata(method, undefined, transport),
  };
}

export function createHermesSessionClient(operations: GatewaySessionOperations): HermesSessionClient {
  return {
    async listSessions(options: ListOptions = {}) {
      const offset = decodeCursor(options.cursor);
      const limit = pageLimit(options.limit);
      const payload = await operations.list({ limit: offset + limit }, { signal: options.signal });
      if ("unchanged" in payload || !Array.isArray(payload.sessions)) throw new Error("Hermes canonical session list response failed schema validation");
      const data = payload.sessions.slice(offset, offset + limit).map((row) => mapRow(row, "session.list"));
      const total = typeof payload.count === "number" ? payload.count : payload.sessions.length;
      const nextOffset = offset + data.length;
      return { data, ...(nextOffset < total && nextOffset < payload.sessions.length ? { nextCursor: encodeCursor(nextOffset) } : {}) };
    },
    async getSession(id: string, requestOptions: RequestOptions = {}) {
      const payload = await operations.detail({ key: id }, requestOptions);
      if (payload.row === null || payload.row === undefined) throw new Error(`Hermes session not found: ${id}`);
      return mapRow(payload.row, "session.detail", "http");
    },
    async cancelSession(id: string, requestOptions: RequestOptions = {}) {
      const interrupt = getHermesInterruptOperation(operations);
      if (!interrupt) throw new CapabilityUnavailable("hermes", "controlPlane.sessions.cancel");
      const result = await interrupt(id, requestOptions);
      return {
        id, providerId: id, state: "cancelled", providerKind: "hermes",
        metadata: metadata("session.interrupt", { status: result.status }),
      };
    },
  };
}
