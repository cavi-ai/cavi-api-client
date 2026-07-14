import { JsonHttpApiClient } from "../../../../core/http/json-client.js";
import { GatewayHttpError } from "../../../../core/http/gateway-error.js";
import { HttpApiError } from "../../../../core/http/errors.js";
import { redactPreviewText, stringifyRedacted } from "../../../../core/http/redaction.js";
import type { CredentialResolver } from "../../../../core/http/credentials.js";
import type { HttpApiRequestInit } from "../../../../core/http/types.js";
import { HERMES_DASHBOARD_PATHS } from "./dashboard-paths.js";

type JsonRecord = Record<string, unknown>;

export type HermesDashboardSessions = Readonly<{
  sessions: readonly JsonRecord[];
  total: number;
  limit: number;
  offset: number;
}> & JsonRecord;

export type HermesDashboardSession = Readonly<{
  id: string;
  source: string;
  model: string;
}> & JsonRecord;

export type HermesDashboardUsage = Readonly<{
  daily: readonly JsonRecord[];
  by_model: readonly JsonRecord[];
  totals: JsonRecord;
  period_days: number;
  skills: JsonRecord;
}> & JsonRecord;

export type HermesDashboardModels = Readonly<{ providers: readonly JsonRecord[] }> & JsonRecord;
export type HermesDashboardProviderAuth = Readonly<{ providers: readonly JsonRecord[] }> & JsonRecord;
export type HermesDashboardObject = JsonRecord;

export interface HermesDashboardRestFallback {
  request<T>(method: string, params?: unknown, options?: { signal?: AbortSignal }): Promise<T>;
}

export type HermesDashboardRestOptions = Readonly<{
  baseUrl: string;
  authToken: string | null;
  defaultHeaders?: Record<string, string>;
  resolveAuthHeaders?: CredentialResolver;
  fetchImpl?: typeof fetch;
  fallback?: HermesDashboardRestFallback;
}>;

export interface HermesDashboardRestClient {
  listSessions(options?: { signal?: AbortSignal }): Promise<HermesDashboardSessions>;
  getSession(id: string, options?: { signal?: AbortSignal }): Promise<HermesDashboardSession>;
  deleteSession(id: string, options?: { signal?: AbortSignal }): Promise<HermesDashboardObject>;
  getUsage(options?: { signal?: AbortSignal }): Promise<HermesDashboardUsage>;
  getModels(options?: { signal?: AbortSignal }): Promise<HermesDashboardModels>;
  getProviderAuth(options?: { signal?: AbortSignal }): Promise<HermesDashboardProviderAuth>;
  getProfile(options?: { signal?: AbortSignal }): Promise<HermesDashboardObject>;
  getConfig(options?: { signal?: AbortSignal }): Promise<HermesDashboardObject>;
}

export const HERMES_DASHBOARD_REST_FALLBACKS = {
  listSessions: "session.list",
  getUsage: "session.usage",
} as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function schemaError(label: string, value: unknown): Error {
  const preview = stringifyRedacted(value, 400) ?? "undefined";
  return new Error(`Hermes dashboard ${label} response failed schema validation: ${preview}`);
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!isRecord(value)) throw schemaError(label, value);
  return value;
}

function requireRecordArray(value: unknown, label: string): readonly JsonRecord[] {
  if (!Array.isArray(value) || !value.every(isRecord)) throw schemaError(label, value);
  return value;
}

function parseSessions(value: unknown): HermesDashboardSessions {
  const record = requireRecord(value, "sessions");
  requireRecordArray(record.sessions, "sessions");
  if (![record.total, record.limit, record.offset].every((entry) => typeof entry === "number" && Number.isFinite(entry))) {
    throw schemaError("sessions", value);
  }
  return record as HermesDashboardSessions;
}

function parseSession(value: unknown): HermesDashboardSession {
  const record = requireRecord(value, "session detail");
  if ([record.id, record.source, record.model].some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw schemaError("session detail", value);
  }
  return record as HermesDashboardSession;
}

function parseUsage(value: unknown): HermesDashboardUsage {
  const record = requireRecord(value, "usage");
  requireRecordArray(record.daily, "usage daily");
  requireRecordArray(record.by_model, "usage by_model");
  requireRecord(record.totals, "usage totals");
  requireRecord(record.skills, "usage skills");
  if (typeof record.period_days !== "number" || !Number.isFinite(record.period_days)) throw schemaError("usage", value);
  return record as HermesDashboardUsage;
}

