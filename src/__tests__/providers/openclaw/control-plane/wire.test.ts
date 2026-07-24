import { describe, expect, it } from "vitest";

import {
  OpenClawWireError,
  parseAgentsList,
  parseModelsAuthStatus,
  parseModelsList,
  parseSessionsAbort,
  parseSessionsDescribe,
  parseSessionsList,
  parseTasksCancel,
  parseTasksGet,
  parseTasksList,
  parseUsageCost,
  parseUsageStatus,
} from "../../../../providers/openclaw/control-plane/wire.js";
import { normalizeState, normalizeTimestamp, safeMetadata } from "../../../../providers/openclaw/control-plane/normalize.js";

const fixtures = import.meta.glob("../../../fixtures/openclaw/control-plane/*.json", { eager: true, import: "default" }) as Record<string, unknown>;
const fixture = (name: string): unknown => fixtures[`../../../fixtures/openclaw/control-plane/${name}.json`];

const parsers = [
  ["models-list", parseModelsList], ["models-auth-status", parseModelsAuthStatus],
  ["sessions-list", parseSessionsList], ["sessions-describe", parseSessionsDescribe],
  ["sessions-abort", parseSessionsAbort], ["usage-status", parseUsageStatus],
  ["usage-cost", parseUsageCost], ["tasks-list", parseTasksList],
  ["tasks-get", parseTasksGet], ["tasks-cancel", parseTasksCancel],
  ["agents-list", parseAgentsList],
] as const;

function nestedPayload(name: string, mutate: (payload: Record<string, any>) => void): Record<string, unknown> {
  const payload = structuredClone(fixture(name)) as Record<string, any>;
  mutate(payload);
  return payload;
}

const nestedSafetyByParser = [
  ["models.list", parseModelsList, [
    ["secret model field", nestedPayload("models-list", (p) => { p.models[0].authorization = "secret"; })],
    ["exotic model field", nestedPayload("models-list", (p) => { p.models[0].unexpected = new Date(); })],
  ]],
  ["models.authStatus", parseModelsAuthStatus, [
    ["secret provider field", nestedPayload("models-auth-status", (p) => { p.providers[0].authorization = "secret"; })],
    ["exotic provider field", nestedPayload("models-auth-status", (p) => { p.providers[0].unexpected = new Date(); })],
    ["secret profile field", nestedPayload("models-auth-status", (p) => { p.providers[0].profiles = [{ profileId: "id", type: "token", status: "healthy", password: "secret" }]; })],
    ["exotic profile field", nestedPayload("models-auth-status", (p) => { p.providers[0].profiles = [{ profileId: "id", type: "token", status: "healthy", unexpected: new Map() }]; })],
    ["secret expiry field", nestedPayload("models-auth-status", (p) => { p.providers[0].expiry.authorization = "secret"; })],
    ["exotic profile expiry field", nestedPayload("models-auth-status", (p) => { p.providers[0].profiles[0].expiry.unexpected = new Date(); })],
    ["secret usage field", nestedPayload("models-auth-status", (p) => { p.providers[0].usage.password = "secret"; })],
    ["secret usage window field", nestedPayload("models-auth-status", (p) => { p.providers[0].usage.windows[0].authorization = "secret"; })],
    ["exotic billing field", nestedPayload("models-auth-status", (p) => { p.providers[0].usage.billing[0].unexpected = new Map(); })],
  ]],
  ["sessions.list", parseSessionsList, [
    ["secret defaults field", nestedPayload("sessions-list", (p) => { p.defaults.authorization = "secret"; })],
    ["exotic defaults field", nestedPayload("sessions-list", (p) => { p.defaults.unexpected = new Date(); })],
    ["secret session field", nestedPayload("sessions-list", (p) => { p.sessions[0].password = "secret"; })],
    ["exotic session field", nestedPayload("sessions-list", (p) => { p.sessions[0].unexpected = new Set(); })],
  ]],
  ["sessions.describe", parseSessionsDescribe, [
    ["secret session field", nestedPayload("sessions-describe", (p) => { p.session.authorization = "secret"; })],
    ["exotic session field", nestedPayload("sessions-describe", (p) => { p.session.unexpected = new Date(); })],
  ]],
  ["usage.status", parseUsageStatus, [
    ["secret provider field", nestedPayload("usage-status", (p) => { p.providers[0].authorization = "secret"; })],
    ["exotic provider field", nestedPayload("usage-status", (p) => { p.providers[0].unexpected = new Date(); })],
    ["secret window field", nestedPayload("usage-status", (p) => { p.providers[0].windows = [{ label: "daily", password: "secret" }]; })],
    ["exotic window field", nestedPayload("usage-status", (p) => { p.providers[0].windows = [{ label: "daily", unexpected: new Map() }]; })],
  ]],
  ["usage.cost", parseUsageCost, [
    ["secret totals field", nestedPayload("usage-cost", (p) => { p.totals.authorization = "secret"; })],
    ["exotic totals field", nestedPayload("usage-cost", (p) => { p.totals.unexpected = new Date(); })],
    ["secret daily field", nestedPayload("usage-cost", (p) => { p.daily[0].password = "secret"; })],
    ["exotic daily field", nestedPayload("usage-cost", (p) => { p.daily[0].unexpected = new Map(); })],
  ]],
  ["tasks.list", parseTasksList, [
    ["secret task field", nestedPayload("tasks-list", (p) => { p.tasks[0].authorization = "secret"; })],
    ["exotic task field", nestedPayload("tasks-list", (p) => { p.tasks[0].unexpected = new Date(); })],
  ]],
  ["tasks.get", parseTasksGet, [
    ["secret task field", nestedPayload("tasks-get", (p) => { p.task.password = "secret"; })],
    ["exotic task field", nestedPayload("tasks-get", (p) => { p.task.unexpected = new Set(); })],
  ]],
  ["tasks.cancel", parseTasksCancel, [
    ["secret optional task field", nestedPayload("tasks-cancel", (p) => { p.task.authorization = "secret"; })],
    ["exotic optional task field", nestedPayload("tasks-cancel", (p) => { p.task.unexpected = new Date(); })],
  ]],
  ["agents.list", parseAgentsList, [
    ["secret agent field", nestedPayload("agents-list", (p) => { p.agents[0].authorization = "secret"; })],
    ["exotic agent field", nestedPayload("agents-list", (p) => { p.agents[0].unexpected = new Date(); })],
    ["secret identity field", nestedPayload("agents-list", (p) => { p.agents[0].identity = { name: "Agent", password: "secret" }; })],
    ["exotic identity field", nestedPayload("agents-list", (p) => { p.agents[0].identity = { name: "Agent", unexpected: new Map() }; })],
    ["secret model field", nestedPayload("agents-list", (p) => { p.agents[0].model = { primary: "model-a", authorization: "secret" }; })],
    ["exotic model field", nestedPayload("agents-list", (p) => { p.agents[0].model = { primary: "model-a", unexpected: new Set() }; })],
  ]],
] as const;

