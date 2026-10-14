import { protocolError } from "../../../core/error-factories.js";
import { ApiClientErrorType } from "../../../core/errors.js";
import { HERMES_API_ENDPOINTS, GATEWAY_SESSION_API_PATHS } from "../../../contracts/paths.js";
import { JsonHttpApiClient } from "../../../core/http/json-client.js";
import { GatewayHttpError } from "../../../core/http/gateway-error.js";
import type { ModelCatalogClient, RuntimeModelDescriptor } from "../../../core/runtime/control-plane/models.js";
import type { SessionClient, RuntimeSessionSummary } from "../../../core/runtime/control-plane/sessions.js";
import type { UsageClient } from "../../../core/runtime/control-plane/usage.js";
import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import { requireHermesSafeJsonRecord } from "./dashboard-rest.js";
import { HERMES_NATIVE_SESSIONS_PATH, hermesNativeSessionsPath } from "./api-server-paths.js";

type RequestOptions = Readonly<{
  baseUrl: string;
  token?: string;
  defaultHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
}>;

function metadata(method: string) {
  return { provider: "hermes", stability: "experimental" as const, source: { transport: "http" as const, method } };
}

function nonnegative(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw protocolError(ApiClientErrorType.Http, `Hermes API Server ${label} response failed schema validation`);
  }
  return value;
}

function optionalTimestamp(value: unknown): string | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return new Date(value).toISOString();
}

async function withOptionalSurface<T>(capability: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof GatewayHttpError && [404, 405, 501].includes(error.status)) {
      throw new CapabilityUnavailable("hermes", capability);
    }
    throw error;
  }
}

