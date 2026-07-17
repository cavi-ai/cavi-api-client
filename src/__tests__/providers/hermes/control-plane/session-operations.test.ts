import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { TransportError } from "../../../../core/transport/error.js";
import type { HermesDashboardRestClient } from "../../../../providers/hermes/control-plane/dashboard-rest";
import { createHermesSessionOperations } from "../../../../providers/hermes/control-plane/session-operations";
import { createHermesSessionClient } from "../../../../providers/hermes/control-plane/sessions";
import type { HermesDashboardJsonRpcClient } from "../../../../providers/hermes/control-plane/types";

function fixture(kind: "json-rpc" | "rest", name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(
    `../../../fixtures/hermes/dashboard/${kind}/${name}.json`, import.meta.url,
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
    vi.mocked(rpc.request).mockRejectedValueOnce(new TransportError("socket closed", {
      metadata: { kind: "json-rpc", phase: "close", operation: "json-rpc", retryable: false, attempt: 1 },
    }));
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
        createdAt: 1_784_044_800_000, updatedAt: 1_784_044_920_000, totalTokens: 150,
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
    vi.mocked(rpc.request).mockRejectedValueOnce(new TransportError("socket closed", {
      metadata: { kind: "json-rpc", phase: "close", operation: "json-rpc", retryable: false, attempt: 1 },
    }));

    await expect(createHermesSessionOperations({ rpc, rest }).usage({})).resolves.toEqual({
      aggregates: { messages: { total: 2, toolCalls: 0, errors: 0 } },
      totals: { totalCost: 0.0015 },
    });
    expect(rest.getUsage).toHaveBeenCalledWith(undefined);
  });

  it.each([
    new TransportError("auth", { metadata: { kind: "json-rpc", phase: "authenticate", operation: "json-rpc", retryable: false, attempt: 1 } }),
    new TransportError("method", { metadata: { kind: "json-rpc", phase: "request", operation: "json-rpc", retryable: false, attempt: 1, code: -32601 } }),
    new TransportError("rate", { metadata: { kind: "json-rpc", phase: "request", operation: "json-rpc", retryable: true, attempt: 1, status: 429 } }),
    new TransportError("decode", { metadata: { kind: "json-rpc", phase: "decode", operation: "json-rpc", retryable: false, attempt: 1 } }),
    new Error("programming failure"),
  ])("does not REST-fallback for non-unavailability failure %#", async (failure) => {
    const { rpc, rest } = drivers(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce(failure);
    await expect(createHermesSessionOperations({ rpc, rest }).list({})).rejects.toBe(failure);
    expect(rest.listSessions).not.toHaveBeenCalled();
  });

  it("falls back only for classified transport close/connect failures", async () => {
    const { rpc, rest } = drivers(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce(new TransportError("connect unavailable", {
      metadata: { kind: "json-rpc", phase: "connect", operation: "json-rpc", retryable: true, attempt: 1 },
    }));
    await expect(createHermesSessionOperations({ rpc, rest }).list({})).resolves.toMatchObject({ count: 1 });
  });

  it("does not repeat a cursor when REST fallback cannot advance beyond its first-page prefix", async () => {
    const restPayload = fixture("rest", "sessions") as { sessions: unknown[]; total: number };
    const { rpc, rest } = drivers(undefined, {
      listSessions: vi.fn(async () => ({ ...restPayload, total: 2 } as never)),
    });
    vi.mocked(rpc.request).mockRejectedValue(new TransportError("closed", {
      metadata: { kind: "json-rpc", phase: "close", operation: "json-rpc", retryable: false, attempt: 1 },
    }));
    const client = createHermesSessionClient(createHermesSessionOperations({ rpc, rest }));
    const first = await client.listSessions({ limit: 1 });
    expect(first.nextCursor).toEqual(expect.any(String));
    const second = await client.listSessions({ cursor: first.nextCursor, limit: 1 });
    expect(second).toEqual({ data: [] });
    expect(rest.listSessions).toHaveBeenCalledTimes(2);
  });

  it.each(["prototype", "accessor", "blocked-key"])("rejects unsafe RPC %s rows without property access", async (kind) => {
    let reads = 0;
    let row: Record<string, unknown>;
    if (kind === "prototype") row = Object.assign(Object.create({ id: "inherited" }), { started_at: 1 });
    else if (kind === "accessor") {
      row = { id: "safe", started_at: 1 };
      Object.defineProperty(row, "title", { enumerable: true, get() { reads += 1; return "unsafe"; } });
    } else {
      row = { id: "safe", started_at: 1 };
      Object.defineProperty(row, "__proto__", { enumerable: true, value: {} });
    }
    const { rpc, rest } = drivers({ sessions: [row] });
    await expect(createHermesSessionOperations({ rpc, rest }).list({})).rejects.toThrow(/schema/i);
    expect(reads).toBe(0);
    expect(rest.listSessions).not.toHaveBeenCalled();
  });

  it("rejects malformed payloads and pre-aborted requests without fallback dispatch", async () => {
    const { rpc, rest } = drivers({ sessions: [{ id: 7 }] });
    const operations = createHermesSessionOperations({ rpc, rest });
    await expect(operations.list({})).rejects.toThrow(/schema/i);
    expect(rest.listSessions).not.toHaveBeenCalled();

    const controller = new AbortController();
    controller.abort({ token: "abort-secret" });
    const error = await operations.usage({}, { signal: controller.signal }).catch((reason: unknown) => reason);
    expect(error).toMatchObject({ code: "aborted", message: "Operation aborted" });
    expect(String(error)).not.toContain("abort-secret");
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it.each(["abort-string-secret", { token: "abort-object-secret" }])(
    "normalizes non-Error abort reason %# without leaking it",
    async (reason) => {
      const { rpc, rest } = drivers(undefined);
      const controller = new AbortController();
      controller.abort(reason);
      const error = await createHermesSessionOperations({ rpc, rest })
        .list({}, { signal: controller.signal }).catch((value: unknown) => value);
      expect(error).toMatchObject({ code: "aborted", message: "Operation aborted" });
      expect(String(error)).not.toContain("secret");
      expect(rpc.request).not.toHaveBeenCalled();
      expect(rest.listSessions).not.toHaveBeenCalled();
    },
  );
});
