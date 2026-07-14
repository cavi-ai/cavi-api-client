import { JsonHttpApiClient } from "../../../../core/http/json-client.js";
import { GatewayHttpError } from "../../../../core/http/gateway-error.js";
import { HttpApiError } from "../../../../core/http/errors.js";
import { redactPreviewText, stringifyRedacted } from "../../../../core/http/redaction.js";
import type { CredentialResolver } from "../../../../core/http/credentials.js";
import type { HttpApiRequestInit } from "../../../../core/http/types.js";
import { HERMES_DASHBOARD_PATHS } from "./dashboard-paths.js";

type JsonRecord = Record<string, unknown>;
export type HermesDashboardJsonValue =
  | null
  | string
  | number
  | boolean
  | readonly HermesDashboardJsonValue[]
  | { readonly [key: string]: HermesDashboardJsonValue };

export type HermesDashboardSessions = Readonly<{
  sessions: readonly JsonRecord[];
  total: number;
  limit: number;
  offset: number;
}> & JsonRecord;

export type HermesDashboardSession = Readonly<{
  id: string;
  source: string | null;
  model: string | null;
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
export type HermesDashboardObject = Readonly<Record<string, HermesDashboardJsonValue>>;
export type HermesDashboardDeleteResult = Readonly<{ ok: true }>;

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
  deleteSession(id: string, options?: { signal?: AbortSignal }): Promise<HermesDashboardDeleteResult>;
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

const blockedJsonKeys = new Set(["__proto__", "constructor", "prototype"]);

function plainRecordDescriptors(value: unknown): Record<string, PropertyDescriptor> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || blockedJsonKeys.has(key)) return undefined;
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) return undefined;
  }
  return descriptors;
}

function isSafeJsonValue(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || !("value" in lengthDescriptor)
      || typeof lengthDescriptor.value !== "number"
      || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return false;
    const length = lengthDescriptor.value;
    const allowedKeys = new Set<string | symbol>(["length"]);
    for (let index = 0; index < length; index += 1) {
      const key = String(index);
      allowedKeys.add(key);
      const descriptor = descriptors[key];
      if (!descriptor || !("value" in descriptor) || !descriptor.enumerable
        || !isSafeJsonValue(descriptor.value, seen)) return false;
    }
    return Reflect.ownKeys(descriptors).every((key) => allowedKeys.has(key));
  }
  const descriptors = plainRecordDescriptors(value);
  if (!descriptors) return false;
  return Object.values(descriptors).every((descriptor) => isSafeJsonValue(descriptor.value, seen));
}

function schemaError(label: string, value: unknown): Error {
  const preview = isSafeJsonValue(value) ? stringifyRedacted(value, 400) ?? "undefined" : "[unsafe value]";
  return new Error(`Hermes dashboard ${label} response failed schema validation: ${preview}`);
}

function requireRecord(value: unknown, label: string): JsonRecord {
  if (!plainRecordDescriptors(value)) throw schemaError(label, value);
  return value as JsonRecord;
}

function requireSafePayload(value: unknown, label: string): void {
  if (!isSafeJsonValue(value)) throw schemaError(label, value);
}

export function requireHermesSafeJsonRecord(value: unknown, label: string): Record<string, unknown> {
  requireSafePayload(value, label);
  return requireRecord(value, label);
}

function own(record: JsonRecord, key: string, label: string, root: unknown): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw schemaError(label, root);
  return descriptor.value;
}

function optionalOwn(record: JsonRecord, key: string, label: string, root: unknown): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor) return undefined;
  if (!("value" in descriptor) || !descriptor.enumerable) throw schemaError(label, root);
  return descriptor.value;
}

function requireArray(value: unknown, label: string, root: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw schemaError(label, root);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw schemaError(label, root);
  }
  return value;
}

function requireString(value: unknown, label: string, root: unknown, allowEmpty = false): void {
  if (typeof value !== "string" || (!allowEmpty && value.length === 0)) throw schemaError(label, root);
}

function requireNullableString(value: unknown, label: string, root: unknown): void {
  if (value !== null && typeof value !== "string") throw schemaError(label, root);
}

function requireBoolean(value: unknown, label: string, root: unknown): void {
  if (typeof value !== "boolean") throw schemaError(label, root);
}

function requireNonnegativeNumber(value: unknown, label: string, root: unknown): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw schemaError(label, root);
}

function requireNonnegativeInteger(value: unknown, label: string, root: unknown): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw schemaError(label, root);
}

function requireNullableNonnegativeNumber(value: unknown, label: string, root: unknown): void {
  if (value !== null) requireNonnegativeNumber(value, label, root);
}

