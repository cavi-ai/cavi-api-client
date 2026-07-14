import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc";

const { clients, MockOpenClawWebSocketClient } = vi.hoisted(() => {
  class MockClient {
    readonly connect = vi.fn(async () => undefined);
    readonly request = vi.fn(async () => undefined);
    readonly subscribe = vi.fn(() => () => undefined);
    readonly dispose = vi.fn(async () => undefined);

    constructor(
      readonly webSocketUrl: string,
      readonly token: string | null,
    ) {
      clients.push(this);
    }
  }

  const clients: MockClient[] = [];
  return { clients, MockOpenClawWebSocketClient: MockClient };
});

vi.mock("../../../../providers/openclaw/websocket", () => ({
  OpenClawWebSocketClient: MockOpenClawWebSocketClient,
}));

import { createOpenClawControlPlane } from "../../../../providers/openclaw/control-plane/factory";

function createRpc(): OpenClawRpc {
  return {
    request: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw control-plane RPC lifecycle", () => {
  beforeEach(() => {
    clients.length = 0;
  });

  it("aborting one request preserves the shared connection and subscription", async () => {
    const actual = await vi.importActual<
      typeof import("../../../../providers/openclaw/websocket")
    >("../../../../providers/openclaw/websocket");
    const originalWebSocket = globalThis.WebSocket;

    class PendingWebSocket extends EventTarget {
      static readonly OPEN = 1;
      static instance: PendingWebSocket | undefined;
      readyState = PendingWebSocket.OPEN;
      close = vi.fn();

      constructor() {
        super();
        PendingWebSocket.instance = this;
        queueMicrotask(() => this.dispatchEvent(new Event("open")));
      }

      send(data: string): void {
        const frame = JSON.parse(data) as { id: string; method: string };
        if (frame.method !== "connect") return;
        queueMicrotask(() => this.message({
          type: "res",
          id: frame.id,
          ok: true,
          payload: { type: "hello-ok", protocol: 4 },
        }));
      }

      message(frame: unknown): void {
        const event = new Event("message") as Event & { data: string };
        Object.defineProperty(event, "data", { value: JSON.stringify(frame) });
        this.dispatchEvent(event);
      }
    }

    globalThis.WebSocket = PendingWebSocket as unknown as typeof WebSocket;
    try {
      const rpc = new actual.OpenClawWebSocketClient(
        "wss://openclaw.example/ws",
        "token",
        { clientId: "lifecycle", enableDeviceIdentity: false },
      );
      await rpc.connect();
      const listener = vi.fn();
      const unsubscribe = rpc.subscribe(listener);
      const controller = new AbortController();
      const request = rpc.request("sessions.list", {}, {
        signal: controller.signal,
      });

      controller.abort();
      await expect(request).rejects.toMatchObject({ name: "AbortError" });
      PendingWebSocket.instance?.message({
        type: "event",
        event: "session.updated",
        payload: { id: "unrelated" },
      });

      expect(PendingWebSocket.instance?.close).not.toHaveBeenCalled();
      expect(listener).toHaveBeenCalledWith({
        event: "session.updated",
        payload: { id: "unrelated" },
      });

      unsubscribe();
      await rpc.dispose();
      expect(PendingWebSocket.instance?.close).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("leaves an injected RPC seam caller-owned by default", async () => {
    const rpc = createRpc();
    const plane = await createOpenClawControlPlane({ rpc });

    expect(rpc.request).not.toHaveBeenCalled();
    await plane.dispose();
    await plane.dispose();

    expect(rpc.dispose).not.toHaveBeenCalled();
  });

  it("creates one authenticated client and disposes the owned connection once", async () => {
    const plane = await createOpenClawControlPlane({
      webSocketUrl: "wss://openclaw.example/ws",
      token: "token",
    });

    expect(clients).toHaveLength(1);
    expect(clients[0]?.connect).toHaveBeenCalledTimes(1);

    await Promise.all([plane.dispose(), plane.dispose()]);

    expect(clients[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes an injected RPC once when ownership is explicit", async () => {
    const rpc = createRpc();
    const plane = await createOpenClawControlPlane({
      rpc,
      takeRpcOwnership: true,
    });

    await Promise.all([plane.dispose(), plane.dispose()]);

    expect(rpc.dispose).toHaveBeenCalledTimes(1);
  });
});
