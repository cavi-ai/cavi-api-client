import { describe, expect, it, vi } from "vitest";
import { createHermesApiServerControlPlane } from "../../../../providers/hermes/control-plane/api-server-rest.js";
import { createHermesDashboardRestClient } from "../../../../providers/hermes/control-plane/dashboard-rest.js";
import { createHermesSessionOperations } from "../../../../providers/hermes/control-plane/session-operations.js";
import type { HermesDashboardJsonRpcClient } from "../../../../providers/hermes/control-plane/types.js";
import { hermesDashboardSocketUrl } from "../../../../providers/hermes/control-plane/dashboard-paths.js";

const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });

describe("Hermes multiplex control", () => {
  it("encodes dashboard credentials without replacing preauthenticated URLs", () => {
    expect(hermesDashboardSocketUrl("wss://dashboard.test/api/ws", "a/+? secret")).toBe("wss://dashboard.test/api/ws?token=a%2F%2B%3F+secret");
    for (const credential of ["token", "ticket", "internal"]) {
      const url = `wss://dashboard.test/api/ws?${credential}=existing`;
      expect(hermesDashboardSocketUrl(url, "other")).toBe(url);
    }
    expect(hermesDashboardSocketUrl("wss://dashboard.test/api/ws")).toBe("wss://dashboard.test/api/ws");
  });
  it("uses advertised native sessions, paginates and avoids an absent usage route", async () => {
    const urls: string[] = [];
    const client = createHermesApiServerControlPlane({ baseUrl: "https://hermes.test/p/worker", token: "worker-key", fetchImpl: async (input, init) => {
      const url = new URL(String(input)); urls.push(url.pathname + url.search);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer worker-key");
      if (url.pathname.endsWith("capabilities")) return json({ object: "hermes.api_server.capabilities", platform: "hermes-agent", endpoints: { sessions: { method: "GET", path: "/api/sessions" } } });
      expect(url.pathname).toBe("/p/worker/api/sessions");
      return json({ object: "list", data: [{ id: "session-" + url.searchParams.get("offset"), started_at: 10 }], limit: 100, offset: Number(url.searchParams.get("offset")), has_more: url.searchParams.get("offset") === "0" });
    } });
    await client.probe();
    const first = await client.sessions.listSessions({ limit: 100 });
    expect(first.data[0]?.id).toBe("session-0");
    expect(first.nextCursor).toBeDefined();
    const second = await client.sessions.listSessions({ limit: 100, cursor: first.nextCursor });
    expect(second.data[0]?.id).toBe("session-100");
    expect(second.nextCursor).toBeUndefined();
    await expect(client.usage.getUsage()).rejects.toMatchObject({ capability: "controlPlane.usage.get" });
    expect(urls).toEqual(["/p/worker/v1/capabilities", "/p/worker/api/sessions?limit=100&offset=0", "/p/worker/api/sessions?limit=100&offset=100"]);
  });

  it("scopes dashboard REST and equivalent RPC fallbacks to one profile", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      expect(String(input)).toBe("https://dashboard.test/api/sessions?profile=worker");
      return json({ sessions: [], total: 0, limit: 20, offset: 0 });
    });
    const rest = createHermesDashboardRestClient({ baseUrl: "https://dashboard.test", authToken: "dashboard-only", profile: "worker", fetchImpl });
    await rest.listSessions();
    const request = vi.fn(async () => ({ sessions: [], total: 0 })) as HermesDashboardJsonRpcClient["request"];
    const rpc = { request, subscribe: () => () => {}, dispose: async () => {} };
    await createHermesSessionOperations({ rest, rpc, profile: "worker" }).list({ limit: 20 });
    expect(request).toHaveBeenCalledWith("session.list", { limit: 20, profile: "worker" }, undefined);
  });
});