function requireSessionRow(value: unknown, root: unknown): void {
  const row = requireRecord(value, "session row");
  requireString(own(row, "id", "session id", root), "session id", root);
  for (const key of ["source", "model", "title", "preview"]) {
    requireNullableString(own(row, key, `session ${key}`, root), `session ${key}`, root);
  }
  requireNonnegativeNumber(own(row, "started_at", "session started_at", root), "session started_at", root);
  requireNullableNonnegativeNumber(own(row, "ended_at", "session ended_at", root), "session ended_at", root);
  requireNonnegativeNumber(own(row, "last_active", "session last_active", root), "session last_active", root);
  requireBoolean(own(row, "is_active", "session is_active", root), "session is_active", root);
  requireNonnegativeInteger(own(row, "message_count", "session message_count", root), "session message_count", root);
  const parent = optionalOwn(row, "parent_session_id", "session parent_session_id", root);
  if (parent !== undefined) requireNullableString(parent, "session parent_session_id", root);
}

function parseSessions(value: unknown): HermesDashboardSessions {
  requireSafePayload(value, "sessions");
  const record = requireRecord(value, "sessions");
  const sessions = requireArray(own(record, "sessions", "sessions", value), "sessions", value);
  for (const session of sessions) requireSessionRow(session, value);
  requireNonnegativeInteger(own(record, "total", "sessions total", value), "sessions total", value);
  requireNonnegativeInteger(own(record, "limit", "sessions limit", value), "sessions limit", value);
  requireNonnegativeInteger(own(record, "offset", "sessions offset", value), "sessions offset", value);
  return record as HermesDashboardSessions;
}

function parseSession(value: unknown): HermesDashboardSession {
  requireSafePayload(value, "session detail");
  const record = requireRecord(value, "session detail");
  requireString(own(record, "id", "session detail id", value), "session detail id", value);
  requireNullableString(own(record, "source", "session detail source", value), "session detail source", value);
  requireNullableString(own(record, "model", "session detail model", value), "session detail model", value);
  requireNullableString(own(record, "title", "session detail title", value), "session detail title", value);
  requireNonnegativeNumber(own(record, "started_at", "session detail started_at", value), "session detail started_at", value);
  requireNullableNonnegativeNumber(own(record, "ended_at", "session detail ended_at", value), "session detail ended_at", value);
  requireNonnegativeInteger(own(record, "input_tokens", "session detail input_tokens", value), "session detail input_tokens", value);
  requireNonnegativeInteger(own(record, "output_tokens", "session detail output_tokens", value), "session detail output_tokens", value);
  requireNonnegativeNumber(own(record, "estimated_cost_usd", "session detail estimated_cost_usd", value), "session detail estimated_cost_usd", value);
  requireNonnegativeInteger(own(record, "message_count", "session detail message_count", value), "session detail message_count", value);
  return record as HermesDashboardSession;
}

function parseUsage(value: unknown): HermesDashboardUsage {
  requireSafePayload(value, "usage");
  const record = requireRecord(value, "usage");
  const daily = requireArray(own(record, "daily", "usage daily", value), "usage daily", value);
  for (const entry of daily) {
    const row = requireRecord(entry, "usage daily row");
    requireString(own(row, "day", "usage day", value), "usage day", value);
    for (const key of ["input_tokens", "output_tokens", "cache_read_tokens", "reasoning_tokens", "sessions", "api_calls"]) {
      requireNonnegativeInteger(own(row, key, `usage daily ${key}`, value), `usage daily ${key}`, value);
    }
    for (const key of ["estimated_cost", "actual_cost"]) {
      requireNonnegativeNumber(own(row, key, `usage daily ${key}`, value), `usage daily ${key}`, value);
    }
  }
  const byModel = requireArray(own(record, "by_model", "usage by_model", value), "usage by_model", value);
  for (const entry of byModel) {
    const row = requireRecord(entry, "usage model row");
    requireString(own(row, "model", "usage model", value), "usage model", value);
    for (const key of ["input_tokens", "output_tokens", "sessions", "api_calls"]) {
      requireNonnegativeInteger(own(row, key, `usage model ${key}`, value), `usage model ${key}`, value);
    }
    requireNonnegativeNumber(own(row, "estimated_cost", "usage model estimated_cost", value), "usage model estimated_cost", value);
  }
  const totals = requireRecord(own(record, "totals", "usage totals", value), "usage totals");
  for (const key of ["total_input", "total_output", "total_cache_read", "total_reasoning", "total_api_calls"]) {
    const total = own(totals, key, `usage ${key}`, value);
    if (total !== null) requireNonnegativeInteger(total, `usage ${key}`, value);
  }
  for (const key of ["total_estimated_cost", "total_actual_cost"]) {
    requireNonnegativeNumber(own(totals, key, `usage ${key}`, value), `usage ${key}`, value);
  }
  requireNonnegativeInteger(own(totals, "total_sessions", "usage total_sessions", value), "usage total_sessions", value);
  requireNonnegativeInteger(own(record, "period_days", "usage period_days", value), "usage period_days", value);
  const skills = requireRecord(own(record, "skills", "usage skills", value), "usage skills");
  const summary = requireRecord(own(skills, "summary", "usage skills summary", value), "usage skills summary");
  for (const key of ["total_skill_loads", "total_skill_edits", "total_skill_actions", "distinct_skills_used"]) {
    requireNonnegativeInteger(own(summary, key, `usage skills ${key}`, value), `usage skills ${key}`, value);
  }
  const topSkills = requireArray(own(skills, "top_skills", "usage top_skills", value), "usage top_skills", value);
  for (const entry of topSkills) {
    const row = requireRecord(entry, "usage skill row");
    requireString(own(row, "skill", "usage skill", value), "usage skill", value);
    for (const key of ["view_count", "manage_count", "total_count"]) {
      requireNonnegativeInteger(own(row, key, `usage skill ${key}`, value), `usage skill ${key}`, value);
    }
    requireNonnegativeNumber(own(row, "percentage", "usage skill percentage", value), "usage skill percentage", value);
    requireNullableNonnegativeNumber(own(row, "last_used_at", "usage skill last_used_at", value), "usage skill last_used_at", value);
  }
  return record as HermesDashboardUsage;
}