export function createHermesApiServerControlPlane(options: RequestOptions): {
  probe(): Promise<void>;
  models: ModelCatalogClient;
  sessions: SessionClient;
  usage: UsageClient;
} {
  const http = new JsonHttpApiClient("hermes-api-server", {
    baseUrl: options.baseUrl,
    allowRelativeBaseUrl: true,
    includePortalClientIdHeader: false,
    defaultHeaders: options.defaultHeaders,
    auth: { bearerToken: options.defaultHeaders === undefined ? options.token ?? null : null },
    fetchImpl: options.fetchImpl,
  });
  const get = <T>(path: string, signal?: AbortSignal) => http.request<T>(path, { method: "GET", signal });
  let nativeSessions = false;

  const sessions: SessionClient = {
    async listSessions(query = {}) {
      if (!nativeSessions && query.cursor !== undefined) throw new CapabilityUnavailable("hermes", "controlPlane.sessions.cursor");
      const pageLimit = query.limit ?? 50;
      const offset = query.cursor === undefined ? 0 : /^hermes-offset:\d+$/u.test(query.cursor) ? Number(query.cursor.slice(14)) : NaN;
      if (nativeSessions && (!Number.isSafeInteger(pageLimit) || pageLimit < 0 || pageLimit > 200
        || !Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)) {
        throw new TypeError("Hermes session pagination requires a limit from 0 to 200 and a valid cursor");
      }
      const path = nativeSessions ? hermesNativeSessionsPath(pageLimit, offset) : GATEWAY_SESSION_API_PATHS.list;
      const value = await withOptionalSurface("controlPlane.sessions.list", () => get<unknown>(path, query.signal));
      const payload = requireHermesSafeJsonRecord(value, "API Server sessions");
      const rows = nativeSessions ? payload.data : payload.sessions;
      if (!Array.isArray(rows) || (nativeSessions && (payload.object !== "list" || typeof payload.has_more !== "boolean"
        || payload.limit !== pageLimit || payload.offset !== offset))) throw protocolError(ApiClientErrorType.Http, "Hermes API Server sessions response failed schema validation");
      const limit = query.limit === undefined ? rows.length : Math.max(0, query.limit);
      const data = (nativeSessions ? rows : rows.slice(0, limit)).map((entry): RuntimeSessionSummary => {
        const row = requireHermesSafeJsonRecord(entry, "API Server session row");
        const id = typeof row.key === "string" ? row.key : typeof row.id === "string" ? row.id : "";
        if (!id) throw protocolError(ApiClientErrorType.Http, "Hermes API Server session row response failed schema validation");
        const state = row.state === "pending" || row.state === "active" || row.state === "completed"
          || row.state === "cancelled" || row.state === "failed" ? row.state : "unknown";
        const createdAt = optionalTimestamp(row.createdAt ?? (typeof row.started_at === "number" ? row.started_at * 1_000 : undefined));
        const updatedAt = optionalTimestamp(row.updatedAt ?? (typeof row.last_active === "number" ? row.last_active * 1_000 : undefined));
        return {
          id, providerId: id,
          ...(typeof row.label === "string" ? { title: row.label } : typeof row.title === "string" ? { title: row.title } : {}),
          state,
          ...(createdAt === undefined ? {} : { createdAt }),
          ...(updatedAt === undefined ? {} : { updatedAt }),
          providerKind: "hermes", metadata: metadata("sessions.list"),
        };
      });
      if (nativeSessions && payload.has_more && offset + pageLimit > 1_000_000) {
        throw protocolError(ApiClientErrorType.Http, "Hermes session pagination limit exceeded");
      }
      return { data, ...(nativeSessions && payload.has_more && pageLimit > 0
        ? { nextCursor: `hermes-offset:${offset + pageLimit}` } : {}) };
    },
    getSession: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.sessions.get")),
    cancelSession: () => Promise.reject(new CapabilityUnavailable("hermes", "controlPlane.sessions.cancel")),
  };

  return {
    async probe() {
      const value = requireHermesSafeJsonRecord(await get<unknown>(HERMES_API_ENDPOINTS.capabilities), "API Server capabilities");
      if (value.object !== "hermes.api_server.capabilities" || value.platform !== "hermes-agent") {
        throw protocolError(ApiClientErrorType.Http, "Hermes API Server capabilities response failed schema validation");
      }
      nativeSessions = false;
      if (value.endpoints !== undefined) {
        const endpoints = requireHermesSafeJsonRecord(value.endpoints, "API Server endpoints");
        if (endpoints.sessions !== undefined) {
          const endpoint = requireHermesSafeJsonRecord(endpoints.sessions, "API Server sessions endpoint");
          nativeSessions = endpoint.method === "GET" && endpoint.path === HERMES_NATIVE_SESSIONS_PATH;
        }
      }
    },
    models: {
      async listModels() {
        const value = await withOptionalSurface("controlPlane.models.list", () => get<unknown>(HERMES_API_ENDPOINTS.models));
        const payload = requireHermesSafeJsonRecord(value, "API Server models");
        if (payload.object !== "list" || !Array.isArray(payload.data)) throw protocolError(ApiClientErrorType.Http, "Hermes API Server models response failed schema validation");
        const data = payload.data.map((entry): RuntimeModelDescriptor => {
          const model = requireHermesSafeJsonRecord(entry, "API Server model");
          if (typeof model.id !== "string" || !model.id) throw protocolError(ApiClientErrorType.Http, "Hermes API Server model response failed schema validation");
          return { providerId: "hermes", id: model.id, displayName: model.id, availability: "available", metadata: metadata("models") };
        });
        return { data };
      },
    },
    sessions,
    usage: {
      async getUsage() {
        if (nativeSessions) throw new CapabilityUnavailable("hermes", "controlPlane.usage.get");
        const value = await withOptionalSurface("controlPlane.usage.get", () => get<unknown>(GATEWAY_SESSION_API_PATHS.usage));
        const payload = requireHermesSafeJsonRecord(value, "API Server session usage");
        if (!Array.isArray(payload.sessions)) throw protocolError(ApiClientErrorType.Http, "Hermes API Server session usage response failed schema validation");
        let totalTokens = 0;
        for (const entry of payload.sessions) {
          const row = requireHermesSafeJsonRecord(entry, "API Server usage row");
          const usage = requireHermesSafeJsonRecord(row.usage, "API Server usage totals");
          totalTokens += nonnegative(usage.totalTokens ?? 0, "usage totalTokens");
        }
        const aggregates = requireHermesSafeJsonRecord(payload.aggregates ?? {}, "API Server usage aggregates");
        const messages = requireHermesSafeJsonRecord(aggregates.messages ?? {}, "API Server usage messages");
        return {
          tokens: { totalTokens, raw: {
            requests: nonnegative(messages.total ?? 0, "usage messages"),
            toolCalls: nonnegative(messages.toolCalls ?? 0, "usage toolCalls"),
            errors: nonnegative(messages.errors ?? 0, "usage errors"),
          } },
          cost: { availability: "unavailable" as const },
          aggregation: "api-server-sessions",
          metadata: metadata("sessions.usage"),
        };
      },
    },
  };
}
