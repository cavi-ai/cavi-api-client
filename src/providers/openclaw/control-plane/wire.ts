export class OpenClawWireError extends Error {
  constructor(message: string) { super(message); this.name = "OpenClawWireError"; }
}

type WireObject = Record<string, unknown>;
const TASK_STATUSES = new Set(["queued", "running", "completed", "failed", "cancelled", "timed_out"]);
const ABORT_STATUSES = new Set(["aborted", "no-active-run"]);

function object(value: unknown, label: string): WireObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new OpenClawWireError(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new OpenClawWireError(`${label} must be a plain object`);
  return value as WireObject;
}
function closed(value: unknown, label: string, keys: readonly string[]): WireObject {
  const result = object(value, label);
  const allowed = new Set(keys);
  for (const key of Object.keys(result)) if (!allowed.has(key)) throw new OpenClawWireError(`${label}.${key} is not allowed`);
  return result;
}
function array(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new OpenClawWireError(`${label} must be an array`); return value; }
function string(value: unknown, label: string, required = true): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string" || (required && value.length === 0)) throw new OpenClawWireError(`${label} must be ${required ? "a non-empty" : "a"} string`);
  return value;
}
function boolean(value: unknown, label: string, required = false): boolean | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "boolean") throw new OpenClawWireError(`${label} must be a boolean`);
  return value;
}
function integer(value: unknown, label: string, minimum: number, required = false): number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) throw new OpenClawWireError(`${label} is invalid`);
  return value;
}
function finiteNumber(value: unknown, label: string, required = false): number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new OpenClawWireError(`${label} is invalid`);
  return value;
}
function timestamp(value: unknown, label: string, required = false): string | number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000) return value;
  if (typeof value === "string" && value.length > 0) {
    const time = new Date(value).getTime();
    if (Number.isFinite(time)) return value;
  }
  throw new OpenClawWireError(`${label} is an invalid timestamp`);
}
function numericTimestamp(value: unknown, label: string, required = false): number | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000) return value;
  throw new OpenClawWireError(`${label} is an invalid timestamp`);
}
function assign(output: WireObject, key: string, value: unknown): void { if (value !== undefined) output[key] = value; }
function strings(value: unknown, label: string): string[] { return array(value, label).map((item, index) => string(item, `${label}[${index}]`) as string); }
function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null;
  return string(value, label) as string;
}
function nullableInteger(value: unknown, label: string): number | null {
  if (value === null) return null;
  return integer(value, label, 0, true) as number;
}

const AGENT_RUNTIME_SOURCES = new Set(["env", "agent", "defaults", "model", "provider", "implicit", "session", "session-key"]);
function agentRuntime(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["id", "fallback", "source"]);
  const source = string(input.source, `${label}.source`);
  if (!AGENT_RUNTIME_SOURCES.has(source as string)) throw new OpenClawWireError(`${label}.source is invalid`);
  const output: WireObject = { id: string(input.id, `${label}.id`), source };
  if (input.fallback !== undefined) {
    if (input.fallback !== "openclaw" && input.fallback !== "none") throw new OpenClawWireError(`${label}.fallback is invalid`);
    output.fallback = input.fallback;
  }
  return output;
}
function thinkingLevel(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["id", "label"]);
  return { id: string(input.id, `${label}.id`), label: string(input.label, `${label}.label`) };
}
function assignThinkingFields(input: WireObject, output: WireObject, label: string): void {
  if (input.thinkingLevels !== undefined) {
    output.thinkingLevels = array(input.thinkingLevels, `${label}.thinkingLevels`).map((item, index) =>
      thinkingLevel(item, `${label}.thinkingLevels[${index}]`));
  }
  if (input.thinkingOptions !== undefined) output.thinkingOptions = strings(input.thinkingOptions, `${label}.thinkingOptions`);
  assign(output, "thinkingDefault", string(input.thinkingDefault, `${label}.thinkingDefault`, false));
}