function parseModels(value: unknown): HermesDashboardModels {
  requireSafePayload(value, "models");
  const record = requireRecord(value, "models");
  const providers = requireArray(own(record, "providers", "models providers", value), "models providers", value);
  requireString(own(record, "model", "models current model", value), "models current model", value, true);
  requireString(own(record, "provider", "models current provider", value), "models current provider", value, true);
  for (const entry of providers) {
    const provider = requireRecord(entry, "models provider");
    for (const key of ["slug", "name", "source"]) requireString(own(provider, key, `models ${key}`, value), `models ${key}`, value);
    requireBoolean(own(provider, "is_current", "models is_current", value), "models is_current", value);
    requireBoolean(own(provider, "is_user_defined", "models is_user_defined", value), "models is_user_defined", value);
    const models = requireArray(own(provider, "models", "models list", value), "models list", value);
    for (const model of models) requireString(model, "models model", value);
    requireNonnegativeInteger(own(provider, "total_models", "models total_models", value), "models total_models", value);
  }
  return record as HermesDashboardModels;
}

function parseProviderAuth(value: unknown): HermesDashboardProviderAuth {
  requireSafePayload(value, "provider auth");
  const record = requireRecord(value, "provider auth");
  const providers = requireArray(own(record, "providers", "provider auth providers", value), "provider auth providers", value);
  for (const entry of providers) {
    const provider = requireRecord(entry, "provider auth provider");
    for (const key of ["id", "name", "cli_command", "docs_url"]) requireString(own(provider, key, `provider auth ${key}`, value), `provider auth ${key}`, value);
    const flow = own(provider, "flow", "provider auth flow", value);
    if (flow !== "pkce" && flow !== "device_code" && flow !== "external") throw schemaError("provider auth flow", value);
    const status = requireRecord(own(provider, "status", "provider auth status", value), "provider auth status");
    requireBoolean(own(status, "logged_in", "provider auth logged_in", value), "provider auth logged_in", value);
    for (const key of ["source", "source_label", "token_preview", "expires_at", "last_refresh", "error"]) {
      const field = optionalOwn(status, key, `provider auth ${key}`, value);
      if (field !== undefined) requireNullableString(field, `provider auth ${key}`, value);
    }
    const refresh = optionalOwn(status, "has_refresh_token", "provider auth has_refresh_token", value);
    if (refresh !== undefined) requireBoolean(refresh, "provider auth has_refresh_token", value);
  }
  return record as HermesDashboardProviderAuth;
}

function isFallbackStatus(error: unknown): boolean {
  return error instanceof GatewayHttpError && (error.status === 404 || error.status === 405);
}

function safeId(id: string): string {
  if (!id.trim()) throw new Error("Hermes dashboard session id is required");
  return id;
}

function parseSafeJsonObject(value: unknown, label: string): HermesDashboardObject {
  const record = requireRecord(value, label);
  if (!isSafeJsonValue(record)) throw schemaError(label, value);
  return record as HermesDashboardObject;
}

function parseDelete(value: unknown): HermesDashboardDeleteResult {
  requireSafePayload(value, "session deletion");
  const record = requireRecord(value, "session deletion");
  if (own(record, "ok", "session deletion ok", value) !== true
    || Reflect.ownKeys(Object.getOwnPropertyDescriptors(record)).length !== 1) {
    throw schemaError("session deletion", value);
  }
  return record as HermesDashboardDeleteResult;
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
      parseDelete,
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
      HERMES_DASHBOARD_PATHS.profile, (value) => parseSafeJsonObject(value, "profile"),
      { method: "GET", signal: requestOptions?.signal },
    ),
    getConfig: (requestOptions) => request(
      HERMES_DASHBOARD_PATHS.config, (value) => parseSafeJsonObject(value, "config"),
      { method: "GET", signal: requestOptions?.signal },
    ),
  };
}

export { HERMES_DASHBOARD_PATHS } from "./dashboard-paths.js";
