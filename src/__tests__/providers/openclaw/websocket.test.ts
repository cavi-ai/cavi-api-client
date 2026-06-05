import { describe, expect, it } from "vitest";
import { OpenClawWebSocketClient } from "../../../providers/openclaw/websocket";

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  send(data: string): void {
    this.sent.push(String(data));
    const frame = JSON.parse(String(data)) as { id: string; method: string };
    queueMicrotask(() => {
      const event = new Event("message") as Event & { data: string };
      Object.defineProperty(event, "data", {
        value: JSON.stringify({
          type: "res",
          id: frame.id,
          ok: true,
          payload:
            frame.method === "connect"
              ? {
                  type: "hello-ok",
                  protocol: 4,
                  auth: { role: "operator", scopes: ["operator.read"] },
                }
              : {},
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

describe("OpenClawWebSocketClient defaults", () => {
  it("correlates the connect handshake on the advertised client id", async () => {
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    try {
      // No connectFrameId passed — the provider default must opt the handshake
      // into the client-id strategy that the OpenClaw gateway requires.
      const client = new OpenClawWebSocketClient(
        "wss://openclaw.example/ws",
        "token",
        {
          clientId: "openclaw-control",
          clientMode: "ui",
          clientPlatform: "react-native",
          enableDeviceIdentity: false,
        },
      );

      await client.connect();
      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();

      const connectFrame = JSON.parse(ws.sent[0]) as {
        id: string;
        method: string;
      };
      expect(connectFrame.method).toBe("connect");
      expect(connectFrame.id).toBe("openclaw-control");

      await client.close();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("lets callers override the connect frame id strategy", async () => {
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    try {
      const client = new OpenClawWebSocketClient(
        "wss://openclaw.example/ws",
        "token",
        {
          clientId: "openclaw-control",
          clientMode: "ui",
          clientPlatform: "react-native",
          enableDeviceIdentity: false,
          connectFrameId: "monotonic",
        },
      );

      await client.connect();
      const ws = MockWebSocket.instances[0];
      const connectFrame = JSON.parse(ws.sent[0]) as {
        id: string;
        method: string;
      };
      expect(connectFrame.method).toBe("connect");
      expect(connectFrame.id).toMatch(/^mc-\d+-\d+$/u);
      expect(connectFrame.id).not.toBe("openclaw-control");

      await client.close();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
