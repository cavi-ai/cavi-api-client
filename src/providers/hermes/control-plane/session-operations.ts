import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import { normalizeTransportAbort } from "../../../core/transport/backoff.js";
import { getTransportErrorMetadata } from "../../../core/transport/error.js";
import type {
  GatewaySessionCancelResult,
  GatewaySessionOperations,
  GatewaySessionRequestOptions,
} from "../../../core/gateway/snapshots/session-operations.js";
import type { RawSessionRow } from "../../../core/gateway/snapshots/contracts.js";
import type {
  SessionDetailPayload,
  SessionsListRpcPayload,
} from "../../../core/gateway/snapshots/session-loaders.js";
import type { SessionsUsagePayload } from "../../../core/gateway/snapshots/transforms.js";
import type {
  HermesDashboardRestClient,
  HermesDashboardSession,
  HermesDashboardSessions,
} from "./dashboard-rest.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";
import type { HermesDashboardJsonRpcClient } from "./types.js";

function record(value: unknown, label: string): Record<string, unknown> {
  return requireHermesSafeJsonRecord(value, label);
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Hermes ${label} response failed schema validation`);
  }
  return value;
}

function optionalText(value: unknown, label: string): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string") throw new Error(`Hermes ${label} response failed schema validation`);
  return value;
}

function sessionRow(value: unknown): RawSessionRow {
  const row = record(value, "session row");
  if (typeof row.id !== "string" || row.id.length === 0) throw new Error("Hermes session row response failed schema validation");
  const startedAt = finite(row.started_at, "session started_at");
  const lastActive = row.last_active === undefined ? startedAt : finite(row.last_active, "session last_active");
  const title = optionalText(row.title, "session title");
  const source = optionalText(row.source, "session source");
  if (row.message_count !== undefined) finite(row.message_count, "session message_count");
  return {
    key: row.id,
    ...(title === undefined ? {} : { label: title }),
    ...(source === undefined ? {} : { channel: source }),
    createdAt: startedAt * 1_000,
    updatedAt: lastActive * 1_000,
    ...(row.is_active === true ? { state: "active" } : {}),
  };
}

function throwIfAborted(options?: GatewaySessionRequestOptions): void {
  if (!options?.signal?.aborted) return;
  throw normalizeTransportAbort(options.signal);
}

function isTransportUnavailable(error: unknown): boolean {
  const metadata = getTransportErrorMetadata(error);
  return metadata?.kind === "json-rpc"
    && (metadata.phase === "connect" || metadata.phase === "close");
}

function parseRpcList(value: unknown, requestedLimit: number | undefined): SessionsListRpcPayload {
  const payload = record(value, "session.list");
  if (!Array.isArray(payload.sessions)) throw new Error("Hermes session.list response failed schema validation");
  const sessions = payload.sessions.map(sessionRow);
  const total = payload.total === undefined
    ? sessions.length === requestedLimit && sessions.length < 200
      ? sessions.length + 1
      : sessions.length
    : finite(payload.total, "session.list total");
  if (!Number.isSafeInteger(total) || total < sessions.length) {
    throw new Error("Hermes session.list response failed schema validation");
  }
  return { sessions, count: total };
}

function parseRestList(value: HermesDashboardSessions): SessionsListRpcPayload {
  return { sessions: value.sessions.map(sessionRow), count: value.total };
}

function parseUsage(value: unknown): SessionsUsagePayload {
  const payload = record(value, "session.usage");
  if ("calls" in payload) {
    const calls = finite(payload.calls, "session.usage calls");
    finite(payload.input, "session.usage input");
    finite(payload.output, "session.usage output");
    finite(payload.total, "session.usage total");
    return { aggregates: { messages: { total: calls, toolCalls: 0, errors: 0 } }, totals: {} };
  }
  const totals = record(payload.totals, "usage totals");
  return {
    aggregates: {
      messages: { total: finite(totals.total_api_calls, "usage total_api_calls"), toolCalls: 0, errors: 0 },
    },
    totals: { totalCost: finite(totals.total_estimated_cost, "usage total_estimated_cost") },
  };
}

function detail(value: HermesDashboardSession): SessionDetailPayload {
  const startedAt = finite(value.started_at, "session detail started_at") * 1_000;
  const input = finite(value.input_tokens, "session detail input_tokens");
  const output = finite(value.output_tokens, "session detail output_tokens");
  const messages = finite(value.message_count, "session detail message_count");
  const cost = finite(value.estimated_cost_usd, "session detail estimated_cost_usd");
  const safe = record(value, "session detail");
  const row = sessionRow({ ...safe, last_active: value.ended_at ?? value.started_at });
  return {
    key: value.id,
    row: { ...row, createdAt: startedAt, totalTokens: input + output },
    usageSession: {
      key: value.id,
      ...(value.source === null ? {} : { channel: value.source }),
      ...(value.model === null ? {} : { model: value.model }),
      usage: { totalTokens: input + output, totalCost: cost, messageCounts: { total: messages, toolCalls: 0, errors: 0 } },
    },
  };
}

function parseInterrupt(id: string, value: unknown): GatewaySessionCancelResult {
  const payload = record(value, "session.interrupt");
  if (payload.status !== "interrupted" || Object.keys(payload).length !== 1) {
    throw new Error("Hermes session.interrupt response failed schema validation");
  }
  return { id, status: "cancelled", providerData: { status: "interrupted" } };
}

export function createHermesSessionOperations(options: {
  rpc: HermesDashboardJsonRpcClient;
  rest: HermesDashboardRestClient;
}): GatewaySessionOperations {
  const operations: GatewaySessionOperations = {
    async list(input, requestOptions) {
      throwIfAborted(requestOptions);
      try {
        const value = await options.rpc.request<unknown>("session.list", input, requestOptions);
        return parseRpcList(value, input.limit);
      } catch (error) {
        if (requestOptions?.signal?.aborted) throw normalizeTransportAbort(requestOptions.signal, error);
        if (!isTransportUnavailable(error)) throw error;
        return parseRestList(await options.rest.listSessions(requestOptions));
      }
    },
    async usage(input, requestOptions) {
      throwIfAborted(requestOptions);
      try {
        const value = await options.rpc.request<unknown>("session.usage", input, requestOptions);
        return parseUsage(value);
      } catch (error) {
        if (requestOptions?.signal?.aborted) throw normalizeTransportAbort(requestOptions.signal, error);
        if (!isTransportUnavailable(error)) throw error;
        return parseUsage(await options.rest.getUsage(requestOptions));
      }
    },
    preview: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.sessions.preview")),
    async detail(input, requestOptions) {
      throwIfAborted(requestOptions);
      try {
        return detail(await options.rest.getSession(input.key, requestOptions));
      } catch (error) {
        if (requestOptions?.signal?.aborted) throw normalizeTransportAbort(requestOptions.signal, error);
        throw error;
      }
    },
    patch: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.sessions.patch")),
    async cancel(id, requestOptions) {
      throwIfAborted(requestOptions);
      try {
        return parseInterrupt(id, await options.rpc.request<unknown>("session.interrupt", { session_id: id }, requestOptions));
      } catch (error) {
        if (requestOptions?.signal?.aborted) throw normalizeTransportAbort(requestOptions.signal, error);
        throw error;
      }
    },
  };
  return operations;
}
