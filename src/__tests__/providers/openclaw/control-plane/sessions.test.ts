import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../../core/errors.js";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";
import { createOpenClawSessionClient } from "../../../../providers/openclaw/control-plane/sessions.js";
import { ApiClientErrorCode } from "../../../../core/errors.js";

function createRpc(payload: unknown): OpenClawRpc {
  return {
    request: vi.fn(async () => payload),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

function cursorForOffset(offset: number): string {
  return Buffer.from(JSON.stringify({ v: 1, offset })).toString("base64url");
}

describe("OpenClaw session control plane", () => {
  it("lists one bounded page and maps only validated session fields", async () => {
    const rpc = createRpc({
      ts: 1_760_000_000_000,
      count: 3,
      defaults: {},
      sessions: [
        { key: "session:1", sessionId: "native-1", createdAt: 1_760_000_000_000 },
        { key: "session:2", updatedAt: "2025-10-09T09:53:20.000Z" },
        { key: "session:3" },
      ],
    });
    const signal = new AbortController().signal;

    const result = await createOpenClawSessionClient(rpc).listSessions({ limit: 2, signal });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("sessions.list", { limit: 2 }, { signal });
    expect(result.data).toEqual([
      {
        id: "session:1",
        providerId: "native-1",
        state: "unknown",
        createdAt: "2025-10-09T08:53:20.000Z",
        providerKind: "openclaw",
        metadata: {
          provider: "openclaw",
          stability: "experimental",
          source: { transport: "websocket", method: "sessions.list" },
        },
      },
      {
        id: "session:2",
        providerId: "session:2",
        state: "unknown",
        updatedAt: "2025-10-09T09:53:20.000Z",
        providerKind: "openclaw",
        metadata: {
          provider: "openclaw",
          stability: "experimental",
          source: { transport: "websocket", method: "sessions.list" },
        },
      },
    ]);
    expect(result.nextCursor).toEqual(expect.any(String));
  });

  it("maps an upstream session label to the canonical title before displayName", async () => {
    const rpc = createRpc({
      ts: 1,
      count: 1,
      defaults: {},
      sessions: [{
        key: "session:labelled",
        sessionId: "native-labelled",
        label: "User rename",
        displayName: "Derived channel title",
      }],
    });

    const result = await createOpenClawSessionClient(rpc).listSessions();

    expect(result.data).toEqual([
      expect.objectContaining({
        id: "session:labelled",
        providerId: "native-labelled",
        title: "User rename",
      }),
    ]);
  });

  it("uses current upstream pagination metadata without truncating later pages", async () => {
    const rpc: OpenClawRpc = {
      request: vi.fn(async (_method, params) => params.limit === 2
        ? {
            ts: 1,
            path: "/sessions",
            count: 2,
            totalCount: 3,
            limitApplied: 2,
            nextOffset: 2,
            hasMore: true,
            defaults: {},
            sessions: [{ key: "s0" }, { key: "s1" }],
          }
        : {
            ts: 1,
            path: "/sessions",
            count: 3,
            totalCount: 3,
            limitApplied: 3,
            nextOffset: null,
            hasMore: false,
            defaults: {},
            sessions: [{ key: "s0" }, { key: "s1" }, { key: "s2" }],
          }),
      subscribe: vi.fn(() => () => undefined),
      dispose: vi.fn(async () => undefined),
    };
    const client = createOpenClawSessionClient(rpc);

    const first = await client.listSessions({ limit: 2 });
    const second = await client.listSessions({ cursor: first.nextCursor, limit: 2 });

    expect(first.data.map(({ id }) => id)).toEqual(["s0", "s1"]);
    expect(first.nextCursor).toEqual(expect.any(String));
    expect(second.data.map(({ id }) => id)).toEqual(["s2"]);
    expect(second.nextCursor).toBeUndefined();
    expect(rpc.request).toHaveBeenNthCalledWith(2, "sessions.list", { limit: 4 }, { signal: undefined });
  });

  it("uses a private cursor offset and caps the upstream page bound", async () => {
    const firstRpc = createRpc({ ts: 0, count: 300, defaults: {}, sessions: [{ key: "s0" }, { key: "s1" }] });
    const first = await createOpenClawSessionClient(firstRpc).listSessions({ limit: 1 });
    const sessions = Array.from({ length: 200 }, (_, index) => ({ key: `s${index}` }));
    const rpc = createRpc({ ts: 0, count: 300, defaults: {}, sessions });

    const result = await createOpenClawSessionClient(rpc).listSessions({ cursor: first.nextCursor, limit: 999 });

    expect(rpc.request).toHaveBeenCalledWith("sessions.list", { limit: 200 }, { signal: undefined });
    expect(result.data).toHaveLength(199);
    expect(result.data[0]?.id).toBe("s1");
    expect(result.nextCursor).toBeUndefined();
  });

  it.each(["not-base64", Buffer.from("{}").toString("base64url"), Buffer.from('{"v":1,"offset":-1}').toString("base64url"), Buffer.from('{"v":2,"offset":0}').toString("base64url")])(
    "rejects invalid cursor %s before sending",
    async (cursor) => {
      const rpc = createRpc({ ts: 0, count: 0, defaults: {}, sessions: [] });

      await expect(createOpenClawSessionClient(rpc).listSessions({ cursor })).rejects.toBeInstanceOf(TypeError);
      expect(rpc.request).not.toHaveBeenCalled();
    },
  );

  it.each([200, 201])(
    "rejects cursor offset %i outside the upstream session window before sending",
    async (offset) => {
      const rpc = createRpc({ ts: 0, count: 0, defaults: {}, sessions: [] });

      await expect(createOpenClawSessionClient(rpc).listSessions({
        cursor: cursorForOffset(offset),
      })).rejects.toThrow("Invalid OpenClaw session cursor");
      expect(rpc.request).not.toHaveBeenCalled();
    },
  );

  it("accepts the maximum valid cursor offset without emitting an invalid successor", async () => {
    const sessions = Array.from({ length: 200 }, (_, index) => ({ key: `s${index}` }));
    const rpc = createRpc({ ts: 0, count: 300, defaults: {}, sessions });

    const result = await createOpenClawSessionClient(rpc).listSessions({
      cursor: cursorForOffset(199),
      limit: 1,
    });

    expect(rpc.request).toHaveBeenCalledWith("sessions.list", { limit: 200 }, { signal: undefined });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]?.id).toBe("s199");
    expect(result.nextCursor).toBeUndefined();
  });

  it("gets with sessions.describe, never sessions.get, and preserves absent optionals", async () => {
    const rpc = createRpc({ session: { key: "session:1" } });
    const signal = new AbortController().signal;

    const result = await createOpenClawSessionClient(rpc).getSession("session:1", { signal });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("sessions.describe", { key: "session:1" }, { signal });
    expect(result).toMatchObject({ id: "session:1", providerId: "session:1", state: "unknown" });
    expect(result).not.toHaveProperty("title");
    expect(result).not.toHaveProperty("createdAt");
    expect(vi.mocked(rpc.request).mock.calls.some(([method]) => method === "sessions.get")).toBe(false);
  });

  it("maps upstream displayName to the canonical title when label is absent", async () => {
    const rpc = createRpc({
      session: {
        key: "session:display-name",
        sessionId: "native-display-name",
        displayName: "Derived channel title",
      },
    });

    const result = await createOpenClawSessionClient(rpc).getSession("session:display-name");

    expect(result).toEqual(expect.objectContaining({
      id: "session:display-name",
      providerId: "native-display-name",
      title: "Derived channel title",
    }));
  });

  it("cancels once with operationId mapped to runId and reports an aborted run truthfully", async () => {
    const rpc = createRpc({ ok: true, abortedRunId: "run-1", status: "aborted" });
    const signal = new AbortController().signal;

    const result = await createOpenClawSessionClient(rpc).cancelSession("session:1", { operationId: "run-1", signal });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("sessions.abort", { key: "session:1", runId: "run-1" }, { signal });
    expect(result).toMatchObject({
      id: "session:1",
      providerId: "session:1",
      state: "cancelled",
      metadata: { providerData: { found: true, cancelled: true, abortedRunId: "run-1" } },
    });
  });

  it("omits absent abort runId and reports no active run without claiming cancellation", async () => {
    const rpc = createRpc({ ok: true, abortedRunId: null, status: "no-active-run" });

    const result = await createOpenClawSessionClient(rpc).cancelSession("session:1");

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("sessions.abort", { key: "session:1" }, { signal: undefined });
    expect(result.state).toBe("unknown");
    expect(result.metadata.providerData).toEqual({ found: false, cancelled: false });
  });

  it("validates before mapping and sends no fallback or retry", async () => {
    const rpc = createRpc({ session: { key: "session:1", token: "secret" } });

    await expect(createOpenClawSessionClient(rpc).getSession("session:1")).rejects.toMatchObject({ code: ApiClientErrorCode.TransportProtocolError });
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("preserves canonical request error translation without retry", async () => {
    const rpc = createRpc(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce("gateway unavailable");

    await expect(createOpenClawSessionClient(rpc).cancelSession("session:1")).rejects.toBeInstanceOf(ApiClientError);
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("wires sessions into the internal factory without capability promotion", async () => {
    const rpc = createRpc({ session: { key: "session:1" } });
    const plane = await createOpenClawRuntimeControlClient({ rpc });

    await expect(plane.sessions.getSession("session:1")).resolves.toMatchObject({ id: "session:1" });
    expect(rpc.request).toHaveBeenCalledWith("sessions.describe", { key: "session:1" }, { signal: undefined });
  });
});
