import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GatewayRpcClient } from "../../../core/gateway/rpc/client";

const HELLO = {
  type: "hello-ok",
  protocol: 4,
  server: { version: "test", connId: "conn-1" },
  features: { methods: ["chat.send", "sessions.list"], events: ["connect.challenge"] },
  auth: { role: "operator", scopes: ["operator.read"] },
};

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;

  constructor(readonly url: string) {
    super();
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  send(data: string): void {
    const frame = JSON.parse(String(data)) as { id: string; method: string };
    queueMicrotask(() => {
      const event = new Event("message") as Event & { data: string };
      Object.defineProperty(event, "data", {
        value: JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload: frame.method === "connect" ? HELLO : {},
        }),
      });
      this.dispatchEvent(event);
    });
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

describe("gateway rpc client hello retention", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retains the handshake payload after a successful connect", async () => {
    const client = new GatewayRpcClient("ws://test", null, {
      clientId: "test-client",
      enableDeviceIdentity: false,
    });
    expect(client.getHelloFrame()).toBeNull();
    await client.connect();
    expect(client.getHelloFrame()).toEqual(HELLO);
    await client.close();
  });
});