function sessionDefaults(value: unknown): WireObject {
  const input = closed(value, "defaults", ["modelProvider", "model", "contextTokens", "agentRuntime", "thinkingLevels", "thinkingOptions", "thinkingDefault"]);
  const output: WireObject = {};
  if (input.modelProvider !== undefined) output.modelProvider = nullableString(input.modelProvider, "defaults.modelProvider");
  if (input.model !== undefined) output.model = nullableString(input.model, "defaults.model");
  if (input.contextTokens !== undefined) output.contextTokens = nullableInteger(input.contextTokens, "defaults.contextTokens");
  if (input.agentRuntime !== undefined) output.agentRuntime = agentRuntime(input.agentRuntime, "defaults.agentRuntime");
  assignThinkingFields(input, output, "defaults");
  return output;
}

const MODEL_KEYS = ["id", "name", "provider", "alias", "contextWindow", "reasoning"] as const;
function model(value: unknown, label: string): WireObject {
  const input = closed(value, label, MODEL_KEYS); const output: WireObject = {
    id: string(input.id, `${label}.id`), name: string(input.name, `${label}.name`), provider: string(input.provider, `${label}.provider`),
  };
  assign(output, "alias", string(input.alias, `${label}.alias`, false));
  assign(output, "contextWindow", integer(input.contextWindow, `${label}.contextWindow`, 1));
  assign(output, "reasoning", boolean(input.reasoning, `${label}.reasoning`));
  return output;
}

const TASK_KEYS = ["id", "kind", "runtime", "status", "title", "agentId", "sessionKey", "childSessionKey", "ownerKey", "runId", "taskId", "flowId", "parentTaskId", "sourceId", "createdAt", "updatedAt", "startedAt", "endedAt", "toolUseCount", "lastToolName", "progressSummary", "terminalSummary", "error"] as const;
function task(value: unknown, label: string): WireObject {
  const input = closed(value, label, TASK_KEYS); const status = string(input.status, `${label}.status`);
  if (!TASK_STATUSES.has(status as string)) throw new OpenClawWireError(`${label}.status is invalid`);
  const output: WireObject = { id: string(input.id, `${label}.id`), status };
  for (const key of ["kind", "runtime", "title", "agentId", "sessionKey", "childSessionKey", "ownerKey", "runId", "taskId", "flowId", "parentTaskId", "sourceId", "lastToolName", "progressSummary", "terminalSummary", "error"]) assign(output, key, string(input[key], `${label}.${key}`, false));
  for (const key of ["createdAt", "updatedAt", "startedAt", "endedAt"]) assign(output, key, timestamp(input[key], `${label}.${key}`));
  assign(output, "toolUseCount", integer(input.toolUseCount, `${label}.toolUseCount`, 0));
  return output;
}

