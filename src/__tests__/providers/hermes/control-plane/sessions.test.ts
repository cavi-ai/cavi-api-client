import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { HermesDashboardRestClient } from "../../../../providers/hermes/control-plane/dashboard-rest";
import { createHermesSessionOperations } from "../../../../providers/hermes/control-plane/session-operations";
import { createHermesSessionClient } from "../../../../providers/hermes/control-plane/sessions";
import type { HermesDashboardJsonRpcClient } from "../../../../providers/hermes/control-plane/types";

function result(name: string): unknown {
  const envelope = JSON.parse(readFileSync(fileURLToPath(new URL(
    `../../../fixtures/hermes/dashboard/json-rpc/${name}.json`, import.meta.url,
  )), "utf8")) as { result: unknown };
  return envelope.result;
}

function restFixture(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(new URL(
    `../../../fixtures/hermes/dashboard/rest/${name}.json`, import.meta.url,
  )), "utf8")) as unknown;
}

function setup(payloads: unknown[]) {
  const rpc: HermesDashboardJsonRpcClient = {
    request: vi.fn(), subscribe: vi.fn(() => () => undefined), dispose: vi.fn(async () => undefined),
  };
  for (const payload of payloads) vi.mocked(rpc.request).mockResolvedValueOnce(payload);
  const rest = { getSession: vi.fn(async () => restFixture("session-detail")) } as unknown as HermesDashboardRestClient;
  return { rpc, operations: createHermesSessionOperations({ rpc, rest }) };
}

describe("Hermes canonical session client", () => {
  it("pages stably and preserves opaque ids, status, timestamps, and absent optionals", async () => {
    const fixturePayload = result("session-list-result") as { sessions: Array<Record<string, unknown>> };
    const payload = { sessions: [...fixturePayload.sessions, { ...fixturePayload.sessions[0], id: "opaque/second" }] };
    const { operations } = setup([payload, payload, payload]);
    const client = createHermesSessionClient(operations);
    const first = await client.listSessions({ limit: 1 });
    expect(first.data).toEqual([{
      id: "session-fixture-001", providerId: "session-fixture-001", title: "Sanitized fixture session",
      state: "unknown", createdAt: "2026-07-14T16:00:00.000Z", updatedAt: "2026-07-14T16:00:00.000Z",
      providerKind: "hermes", metadata: { provider: "hermes", stability: "experimental", source: { transport: "json-rpc", method: "session.list" } },
    }]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(first.data[0]).not.toHaveProperty("model");
    const second = await client.listSessions({ cursor: first.nextCursor, limit: 1 });
    expect(second.data[0]?.id).toBe("opaque/second");
    expect(second.nextCursor).toEqual(expect.any(String));
    const terminal = await client.listSessions({ cursor: second.nextCursor, limit: 1 });
    expect(terminal).toEqual({ data: [] });
    await expect(client.listSessions({ cursor: "not-a-cursor" })).rejects.toThrow("Invalid Hermes session cursor");
  });

  it("emits a cursor for an exact-limit JSON-RPC page when upstream reports more rows", async () => {
    const fixturePayload = result("session-list-result") as { sessions: Array<Record<string, unknown>> };
    const { operations } = setup([{ sessions: fixturePayload.sessions, total: 2 }]);

    await expect(createHermesSessionClient(operations).listSessions({ limit: 1 }))
      .resolves.toMatchObject({ data: [{ id: "session-fixture-001" }], nextCursor: expect.any(String) });
  });

  it("uses bounded optimistic pagination for an exact-limit JSON-RPC page without a total", async () => {
    const fixturePayload = result("session-list-result") as { sessions: Array<Record<string, unknown>> };
    const { operations } = setup([{ sessions: fixturePayload.sessions }]);
    await expect(createHermesSessionClient(operations).listSessions({ limit: 1 }))
      .resolves.toMatchObject({ nextCursor: expect.any(String) });
  });

  it("maps fixture-proven interrupt semantics to cancellation and forwards abort options", async () => {
    const { rpc, operations } = setup([result("session-interrupt-result")]);
    const client = createHermesSessionClient(operations);
    const signal = new AbortController().signal;
    const cancelled = await client.cancelSession!("opaque/session id", { signal });
    expect(rpc.request).toHaveBeenCalledWith("session.interrupt", { session_id: "opaque/session id" }, { signal });
    expect(cancelled).toEqual({
      id: "opaque/session id", providerId: "opaque/session id", state: "cancelled", providerKind: "hermes",
      metadata: { provider: "hermes", stability: "experimental", source: { transport: "json-rpc", method: "session.interrupt" }, providerData: { status: "interrupted" } },
    });
  });

  it("bounds page prefixes and rejects overflow cursors before dispatch", async () => {
    const { rpc, operations } = setup([]);
    const client = createHermesSessionClient(operations);
    const cursor = Buffer.from(JSON.stringify({ v: 1, offset: 199 })).toString("base64url");
    await expect(client.listSessions({ cursor, limit: Number.MAX_SAFE_INTEGER })).rejects.toThrow(/page window/i);
    const overflow = Buffer.from(JSON.stringify({ v: 1, offset: 200 })).toString("base64url");
    await expect(client.listSessions({ cursor: overflow })).rejects.toThrow("Invalid Hermes session cursor");
    expect(rpc.request).not.toHaveBeenCalled();
  });

  it("accepts the conservative maximum page size without unsafe arithmetic", async () => {
    const payload = result("session-list-result");
    const { rpc, operations } = setup([payload]);
    await expect(createHermesSessionClient(operations).listSessions({
      limit: Number.MAX_SAFE_INTEGER,
    })).resolves.toMatchObject({ data: [{ id: "session-fixture-001" }] });
    expect(rpc.request).toHaveBeenCalledWith("session.list", { limit: 200 }, { signal: undefined });
  });

  it("never emits a cursor at the 200-session boundary even when upstream total is larger", async () => {
    const fixturePayload = result("session-list-result") as { sessions: Array<Record<string, unknown>> };
    const sessions = Array.from({ length: 200 }, (_, index) => ({
      ...fixturePayload.sessions[0], id: `session-${index}`,
    }));
    const { operations } = setup([{ sessions, total: 201 }]);
    const page = await createHermesSessionClient(operations).listSessions({ limit: 200 });
    expect(page.data).toHaveLength(200);
    expect(page.nextCursor).toBeUndefined();
  });

  it("gets REST-backed detail and rejects unsupported preview and patch exactly", async () => {
    const { operations } = setup([]);
    await expect(createHermesSessionClient(operations).getSession("session-fixture-001")).resolves.toEqual({
      id: "session-fixture-001", providerId: "session-fixture-001", title: "Sanitized fixture session",
      state: "unknown", createdAt: "2026-07-14T16:00:00.000Z", updatedAt: "2026-07-14T16:02:00.000Z",
      providerKind: "hermes", metadata: { provider: "hermes", stability: "experimental", source: { transport: "http", method: "session.detail" } },
    });
    await expect(operations.preview({ keys: ["s"] })).rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.sessions.preview"));
    await expect(operations.patch({ key: "s", label: "x" })).rejects.toEqual(new CapabilityUnavailable("hermes", "controlPlane.sessions.patch"));
  });

  it("rejects malformed interrupt results without claiming cancellation", async () => {
    const { operations } = setup([{ status: "ok" }]);
    await expect(createHermesSessionClient(operations).cancelSession!("s")).rejects.toThrow(/schema/i);
  });
});
