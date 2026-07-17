import type { GatewaySessionOperations } from "../../../core/gateway/snapshots/session-operations.js";
import type { RawSessionRow } from "../../../core/gateway/snapshots/contracts.js";
import type { ListSessionsOptions, RuntimeSessionSummary, SessionClient, SessionRequestOptions } from "../../../core/runtime/control-plane/sessions.js";
import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";

const DEFAULT_LIMIT = 50;
export const MAX_HERMES_SESSION_PAGE_SIZE = 200;

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
      || (value as { offset: number }).offset >= MAX_HERMES_SESSION_PAGE_SIZE
      || encodeCursor((value as { offset: number }).offset) !== cursor) throw new TypeError();
    return (value as { offset: number }).offset;
  } catch {
    throw new TypeError("Invalid Hermes session cursor");
  }
}

function pageLimit(value: number | undefined): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (!Number.isSafeInteger(value) || value < 1) throw new TypeError("Session page limit must be a positive integer");
  return Math.min(value, MAX_HERMES_SESSION_PAGE_SIZE);
}

function timestamp(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return new Date(value).toISOString();
}

function mapRow(row: RawSessionRow, method: string, transport: "json-rpc" | "http" = "json-rpc"): RuntimeSessionSummary {
  if (typeof row.key !== "string" || row.key.length === 0) throw new Error("Hermes canonical session response failed schema validation");
  const createdAt = timestamp(row.createdAt);
  const updatedAt = timestamp(row.updatedAt);
  const state = row.state ?? "unknown";
  return {
    id: row.key, providerId: row.key,
    ...(typeof row.label === "string" ? { title: row.label } : {}),
    state,
    ...(createdAt === undefined ? {} : { createdAt }),
    ...(updatedAt === undefined ? {} : { updatedAt }),
    providerKind: "hermes", metadata: metadata(method, undefined, transport),
  };
}

function detailRow(value: unknown): RawSessionRow {
  const row = requireHermesSafeJsonRecord(value, "canonical session detail");
  const state = row.state;
  if (state !== undefined && state !== "pending" && state !== "active" && state !== "completed"
    && state !== "cancelled" && state !== "failed" && state !== "unknown") {
    throw new Error("Hermes canonical session detail response failed schema validation");
  }
  return {
    ...(typeof row.key === "string" ? { key: row.key } : {}),
    ...(typeof row.label === "string" ? { label: row.label } : {}),
    ...(typeof row.createdAt === "number" || row.createdAt === null ? { createdAt: row.createdAt } : {}),
    ...(typeof row.updatedAt === "number" || row.updatedAt === null ? { updatedAt: row.updatedAt } : {}),
    ...(state === undefined ? {} : { state }),
  };
}

export function createHermesSessionClient(operations: GatewaySessionOperations): SessionClient {
  return {
    async listSessions(options: ListSessionsOptions = {}) {
      const offset = decodeCursor(options.cursor);
      const limit = pageLimit(options.limit);
      if (offset + limit > MAX_HERMES_SESSION_PAGE_SIZE) throw new TypeError("Hermes session page window exceeds the 200-session bound");
      const payload = await operations.list({ limit: offset + limit }, { signal: options.signal });
      if ("unchanged" in payload || !Array.isArray(payload.sessions)) throw new Error("Hermes canonical session list response failed schema validation");
      const data = payload.sessions.slice(offset, offset + limit).map((row) => mapRow(row, "session.list"));
      const total = typeof payload.count === "number" ? payload.count : payload.sessions.length;
      const nextOffset = offset + data.length;
      return { data, ...(data.length > 0 && nextOffset < total && nextOffset < MAX_HERMES_SESSION_PAGE_SIZE ? { nextCursor: encodeCursor(nextOffset) } : {}) };
    },
    async getSession(id: string, requestOptions: SessionRequestOptions = {}) {
      const payload = await operations.detail({ key: id }, requestOptions);
      if (payload.row === null || payload.row === undefined) throw new Error(`Hermes session not found: ${id}`);
      return mapRow(detailRow(payload.row), "session.detail", "http");
    },
    async cancelSession(id: string, requestOptions: SessionRequestOptions = {}) {
      if (!operations.cancel) throw new CapabilityUnavailable("hermes", "controlPlane.sessions.cancel");
      const result = await operations.cancel(id, requestOptions);
      return {
        id: result.id, providerId: result.id, state: result.status, providerKind: "hermes",
        metadata: metadata("session.interrupt", result.providerData),
      };
    },
  };
}