function session(value: unknown, label: string): WireObject {
  const keys = [
    "key", "sessionId", "label", "displayName", "createdAt", "updatedAt", "kind",
    "archived", "pinned", "unread", "thinkingLevel", "thinkingLevels",
    "thinkingOptions", "thinkingDefault", "effectiveFastMode",
    "effectiveFastModeSource", "fastAutoOnSeconds", "inputTokens",
    "outputTokens", "totalTokens", "totalTokensFresh", "effectiveResponseUsage",
    "modelProvider", "model", "agentRuntime", "hasActiveRun",
  ] as const;
  const input = closed(value, label, keys); const output: WireObject = { key: string(input.key, `${label}.key`) };
  assign(output, "sessionId", string(input.sessionId, `${label}.sessionId`, false));
  assign(output, "label", string(input.label, `${label}.label`, false));
  assign(output, "displayName", string(input.displayName, `${label}.displayName`, false));
  assign(output, "createdAt", timestamp(input.createdAt, `${label}.createdAt`)); assign(output, "updatedAt", timestamp(input.updatedAt, `${label}.updatedAt`));
  if (input.kind !== undefined) {
    if (!["direct", "group", "global", "unknown"].includes(input.kind as string)) throw new OpenClawWireError(`${label}.kind is invalid`);
    output.kind = input.kind as string;
  }
  for (const key of ["archived", "pinned", "unread", "effectiveFastMode", "totalTokensFresh", "hasActiveRun"]) {
    assign(output, key, boolean(input[key], `${label}.${key}`));
  }
  assign(output, "thinkingLevel", string(input.thinkingLevel, `${label}.thinkingLevel`, false));
  assignThinkingFields(input, output, label);
  if (input.effectiveFastModeSource !== undefined) {
    if (!["default", "session", "auto"].includes(input.effectiveFastModeSource as string)) throw new OpenClawWireError(`${label}.effectiveFastModeSource is invalid`);
    output.effectiveFastModeSource = input.effectiveFastModeSource as string;
  }
  for (const key of ["fastAutoOnSeconds", "inputTokens", "outputTokens", "totalTokens"]) {
    assign(output, key, integer(input[key], `${label}.${key}`, 0));
  }
  if (input.effectiveResponseUsage !== undefined) {
    if (!["on", "off", "tokens", "full"].includes(input.effectiveResponseUsage as string)) throw new OpenClawWireError(`${label}.effectiveResponseUsage is invalid`);
    output.effectiveResponseUsage = input.effectiveResponseUsage as string;
  }
  assign(output, "modelProvider", string(input.modelProvider, `${label}.modelProvider`, false));
  assign(output, "model", string(input.model, `${label}.model`, false));
  if (input.agentRuntime !== undefined) output.agentRuntime = agentRuntime(input.agentRuntime, `${label}.agentRuntime`);
  return output;
}

export function parseModelsList(value: unknown): WireObject {
  const input = closed(value, "payload", ["models"]); return { models: array(input.models, "models").map((item, i) => model(item, `models[${i}]`)) };
}

