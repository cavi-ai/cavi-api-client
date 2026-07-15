import { describe, expect, it } from "vitest";
import { OpenClawWebSocketClient } from "../../../providers/openclaw/websocket";
import { getTransportErrorMetadata } from "../../../core/transport/error.js";

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];
  static connectError: { code: string; message: string } | undefined;

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
        value: JSON.stringify(frame.method === "connect" && MockWebSocket.connectError
          ? { type: "res", id: frame.id, ok: false, error: MockWebSocket.connectError }
          : {
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
  it.each(["auth_required", "protocol_mismatch"])(
    "marks %s handshake errors non-retryable in connection state",
    async (code) => {
      const originalWebSocket = globalThis.WebSocket;
      MockWebSocket.instances = [];
      MockWebSocket.connectError = { code, message: "connect rejected" };
      globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
      try {
        const client = new OpenClawWebSocketClient("wss://openclaw.example/ws", "token", {
          clientId: "metadata-test", enableDeviceIdentity: false,
        });
        let observed: Error | null = null;
        client.onStateChange((state, error) => { if (state === "error") observed = error; });

        await expect(client.connect()).rejects.toMatchObject({ code });
        expect(getTransportErrorMetadata(observed)).toMatchObject({ retryable: false });
        await client.close();
      } finally {
        MockWebSocket.connectError = undefined;
        globalThis.WebSocket = originalWebSocket;
      }
    },
  );
  it("preserves retryable socket-close metadata in connection state", async () => {
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    try {
      const client = new OpenClawWebSocketClient("wss://openclaw.example/ws", "token", {
        clientId: "metadata-test", enableDeviceIdentity: false,
      });
      let observed: Error | null = null;
      client.onStateChange((state, error) => { if (state === "error") observed = error; });
      await client.connect();
      const socket = MockWebSocket.instances[0];
      socket.readyState = MockWebSocket.CLOSED;
      const close = new Event("close") as Event & { code: number; wasClean: boolean };
      Object.defineProperties(close, { code: { value: 1006 }, wasClean: { value: false } });
      socket.dispatchEvent(close);
      await Promise.resolve();

      expect(getTransportErrorMetadata(observed)).toMatchObject({
        kind: "websocket", phase: "close", operation: "connect", retryable: true,
      });
      await client.close();
    } finally { globalThis.WebSocket = originalWebSocket; }
  });
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