const malformedByParser = [
  ["models.list", parseModelsList, [
    ["missing models", {}], ["models is not an array", { models: {} }], ["malformed model", { models: [{ id: "m", name: "M" }] }],
    ["malformed optional model field", { models: [{ id: "m", name: "M", provider: "p", contextWindow: 0 }] }],
  ]],
  ["models.authStatus", parseModelsAuthStatus, [
    ["missing providers", { ts: 1 }], ["providers is not an array", { ts: 1, providers: {} }], ["profiles is not an array", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: {} }] }],
    ["malformed profile", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: [{ profileId: "id", type: "token" }] }] }],
    ["malformed optional profile field", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: [{ profileId: "id", type: "token", status: "healthy", logoutSupported: "yes" }] }] }],
    ["malformed provider expiry", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", expiry: { at: "bad", remainingMs: 1, label: "1s" }, profiles: [] }] }],
    ["malformed profile expiry", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: [{ profileId: "id", type: "oauth", status: "healthy", expiry: { at: 1, remainingMs: "soon", label: "1s" } }] }] }],
    ["malformed usage window", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: [], usage: { windows: [{ label: "5h", usedPercent: "full" }] } }] }],
    ["malformed usage billing", { ts: 1, providers: [{ provider: "p", displayName: "P", status: "healthy", profiles: [], usage: { windows: [], billing: [{ type: "budget", used: 1, unit: "USD" }] } }] }],
  ]],
  ["sessions.list", parseSessionsList, [
    ["missing sessions", { ts: 1, count: 0, defaults: {} }], ["sessions is not an array", { ts: 1, count: 0, defaults: {}, sessions: {} }],
    ["malformed session", { ts: 1, count: 1, defaults: {}, sessions: [{ key: 1 }] }], ["malformed defaults", { ts: 1, count: 0, defaults: { authorization: "secret" }, sessions: [] }],
    ["malformed optional path", { ts: 1, path: 1, count: 0, defaults: {}, sessions: [] }],
  ]],
  ["sessions.describe", parseSessionsDescribe, [
    ["missing session", {}], ["malformed session", { session: { key: 1 } }], ["malformed optional session id", { session: { key: "s", sessionId: 1 } }],
  ]],
  ["sessions.abort", parseSessionsAbort, [
    ["missing result fields", {}], ["malformed run id", { ok: true, abortedRunId: 1, status: "aborted" }], ["closed status", { ok: true, abortedRunId: null, status: "closed" }],
  ]],
  ["usage.status", parseUsageStatus, [
    ["missing providers", { updatedAt: 1 }], ["providers is not an array", { updatedAt: 1, providers: {} }],
    ["windows is not an array", { updatedAt: 1, providers: [{ provider: "p", displayName: "P", windows: {} }] }], ["malformed window", { updatedAt: 1, providers: [{ provider: "p", displayName: "P", windows: [{ usedPercent: "full" }] }] }],
    ["malformed optional window label", { updatedAt: 1, providers: [{ provider: "p", displayName: "P", windows: [{ label: 1 }] }] }],
  ]],
  ["usage.cost", parseUsageCost, [
    ["missing daily", { updatedAt: 1, days: 1, totals: {} }], ["daily is not an array", { updatedAt: 1, days: 1, totals: {}, daily: {} }],
    ["malformed totals", { updatedAt: 1, days: 1, totals: null, daily: [] }],
    ["malformed daily row", { updatedAt: 1, days: 1, totals: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, totalCost: 0.1, missingCostEntries: 0 }, daily: [{ date: "2026-01-02" }] }],
    ["malformed days", { ...(fixture("usage-cost") as Record<string, unknown>), days: -1 }],
  ]],
  ["tasks.list", parseTasksList, [
    ["missing tasks", {}], ["tasks is not an array", { tasks: {} }], ["malformed task", { tasks: [{ id: "t", status: "mystery" }] }], ["malformed optional task field", { tasks: [{ id: "t", status: "running", toolUseCount: -1 }] }],
  ]],
  ["tasks.get", parseTasksGet, [
    ["missing task", {}], ["malformed task", { task: { id: "t", status: "closed" } }], ["malformed optional task field", { task: { id: "t", status: "running", title: 1 } }],
  ]],
  ["tasks.cancel", parseTasksCancel, [
    ["missing result fields", {}], ["malformed optional task", { found: false, cancelled: false, task: null }], ["closed task status", { found: true, cancelled: false, task: { id: "t", status: "closed" } }],
    ["malformed optional reason", { found: false, cancelled: false, reason: 1 }],
  ]],
  ["agents.list", parseAgentsList, [
    ["missing agents", { defaultId: "a", mainKey: "m", scope: "global" }], ["agents is not an array", { defaultId: "a", mainKey: "m", scope: "global", agents: {} }],
    ["malformed agent", { defaultId: "a", mainKey: "m", scope: "global", agents: [{ id: "a", model: { primary: 1 } }] }], ["closed scope", { defaultId: "a", mainKey: "m", scope: "private", agents: [] }],
    ["malformed optional identity", { defaultId: "a", mainKey: "m", scope: "global", agents: [{ id: "a", identity: { emoji: 1 } }] }],
  ]],
] as const;