function authExpiry(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["at", "remainingMs", "label"]);
  return {
    at: numericTimestamp(input.at, `${label}.at`, true),
    remainingMs: finiteNumber(input.remainingMs, `${label}.remainingMs`, true),
    label: string(input.label, `${label}.label`),
  };
}
function authUsageWindow(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["label", "usedPercent", "resetAt"]); const output: WireObject = {
    label: string(input.label, `${label}.label`),
    usedPercent: finiteNumber(input.usedPercent, `${label}.usedPercent`, true),
  };
  assign(output, "resetAt", numericTimestamp(input.resetAt, `${label}.resetAt`));
  return output;
}
function authBilling(value: unknown, label: string): WireObject {
  const base = object(value, label);
  const type = string(base.type, `${label}.type`);
  const keys = type === "balance"
    ? ["type", "label", "amount", "unit"]
    : type === "spend"
      ? ["type", "label", "amount", "unit", "period", "resetAt"]
      : type === "budget"
        ? ["type", "label", "used", "limit", "unit", "period", "resetAt"]
        : undefined;
  if (keys === undefined) throw new OpenClawWireError(`${label}.type is invalid`);
  const input = closed(value, label, keys); const output: WireObject = { type };
  assign(output, "label", string(input.label, `${label}.label`, false));
  if (type === "budget") {
    output.used = finiteNumber(input.used, `${label}.used`, true);
    output.limit = finiteNumber(input.limit, `${label}.limit`, true);
  } else {
    output.amount = finiteNumber(input.amount, `${label}.amount`, true);
  }
  output.unit = string(input.unit, `${label}.unit`);
  assign(output, "period", string(input.period, `${label}.period`, false));
  assign(output, "resetAt", numericTimestamp(input.resetAt, `${label}.resetAt`));
  return output;
}
function authUsage(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["windows", "summary", "plan", "billing"]); const output: WireObject = {
    windows: array(input.windows, `${label}.windows`).map((window, index) => authUsageWindow(window, `${label}.windows[${index}]`)),
  };
  assign(output, "summary", string(input.summary, `${label}.summary`, false));
  assign(output, "plan", string(input.plan, `${label}.plan`, false));
  if (input.billing !== undefined) output.billing = array(input.billing, `${label}.billing`).map((entry, index) => authBilling(entry, `${label}.billing[${index}]`));
  return output;
}
function authProfile(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["profileId", "type", "status", "reasonCode", "expiry", "logoutSupported"]); const output: WireObject = {
    profileId: string(input.profileId, `${label}.profileId`), type: string(input.type, `${label}.type`), status: string(input.status, `${label}.status`),
  };
  assign(output, "reasonCode", string(input.reasonCode, `${label}.reasonCode`, false));
  if (input.expiry !== undefined) output.expiry = authExpiry(input.expiry, `${label}.expiry`);
  assign(output, "logoutSupported", boolean(input.logoutSupported, `${label}.logoutSupported`)); return output;
}
export function parseModelsAuthStatus(value: unknown): WireObject {
  const input = closed(value, "payload", ["ts", "providers"]); return {
    ts: timestamp(input.ts, "ts", true),
    providers: array(input.providers, "providers").map((item, i) => {
      const label = `providers[${i}]`; const provider = closed(item, label, ["provider", "displayName", "status", "expiry", "profiles", "usage"]); const output: WireObject = {
        provider: string(provider.provider, `${label}.provider`), displayName: string(provider.displayName, `${label}.displayName`), status: string(provider.status, `${label}.status`), profiles: array(provider.profiles, `${label}.profiles`).map((profile, j) => authProfile(profile, `${label}.profiles[${j}]`)),
      };
      if (provider.expiry !== undefined) output.expiry = authExpiry(provider.expiry, `${label}.expiry`);
      if (provider.usage !== undefined) output.usage = authUsage(provider.usage, `${label}.usage`);
      return output;
    }),
  };
}
export function parseSessionsList(value: unknown): WireObject {
  const input = closed(value, "payload", ["ts", "path", "count", "totalCount", "limitApplied", "offset", "nextOffset", "hasMore", "defaults", "sessions"]);
  const output: WireObject = {
    ts: timestamp(input.ts, "ts", true),
    path: string(input.path, "path", false),
    count: integer(input.count, "count", 0, true),
    defaults: sessionDefaults(input.defaults),
    sessions: array(input.sessions, "sessions").map((item, i) => session(item, `sessions[${i}]`)),
  };
  assign(output, "totalCount", integer(input.totalCount, "totalCount", 0));
  assign(output, "limitApplied", integer(input.limitApplied, "limitApplied", 0));
  assign(output, "offset", integer(input.offset, "offset", 0));
  if (input.nextOffset !== undefined) output.nextOffset = input.nextOffset === null ? null : integer(input.nextOffset, "nextOffset", 0, true);
  assign(output, "hasMore", boolean(input.hasMore, "hasMore"));
  const currentPagination = ["totalCount", "limitApplied", "nextOffset", "hasMore"].some((key) => key in input);
  if (currentPagination) {
    if (!("totalCount" in output) || !("limitApplied" in output) || !("nextOffset" in output) || !("hasMore" in output)) {
      throw new OpenClawWireError("sessions pagination metadata is incomplete");
    }
    const count = output.count as number;
    const totalCount = output.totalCount as number;
    const limitApplied = output.limitApplied as number;
    const offset = (output.offset as number | undefined) ?? 0;
    const nextOffset = output.nextOffset as number | null;
    const hasMore = output.hasMore as boolean;
    if (count !== (output.sessions as unknown[]).length || count > limitApplied || offset + count > totalCount) {
      throw new OpenClawWireError("sessions pagination metadata is inconsistent");
    }
    if (hasMore ? nextOffset !== offset + count || nextOffset >= totalCount : nextOffset !== null || offset + count < totalCount) {
      throw new OpenClawWireError("sessions pagination continuation is inconsistent");
    }
  }
  return output;
}
export function parseSessionsDescribe(value: unknown): WireObject { const input = closed(value, "payload", ["session"]); if (!("session" in input)) throw new OpenClawWireError("session is required"); return { session: input.session === null ? null : session(input.session, "session") }; }
export function parseSessionsAbort(value: unknown): WireObject {
  const input = closed(value, "payload", ["ok", "abortedRunId", "status"]); if (input.ok !== true || !ABORT_STATUSES.has(input.status as string) || !(input.abortedRunId === null || typeof input.abortedRunId === "string")) throw new OpenClawWireError("invalid sessions.abort result");
  return { ok: true, abortedRunId: input.abortedRunId, status: input.status };
}

