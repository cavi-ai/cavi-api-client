import { describe, expect, it, vi } from "vitest";
import { CapabilityUnavailable } from "../../../../../core/runtime/control-plane/runtime-control-client.js";
import type { TransportMessageChannel } from "../../../../../core/transport/channel.js";
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
});