function parseModels(value: unknown): HermesDashboardModels {
  const record = requireRecord(value, "models");
  requireRecordArray(record.providers, "models providers");
  return record as HermesDashboardModels;
}

function parseProviderAuth(value: unknown): HermesDashboardProviderAuth {
  const record = requireRecord(value, "provider auth");
  const providers = requireRecordArray(record.providers, "provider auth providers");
  for (const provider of providers) {
    if (typeof provider.id !== "string" || typeof provider.name !== "string" || typeof provider.flow !== "string") {
      throw schemaError("provider auth", value);
    }
    const status = requireRecord(provider.status, "provider auth status");
    if (typeof status.logged_in !== "boolean") throw schemaError("provider auth", value);
  }
  return record as HermesDashboardProviderAuth;
}

function isFallbackStatus(error: unknown): boolean {
  return error instanceof GatewayHttpError && (error.status === 404 || error.status === 405);
}

function safeId(id: string): string {
  const normalized = id.trim();
  if (!normalized) throw new Error("Hermes dashboard session id is required");
  return normalized;
}

export function createHermesDashboardRestClient(
  options: HermesDashboardRestOptions,
): HermesDashboardRestClient {
  const http = new JsonHttpApiClient("hermes-dashboard-rest", {
    baseUrl: options.baseUrl,
    allowRelativeBaseUrl: true,
    includePortalClientIdHeader: false,
    defaultHeaders: options.defaultHeaders,
    auth: {
      bearerToken: options.authToken,
      resolveHeaders: options.resolveAuthHeaders,
    },
    fetchImpl: options.fetchImpl,
  });

  const request = async <T>(
    path: string,
    parser: (value: unknown) => T,
    init?: HttpApiRequestInit,
  ): Promise<T> => {
    try {
      return parser(await http.request<unknown>(path, init));
    } catch (error) {
      if (error instanceof HttpApiError && error.status > 0) {
        throw new Error(
          `Hermes dashboard response was not valid JSON: ${redactPreviewText(error.body, 400)}`,
        );
      }
      throw error;
    }
  };

  const requestWithFallback = async <T>(
    operation: keyof typeof HERMES_DASHBOARD_REST_FALLBACKS,
    path: string,
    parser: (value: unknown) => T,
    requestOptions?: { signal?: AbortSignal },
  ): Promise<T> => {
    try {
      return await request(path, parser, { method: "GET", signal: requestOptions?.signal });
    } catch (error) {
      if (!options.fallback || !isFallbackStatus(error) || requestOptions?.signal?.aborted) throw error;
      const value = await options.fallback.request<unknown>(
        HERMES_DASHBOARD_REST_FALLBACKS[operation],
        undefined,
        requestOptions,
      );
      return parser(value);
    }
  };

  return {
    listSessions: (requestOptions) => requestWithFallback(
      "listSessions", HERMES_DASHBOARD_PATHS.sessions, parseSessions, requestOptions,
    ),
    getSession: (id, requestOptions) => request(
      HERMES_DASHBOARD_PATHS.session(safeId(id)), parseSession,
      { method: "GET", signal: requestOptions?.signal },
    ),
    deleteSession: (id, requestOptions) => request(
      HERMES_DASHBOARD_PATHS.session(safeId(id)),
      (value) => requireRecord(value, "session deletion"),
      { method: "DELETE", signal: requestOptions?.signal },
    ),
    getUsage: (requestOptions) => requestWithFallback(
      "getUsage", HERMES_DASHBOARD_PATHS.usage, parseUsage, requestOptions,
    ),
    getModels: (requestOptions) => request(
      HERMES_DASHBOARD_PATHS.models, parseModels, { method: "GET", signal: requestOptions?.signal },
    ),
    getProviderAuth: (requestOptions) => request(
      HERMES_DASHBOARD_PATHS.providerAuth, parseProviderAuth,
      { method: "GET", signal: requestOptions?.signal },
    ),
    getProfile: (requestOptions) => request(
      HERMES_DASHBOARD_PATHS.profile, (value) => requireRecord(value, "profile"),
      { method: "GET", signal: requestOptions?.signal },
    ),
    getConfig: (requestOptions) => request(
      HERMES_DASHBOARD_PATHS.config, (value) => requireRecord(value, "config"),
      { method: "GET", signal: requestOptions?.signal },
    ),
  };
}

export { HERMES_DASHBOARD_PATHS } from "./dashboard-paths.js";