function usageWindow(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["label", "usedPercent", "resetAt"]); const output: WireObject = {};
  assign(output, "label", string(input.label, `${label}.label`, false));
  if (input.usedPercent !== undefined && (typeof input.usedPercent !== "number" || !Number.isFinite(input.usedPercent))) throw new OpenClawWireError(`${label}.usedPercent is invalid`);
  assign(output, "usedPercent", input.usedPercent); assign(output, "resetAt", timestamp(input.resetAt, `${label}.resetAt`)); return output;
}
export function parseUsageStatus(value: unknown): WireObject {
  const input = closed(value, "payload", ["updatedAt", "providers"]); return { updatedAt: timestamp(input.updatedAt, "updatedAt", true), providers: array(input.providers, "providers").map((item, i) => { const label = `providers[${i}]`; const provider = closed(item, label, ["provider", "displayName", "windows"]); return { provider: string(provider.provider, `${label}.provider`), displayName: string(provider.displayName, `${label}.displayName`), windows: array(provider.windows, `${label}.windows`).map((window, j) => usageWindow(window, `${label}.windows[${j}]`)) }; }) };
}
const USAGE_COST_KEYS = ["input", "output", "cacheRead", "cacheWrite", "totalTokens", "totalCost", "missingCostEntries"] as const;
const USAGE_COST_DETAIL_KEYS = ["inputCost", "outputCost", "cacheReadCost", "cacheWriteCost"] as const;
function usageCostMetrics(value: unknown, label: string, alreadyClosed = false): WireObject {
  const input = alreadyClosed ? object(value, label) : closed(value, label, [...USAGE_COST_KEYS, ...USAGE_COST_DETAIL_KEYS]); const output: WireObject = {};
  for (const key of USAGE_COST_KEYS) {
    const metric = input[key];
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0) throw new OpenClawWireError(`${label}.${key} is invalid`);
    output[key] = metric;
  }
  const presentDetails = USAGE_COST_DETAIL_KEYS.filter((key) => input[key] !== undefined);
  if (presentDetails.length !== 0 && presentDetails.length !== USAGE_COST_DETAIL_KEYS.length) {
    throw new OpenClawWireError(`${label} cost details are incomplete`);
  }
  for (const key of presentDetails) {
    const metric = input[key];
    if (typeof metric !== "number" || !Number.isFinite(metric) || metric < 0) throw new OpenClawWireError(`${label}.${key} is invalid`);
    output[key] = metric;
  }
  return output;
}
function usageCostDay(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["date", ...USAGE_COST_KEYS, ...USAGE_COST_DETAIL_KEYS]);
  const output = usageCostMetrics(input, label, true);
  output.date = string(input.date, `${label}.date`);
  return output;
}
function usageCacheStatus(value: unknown): WireObject {
  const input = closed(value, "cacheStatus", ["status", "cachedFiles", "pendingFiles", "staleFiles", "refreshedAt"]);
  if (!["fresh", "partial", "stale", "refreshing"].includes(input.status as string)) throw new OpenClawWireError("cacheStatus.status is invalid");
  const output: WireObject = {
    status: input.status as string,
    cachedFiles: integer(input.cachedFiles, "cacheStatus.cachedFiles", 0, true),
    pendingFiles: integer(input.pendingFiles, "cacheStatus.pendingFiles", 0, true),
    staleFiles: integer(input.staleFiles, "cacheStatus.staleFiles", 0, true),
  };
  assign(output, "refreshedAt", numericTimestamp(input.refreshedAt, "cacheStatus.refreshedAt"));
  return output;
}
export function parseUsageCost(value: unknown): WireObject {
  const input = closed(value, "payload", ["updatedAt", "days", "totals", "daily", "cacheStatus"]);
  const output: WireObject = {
    updatedAt: timestamp(input.updatedAt, "updatedAt", true),
    days: integer(input.days, "days", 0, true),
    totals: usageCostMetrics(input.totals, "totals"),
    daily: array(input.daily, "daily").map((item, i) => usageCostDay(item, `daily[${i}]`)),
  };
  if (input.cacheStatus !== undefined) output.cacheStatus = usageCacheStatus(input.cacheStatus);
  return output;
}
export function parseTasksList(value: unknown): WireObject { const input = closed(value, "payload", ["tasks", "nextCursor"]); const output: WireObject = { tasks: array(input.tasks, "tasks").map((item, i) => task(item, `tasks[${i}]`)) }; assign(output, "nextCursor", string(input.nextCursor, "nextCursor", false)); return output; }
export function parseTasksGet(value: unknown): WireObject { const input = closed(value, "payload", ["task"]); return { task: task(input.task, "task") }; }
export function parseTasksCancel(value: unknown): WireObject { const input = closed(value, "payload", ["found", "cancelled", "reason", "task"]); const output: WireObject = { found: boolean(input.found, "found", true), cancelled: boolean(input.cancelled, "cancelled", true) }; assign(output, "reason", string(input.reason, "reason", false)); if (input.task !== undefined) output.task = task(input.task, "task"); return output; }

