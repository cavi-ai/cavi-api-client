import { describe, expect, it, vi } from "vitest";
import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { TransportMessageChannel } from "../../../../../core/transport/channel.js";

const webSocketConnect = vi.hoisted(() => vi.fn());
vi.mock("../../../../../core/transport/websocket.js", () => ({
  createWebSocketTransport: () => ({ connect: webSocketConnect }),
}));

import { createHermesRuntimeControlClient } from "../../../../../extensions/cavi/providers/hermes/runtime-control-client.js";

function channel(closed = false): TransportMessageChannel<unknown> & { close: ReturnType<typeof vi.fn> } {
  return {
    send: vi.fn(async () => {}),
    subscribe: vi.fn(() => () => {}),
    subscribeClose: vi.fn((listener: (error?: unknown) => void) => {
      if (closed) listener();
      return () => {};
    }),
    close: vi.fn(async () => {}),
  };
}

function caviOptions() {
  return { gatewayBaseUrl: "https://gateway.test", authToken: null, fallbackMode: "compat" as const };
}

const shape = ["authStatus", "dispose", "events", "models", "sessions", "tasks", "usage", "workspace"];

describe("createHermesRuntimeControlClient", () => {
  it("always returns the complete canonical shape", async () => {
    const unavailable = await createHermesRuntimeControlClient({ dashboardBaseUrl: "" });
    const partial = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test" });
    const configured = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: channel(),
    });
    expect(Object.keys(unavailable).sort()).toEqual(shape);
    expect(Object.keys(partial).sort()).toEqual(shape);
    expect(Object.keys(configured).sort()).toEqual(shape);
    await Promise.all([unavailable.dispose(), partial.dispose(), configured.dispose()]);
  });

  it("uses exact unavailable capability errors per operation", async () => {
    const client = await createHermesRuntimeControlClient({ dashboardBaseUrl: "" });
    const operations = [
      [() => client.authStatus.listAuthStatus(), "controlPlane.authStatus.list"],
      [() => client.sessions.listSessions(), "controlPlane.sessions.list"],
      [() => client.models.listModels(), "controlPlane.models.list"],
      [() => client.usage.getUsage(), "controlPlane.usage.get"],
      [() => client.tasks.listTasks(), "controlPlane.tasks.list"],
      [() => client.workspace.listWorkspaces(), "controlPlane.workspace.list"],
      [() => client.events.subscribe({ operationId: "op", onEvent() {} }), "controlPlane.events.subscribe"],
    ] as const;
    for (const [invoke, capability] of operations) {
      await expect(invoke()).rejects.toMatchObject({
        name: "CapabilityUnavailable", providerId: "hermes", capability,
      } satisfies Partial<CapabilityUnavailable>);
    }
  });

  it("keeps injected channels borrowed unless ownership is explicit and disposes idempotently", async () => {
    const borrowed = channel();
    const borrowedClient = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: borrowed });
    await borrowedClient.dispose();
    await borrowedClient.dispose();
    expect(borrowed.close).not.toHaveBeenCalled();

    const owned = channel();
    const ownedClient = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true });
    await ownedClient.dispose();
    await ownedClient.dispose();
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("handles an already-closed injected channel synchronously", async () => {
    const closed = channel(true);
    const client = await createHermesRuntimeControlClient({ dashboardBaseUrl: "https://dashboard.test", channel: closed, ownsChannel: true });
    await client.dispose();
    await client.dispose();
    expect(closed.close).toHaveBeenCalledTimes(1);
  });

  it("rejects pre-aborted construction without taking borrowed ownership", async () => {
    const borrowed = channel();
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: borrowed, ownsChannel: false, signal: controller.signal,
    })).rejects.toBe(controller.signal.reason);
    expect(borrowed.close).not.toHaveBeenCalled();
  });

  it("gives the dashboard token precedence over provider-neutral auth inputs", async () => {
    const headers: string[] = [];
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      headers.push(new Headers(init?.headers).get("authorization") ?? "");
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const resolveAuth = vi.fn(async () => ({ headers: { Authorization: "Bearer resolved" } }));
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      dashboardToken: "dashboard",
      token: "core",
      resolveAuth,
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(headers).toEqual(["Bearer dashboard"]);
    expect(resolveAuth).not.toHaveBeenCalled();
    await client.dispose();
  });

  it("uses resolved auth ahead of the provider-neutral token when no dashboard token exists", async () => {
    let authorization = "";
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      authorization = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      token: "core",
      resolveAuth: async () => ({ headers: { Authorization: "Bearer resolved" } }),
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(authorization).toBe("Bearer resolved");
    await client.dispose();
  });

  it.each([
    ["empty", {}],
    ["unrelated", { "X-Request-Context": "runtime" }],
  ] as const)("uses the generic token when resolved %s headers contain no authentication", async (_label, resolvedHeaders) => {
    let headers = new Headers();
    const fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ providers: [] }), {
        status: 200, headers: { "content-type": "application/json" },
      });
    });
    const client = await createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      token: "core",
      resolveAuth: async () => ({ headers: resolvedHeaders }),
      fetch,
    });
    await client.authStatus.listAuthStatus();
    expect(headers.get("authorization")).toBe("Bearer core");
    if ("X-Request-Context" in resolvedHeaders) expect(headers.get("x-request-context")).toBe("runtime");
    await client.dispose();
  });

  it("installs CAVI modules without dashboard REST configuration", async () => {
    const client = await createHermesRuntimeControlClient({ cavi: caviOptions() });
    await expect(client.tasks.listTasks({ cursor: "unsupported" })).rejects.toMatchObject({
      name: "CapabilityUnavailable",
      capability: "controlPlane.tasks.cursor",
    });
    await expect(client.workspace.listWorkspaces()).rejects.toThrow(
      /^Hermes CAVI workspace response failed schema validation$/u,
    );
    const dashboardOperations = [
      [() => client.authStatus.listAuthStatus(), "controlPlane.authStatus.list"],
      [() => client.sessions.listSessions(), "controlPlane.sessions.list"],
      [() => client.models.listModels(), "controlPlane.models.list"],
      [() => client.usage.getUsage(), "controlPlane.usage.get"],
      [() => client.events.subscribe({ operationId: "op", onEvent() {} }), "controlPlane.events.subscribe"],
    ] as const;
    for (const [invoke, capability] of dashboardOperations) {
      await expect(invoke()).rejects.toMatchObject({
        name: "CapabilityUnavailable", providerId: "hermes", capability,
      });
    }
    await client.dispose();
  });

  it("closes an owned injected channel if RPC construction fails synchronously", async () => {
    const owned = channel();
    owned.subscribeClose = vi.fn(() => {
      throw new Error("subscribe failed");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true,
    })).rejects.toThrow("subscribe failed");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("does not close a borrowed injected channel if RPC construction fails synchronously", async () => {
    const borrowed = channel();
    borrowed.subscribeClose = vi.fn(() => {
      throw new Error("subscribe failed");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: borrowed,
    })).rejects.toThrow("subscribe failed");
    expect(borrowed.close).not.toHaveBeenCalled();
  });

  it("unwinds an owned injected channel when abort is observed after auth", async () => {
    const owned = channel();
    const controller = new AbortController();
    const reason = new Error("post-auth abort");
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      channel: owned,
      ownsChannel: true,
      signal: controller.signal,
      resolveAuth: async () => {
        controller.abort(reason);
        return { headers: {} };
      },
    })).rejects.toBe(reason);
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("registers and closes an internally created channel before readiness", async () => {
    const internal = Object.assign(channel(), { ready: Promise.reject(new Error("not ready")) });
    webSocketConnect.mockReturnValueOnce(internal);
    await expect(createHermesRuntimeControlClient({
      dashboardWebSocketUrl: "  wss://dashboard.test/rpc?opaque=a%2Fb  ",
    })).rejects.toThrow("not ready");
    expect(webSocketConnect).toHaveBeenCalledWith(expect.objectContaining({
      url: "wss://dashboard.test/rpc?opaque=a%2Fb",
    }));
    expect(internal.close).toHaveBeenCalledTimes(1);
  });

  it("unwinds RPC ownership when abort is observed after module construction", async () => {
    const controller = new AbortController();
    const reason = new Error("post-module abort");
    const owned = channel();
    owned.subscribeClose = vi.fn((listener: (error?: unknown) => void) => {
      controller.abort(reason);
      return () => { void listener; };
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test",
      channel: owned,
      ownsChannel: true,
      signal: controller.signal,
    })).rejects.toBe(reason);
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("does not replace a primary construction error with an owned-channel cleanup failure", async () => {
    const owned = channel();
    owned.close.mockRejectedValueOnce(new Error("secret cleanup detail"));
    owned.subscribeClose = vi.fn(() => {
      throw new Error("primary construction failure");
    });
    await expect(createHermesRuntimeControlClient({
      dashboardBaseUrl: "https://dashboard.test", channel: owned, ownsChannel: true,
    })).rejects.toThrow("primary construction failure");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });

  it("bounds owned-channel cleanup failures during later disposal", async () => {
    const owned = channel();
    owned.close.mockRejectedValueOnce(new Error("secret cleanup detail"));
    const client = await createHermesRuntimeControlClient({ channel: owned, ownsChannel: true });
    await expect(client.dispose()).rejects.toThrow(/^Hermes runtime control cleanup failed$/u);
    await expect(client.dispose()).rejects.not.toThrow("secret cleanup detail");
    expect(owned.close).toHaveBeenCalledTimes(1);
  });
});
