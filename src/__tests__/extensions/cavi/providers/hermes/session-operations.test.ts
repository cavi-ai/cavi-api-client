import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { HermesDashboardRestClient } from "../../../../../extensions/cavi/providers/hermes/dashboard-rest.js";
import { createHermesSessionOperations } from "../../../../../extensions/cavi/providers/hermes/session-operations.js";
import type { HermesDashboardJsonRpcClient } from "../../../../../extensions/cavi/providers/hermes/types.js";

function fixture(kind: "json-rpc" | "rest", name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(
    `../../../../fixtures/hermes/dashboard/${kind}/${name}.json`, import.meta.url,
  )), "utf8")) as unknown;
}

function drivers(rpcPayload: unknown, overrides: Partial<HermesDashboardRestClient> = {}) {
  const rpc: HermesDashboardJsonRpcClient = {
    request: vi.fn(async () => rpcPayload), subscribe: vi.fn(() => () => undefined), dispose: vi.fn(async () => undefined),
  };
  const rest = {
    listSessions: vi.fn(async () => fixture("rest", "sessions")),
    getSession: vi.fn(async () => fixture("rest", "session-detail")),
    deleteSession: vi.fn(async () => fixture("rest", "session-delete")),
    getUsage: vi.fn(async () => fixture("rest", "analytics-usage")),
    getModels: vi.fn(), getProviderAuth: vi.fn(), getProfile: vi.fn(), getConfig: vi.fn(),
    ...overrides,
  } as HermesDashboardRestClient;
  return { rpc, rest };
}

describe("Hermes session operations", () => {
  it("uses singular Hermes RPC names and translates fixture payloads without invented fields", async () => {
    const listResult = fixture("json-rpc", "session-list-result") as { result: unknown };
    const usageResult = fixture("json-rpc", "session-usage-result") as { result: unknown };
    const { rpc, rest } = drivers(listResult.result);
    vi.mocked(rpc.request).mockResolvedValueOnce(listResult.result).mockResolvedValueOnce(usageResult.result);
    const operations = createHermesSessionOperations({ rpc, rest });
    const signal = new AbortController().signal;

    await expect(operations.list({ limit: 20 }, { signal })).resolves.toEqual({
      sessions: [{ key: "session-fixture-001", label: "Sanitized fixture session", channel: "tui", createdAt: 1_784_044_800_000, updatedAt: 1_784_044_800_000 }],
      count: 1,
    });
    await expect(operations.usage({}, { signal })).resolves.toEqual({
      aggregates: { messages: { total: 2, toolCalls: 0, errors: 0 } },
      totals: {},
    });
    expect(rpc.request).toHaveBeenNthCalledWith(1, "session.list", { limit: 20 }, { signal });
    expect(rpc.request).toHaveBeenNthCalledWith(2, "session.usage", {}, { signal });
  });

  it("uses REST for detail and produces the same canonical list shape after RPC failure", async () => {
    const { rpc, rest } = drivers(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce(new Error("socket closed"));
    const operations = createHermesSessionOperations({ rpc, rest });

    await expect(operations.list({ limit: 20 })).resolves.toEqual({
      sessions: [{
        key: "session-fixture-001", label: "Sanitized fixture session", channel: "api_server",
        createdAt: 1_784_044_800_000, updatedAt: 1_784_044_860_000, state: "active",
      }],
      count: 1,
    });
    await expect(operations.detail({ key: "session-fixture-001" })).resolves.toEqual({
      key: "session-fixture-001",
      row: {
        key: "session-fixture-001", label: "Sanitized fixture session", channel: "api_server",
        createdAt: 1_784_044_800_000, updatedAt: 1_784_044_800_000, totalTokens: 150,
      },
      usageSession: {
        key: "session-fixture-001", channel: "api_server", model: "fixture-provider/fixture-model",
        usage: { totalTokens: 150, totalCost: 0.0015, messageCounts: { total: 2, toolCalls: 0, errors: 0 } },
      },
    });
    expect(rest.listSessions).toHaveBeenCalledTimes(1);
    expect(rest.getSession).toHaveBeenCalledWith("session-fixture-001", undefined);
  });

  it("normalizes the REST usage fallback through the same canonical payload boundary", async () => {
    const { rpc, rest } = drivers(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce(new Error("socket closed"));

    await expect(createHermesSessionOperations({ rpc, rest }).usage({})).resolves.toEqual({
      aggregates: { messages: { total: 2, toolCalls: 0, errors: 0 } },
      totals: { totalCost: 0.0015 },
    });
    expect(rest.getUsage).toHaveBeenCalledWith(undefined);
  });

  it("rejects malformed payloads and pre-aborted requests without fallback dispatch", async () => {
    const { rpc, rest } = drivers({ sessions: [{ id: 7 }] });
    const operations = createHermesSessionOperations({ rpc, rest });
    await expect(operations.list({})).rejects.toThrow(/schema/i);
    expect(rest.listSessions).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(operations.usage({}, { signal: controller.signal })).rejects.toThrow("stop");
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });
});