function agent(value: unknown, label: string): WireObject {
  const input = closed(value, label, ["id", "name", "identity", "workspace", "workspaceGit", "model", "agentRuntime", "thinkingLevels", "thinkingOptions", "thinkingDefault"]); const output: WireObject = { id: string(input.id, `${label}.id`) };
  assign(output, "name", string(input.name, `${label}.name`, false)); assign(output, "workspace", string(input.workspace, `${label}.workspace`, false)); assign(output, "workspaceGit", boolean(input.workspaceGit, `${label}.workspaceGit`));
  if (input.identity !== undefined) { const identity = closed(input.identity, `${label}.identity`, ["name", "theme", "emoji", "avatar", "avatarUrl"]); const copy: WireObject = {}; for (const key of ["name", "theme", "emoji", "avatar", "avatarUrl"]) assign(copy, key, string(identity[key], `${label}.identity.${key}`, false)); output.identity = copy; }
  if (input.model !== undefined) { const modelInput = closed(input.model, `${label}.model`, ["primary", "fallbacks"]); const copy: WireObject = {}; assign(copy, "primary", string(modelInput.primary, `${label}.model.primary`, false)); if (modelInput.fallbacks !== undefined) copy.fallbacks = strings(modelInput.fallbacks, `${label}.model.fallbacks`); output.model = copy; }
  if (input.agentRuntime !== undefined) output.agentRuntime = agentRuntime(input.agentRuntime, `${label}.agentRuntime`);
  assignThinkingFields(input, output, label);
  return output;
}
export function parseAgentsList(value: unknown): WireObject { const input = closed(value, "payload", ["defaultId", "mainKey", "scope", "agents"]); if (input.scope !== "per-sender" && input.scope !== "global") throw new OpenClawWireError("scope is invalid"); return { defaultId: string(input.defaultId, "defaultId"), mainKey: string(input.mainKey, "mainKey"), scope: input.scope, agents: array(input.agents, "agents").map((item, i) => agent(item, `agents[${i}]`)) }; }