describe("OpenClaw control-plane wire validation", () => {
  it.each(parsers)("accepts the sanitized %s fixture", (name, parse) => {
    expect(parse(fixture(name))).toEqual(fixture(name));
  });

  it.each(malformedByParser)("rejects malformed %s payloads", (_name, parse, cases) => {
    expect(() => parse(null)).toThrow(OpenClawWireError);
    for (const [caseName, value] of cases) {
      expect(() => parse(value), caseName).toThrow(OpenClawWireError);
    }
  });

  it("tolerates a benign metadata field under a sensitive name but rejects a leaked secret string", () => {
    // `apiKey: { source, envVar }` is auth METADATA (no secret value) that the
    // live gateway attaches to each provider — it must not hard-fail a read.
    const withMetadata = {
      ts: 1,
      providers: [{ provider: "anthropic", displayName: "Claude", status: "static", profiles: [], apiKey: { source: "env", envVar: "ANTHROPIC_API_KEY" } }],
    };
    expect(() => parseModelsAuthStatus(withMetadata)).not.toThrow();
    // But a sensitive-named key carrying a STRING value is a possibly-leaked
    // secret and is still rejected.
    const withSecret = {
      ts: 1,
      providers: [{ provider: "anthropic", displayName: "Claude", status: "static", profiles: [], apiKey: "sk-live-abc123" }],
    };
    expect(() => parseModelsAuthStatus(withSecret)).toThrow(OpenClawWireError);
  });

  it("accepts a task-less cancel result", () => {
    expect(parseTasksCancel({ found: false, cancelled: false })).toEqual({ found: false, cancelled: false });
  });

  it.each(parsers)("rejects secret and exotic extras for %s", (name, parse) => {
    const input = fixture(name) as Record<string, unknown>;
    expect(() => parse({ ...input, authorization: "secret" })).toThrow(OpenClawWireError);
    expect(() => parse({ ...input, unexpected: new Date() })).toThrow(OpenClawWireError);
  });

  it.each(nestedSafetyByParser)("rejects nested secret and exotic values for %s", (_name, parse, cases) => {
    for (const [caseName, value] of cases) {
      expect(() => parse(value), caseName).toThrow(OpenClawWireError);
    }
  });

  it("strictly reconstructs usage cost daily rows", () => {
    const valid = fixture("usage-cost") as Record<string, unknown>;
    const parsed = parseUsageCost(valid);
    expect(parsed).toEqual(valid);
    expect(parsed).not.toBe(valid);
    expect(parsed.daily).not.toBe(valid.daily);
    expect((parsed.daily as unknown[])[0]).not.toBe((valid.daily as unknown[])[0]);

    const row = (valid.daily as Record<string, unknown>[])[0];
    // Sensitive/unsafe fields are still rejected...
    expect(() => parseUsageCost({ ...valid, daily: [{ ...row, authorization: "secret" }] })).toThrow(OpenClawWireError);
    expect(() => parseUsageCost({ ...valid, daily: [{ ...row, date: new Date() }] })).toThrow(OpenClawWireError);
    expect(() => parseUsageCost({ ...valid, daily: [{ ...row, totalCost: new Map() }] })).toThrow(OpenClawWireError);
    // ...but a benign unknown field is TOLERATED (forward compatibility): a live
    // gateway adds fields over time and a read client must not hard-fail.
    expect(() => parseUsageCost({ ...valid, daily: [{ ...row, unexpected: true }] })).not.toThrow();
  });

  it.each([
    ["sessions pagination", parseSessionsList, { ...(fixture("sessions-list") as object), totalCount: -1 }],
    ["sessions pagination completeness", parseSessionsList, nestedPayload("sessions-list", (p) => { delete p.nextOffset; })],
    ["sessions pagination count", parseSessionsList, nestedPayload("sessions-list", (p) => { p.count = 0; })],
    ["sessions pagination continuation", parseSessionsList, nestedPayload("sessions-list", (p) => { p.hasMore = true; })],
    ["sessions defaults runtime", parseSessionsList, nestedPayload("sessions-list", (p) => { p.defaults.agentRuntime.source = "invented"; })],
    ["sessions defaults thinking", parseSessionsList, nestedPayload("sessions-list", (p) => { p.defaults.thinkingLevels[0].label = 1; })],
    ["session kind", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].kind = "private"; })],
    ["session label", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].label = 1; })],
    ["session display name", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].displayName = 1; })],
    ["session token count", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].totalTokens = -1; })],
    ["session runtime", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].agentRuntime.source = "invented"; })],
    ["session response usage", parseSessionsList, nestedPayload("sessions-list", (p) => { p.sessions[0].effectiveResponseUsage = "verbose"; })],
    ["usage cost details", parseUsageCost, nestedPayload("usage-cost", (p) => { p.totals.inputCost = -1; })],
    ["usage cache status", parseUsageCost, nestedPayload("usage-cost", (p) => { p.cacheStatus.status = "unknown"; })],
    ["usage cache counts", parseUsageCost, nestedPayload("usage-cost", (p) => { p.cacheStatus.pendingFiles = -1; })],
    ["agent runtime", parseAgentsList, nestedPayload("agents-list", (p) => { p.agents[0].agentRuntime.id = ""; })],
    ["agent thinking options", parseAgentsList, nestedPayload("agents-list", (p) => { p.agents[0].thinkingOptions = ["off", 1]; })],
  ] as const)("rejects malformed current upstream field: %s", (_name, parse, payload) => {
    expect(() => parse(payload)).toThrow(OpenClawWireError);
  });

  const usageMetricKeys = [
    "input",
    "output",
    "cacheRead",
    "cacheWrite",
    "totalTokens",
    "totalCost",
    "missingCostEntries",
  ] as const;

  it.each(usageMetricKeys.flatMap((metric) => ["totals", "daily"].map((location) => [location, metric] as const)))(
    "rejects omitted required usage cost metric %s.%s",
    (location, metric) => {
      const input = structuredClone(fixture("usage-cost")) as Record<string, any>;
      delete (location === "totals" ? input.totals : input.daily[0])[metric];
      expect(() => parseUsageCost(input)).toThrow(OpenClawWireError);
    },
  );

  it.each(
    usageMetricKeys.flatMap((metric) =>
      ["totals", "daily"].flatMap((location) =>
        [NaN, Infinity, -1].map((value) => [location, metric, value] as const),
      ),
    ),
  )("rejects malformed usage cost metric %s.%s=%s", (location, metric, value) => {
    const input = structuredClone(fixture("usage-cost")) as Record<string, any>;
    (location === "totals" ? input.totals : input.daily[0])[metric] = value;
    expect(() => parseUsageCost(input)).toThrow(OpenClawWireError);
  });

  it.each([
    ["provider expiry missing at", (p: Record<string, any>) => { delete p.providers[0].expiry.at; }],
    ["provider expiry non-finite remainingMs", (p: Record<string, any>) => { p.providers[0].expiry.remainingMs = Infinity; }],
    ["profile expiry empty label", (p: Record<string, any>) => { p.providers[0].profiles[0].expiry.label = ""; }],
    ["usage missing windows", (p: Record<string, any>) => { delete p.providers[0].usage.windows; }],
    ["usage malformed summary", (p: Record<string, any>) => { p.providers[0].usage.summary = 1; }],
    ["usage malformed plan", (p: Record<string, any>) => { p.providers[0].usage.plan = false; }],
    ["window missing label", (p: Record<string, any>) => { delete p.providers[0].usage.windows[0].label; }],
    ["window missing usedPercent", (p: Record<string, any>) => { delete p.providers[0].usage.windows[0].usedPercent; }],
    ["window string resetAt", (p: Record<string, any>) => { p.providers[0].usage.windows[0].resetAt = "2026-01-01T00:00:00Z"; }],
    ["unknown billing kind", (p: Record<string, any>) => { p.providers[0].usage.billing = [{ type: "credit", amount: 1, unit: "USD" }]; }],
    ["balance malformed amount", (p: Record<string, any>) => { p.providers[0].usage.billing[0].amount = NaN; }],
    ["spend malformed resetAt", (p: Record<string, any>) => { p.providers[0].usage.billing[1].resetAt = -1; }],
    ["budget missing limit", (p: Record<string, any>) => { delete p.providers[0].usage.billing[2].limit; }],
  ] as const)("rejects malformed nested auth status data: %s", (_name, mutate) => {
    expect(() => parseModelsAuthStatus(nestedPayload("models-auth-status", mutate))).toThrow(OpenClawWireError);
  });

  it.each([
    ["models.authStatus ts", parseModelsAuthStatus, { ts: "bad", providers: [] }],
    ["sessions.list ts", parseSessionsList, { ts: -1, count: 0, defaults: {}, sessions: [] }],
    ["sessions.list session createdAt", parseSessionsList, { ts: 1, count: 1, defaults: {}, sessions: [{ key: "s", createdAt: 1.5 }] }],
    ["sessions.list session updatedAt", parseSessionsList, { ts: 1, count: 1, defaults: {}, sessions: [{ key: "s", updatedAt: 8_640_000_000_000_001 }] }],
    ["sessions.describe session createdAt", parseSessionsDescribe, { session: { key: "s", createdAt: "bad" } }],
    ["sessions.describe session updatedAt", parseSessionsDescribe, { session: { key: "s", updatedAt: -1 } }],
    ["usage.status updatedAt", parseUsageStatus, { updatedAt: "bad", providers: [] }],
    ["usage.status window resetAt", parseUsageStatus, { updatedAt: 1, providers: [{ provider: "p", displayName: "P", windows: [{ resetAt: 1.5 }] }] }],
    ["usage.cost updatedAt", parseUsageCost, { ...(fixture("usage-cost") as Record<string, unknown>), updatedAt: "bad" }],
    ["tasks.list createdAt", parseTasksList, { tasks: [{ id: "t", status: "running", createdAt: "bad" }] }],
    ["tasks.list updatedAt", parseTasksList, { tasks: [{ id: "t", status: "running", updatedAt: -1 }] }],
    ["tasks.list startedAt", parseTasksList, { tasks: [{ id: "t", status: "running", startedAt: 1.5 }] }],
    ["tasks.list endedAt", parseTasksList, { tasks: [{ id: "t", status: "running", endedAt: 8_640_000_000_000_001 }] }],
    ["tasks.get createdAt", parseTasksGet, { task: { id: "t", status: "running", createdAt: "bad" } }],
    ["tasks.get updatedAt", parseTasksGet, { task: { id: "t", status: "running", updatedAt: -1 } }],
    ["tasks.get startedAt", parseTasksGet, { task: { id: "t", status: "running", startedAt: 1.5 } }],
    ["tasks.get endedAt", parseTasksGet, { task: { id: "t", status: "running", endedAt: 8_640_000_000_000_001 } }],
    ["tasks.cancel createdAt", parseTasksCancel, { found: true, cancelled: true, task: { id: "t", status: "cancelled", createdAt: "bad" } }],
    ["tasks.cancel updatedAt", parseTasksCancel, { found: true, cancelled: true, task: { id: "t", status: "cancelled", updatedAt: -1 } }],
    ["tasks.cancel startedAt", parseTasksCancel, { found: true, cancelled: true, task: { id: "t", status: "cancelled", startedAt: 1.5 } }],
    ["tasks.cancel endedAt", parseTasksCancel, { found: true, cancelled: true, task: { id: "t", status: "cancelled", endedAt: 8_640_000_000_000_001 } }],
  ] as const)("rejects an invalid parser timestamp: %s", (_name, parse, value) => {
    expect(() => parse(value)).toThrow(OpenClawWireError);
  });

  it.each(["", -1, 1.5, null, "not-a-date", 8_640_000_000_000_001])("rejects invalid timestamps: %s", (value) => {
    expect(() => normalizeTimestamp(value)).toThrow(OpenClawWireError);
  });

  it("normalizes canonical timestamps and states", () => {
    expect(normalizeTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
    expect(normalizeTimestamp("2026-01-02T03:04:05.000Z")).toBe("2026-01-02T03:04:05.000Z");
    expect(normalizeState("queued")).toEqual({ state: "pending", metadata: {} });
    expect(normalizeState("timed_out")).toEqual({ state: "failed", metadata: { upstreamState: "timed_out" } });
    expect(normalizeState("future-state")).toEqual({ state: "unknown", metadata: { upstreamState: "future-state" } });
  });

  it("recursively strips secret-like keys and rejects non-JSON values", () => {
    expect(safeMetadata({ visible: { count: 1, apiKey: "redact" }, authorization: "redact", values: [true, null] })).toEqual({ visible: { count: 1 }, values: [true, null] });
    expect(() => safeMetadata({ value: undefined })).toThrow(OpenClawWireError);
    expect(() => normalizeState("apiKey")).toThrow(OpenClawWireError);
  });

  it("reconstructs prototype-shaped metadata keys without changing inheritance", () => {
    const input: Record<string, unknown> = { constructor: "constructor-value", prototype: { visible: true } };
    Object.defineProperty(input, "__proto__", { value: { polluted: true }, enumerable: true, configurable: true, writable: true });

    const result = safeMetadata(input);

    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(result.__proto__).toEqual({ polluted: true });
    expect(result.constructor).toBe("constructor-value");
    expect(result.prototype).toEqual({ visible: true });
    expect((result as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["date", new Date()], ["map", new Map()], ["set", new Set()],
    ["class", new (class Example {})()], ["function", () => undefined],
    ["symbol", Symbol("x")], ["bigint", 1n], ["undefined", undefined],
    ["infinity", Infinity], ["nan", Number.NaN],
  ])("rejects non-JSON metadata values: %s", (_name, value) => {
    expect(() => safeMetadata({ value })).toThrow(OpenClawWireError);
  });

  it("rejects cyclic metadata", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() => safeMetadata(cyclic)).toThrow(OpenClawWireError);
  });
});
