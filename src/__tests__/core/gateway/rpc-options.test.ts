import { describe, expect, it } from "vitest";
import {
  GatewayRpcClient,
  resolveDeviceTokenOnlyFallbackMs,
  resolveGatewayConnectScopes,
  resolvePreauthHandshakeTimeoutMs,
} from "../../../core/gateway/rpc/client";

class MockWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  // When set, the socket emits a single `connect.challenge` event on open
  // (the device-identity preauth path) before the connect frame is answered.
  static challengeNonce: string | null = null;

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];

  constructor(readonly url: string) {
    super();
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
      if (MockWebSocket.challengeNonce !== null) {
        const event = new Event("message") as Event & { data: string };
        Object.defineProperty(event, "data", {
          value: JSON.stringify({
            type: "event",
            event: "connect.challenge",
            payload: { nonce: MockWebSocket.challengeNonce },
          }),
        });
        this.dispatchEvent(event);
      }
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
                  auth: {
                    role: "operator",
                    scopes: ["operator.read"],
                  },
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

describe("GatewayRpcClient override options", () => {
  it("lets callers override the default connect scopes", () => {
    expect(
      resolveGatewayConnectScopes({
        defaultRequestedScopes: ["operator.admin", "device.pair"],
      }),
    ).toEqual(["operator.admin", "device.pair"]);

    expect(
      resolveGatewayConnectScopes({
        requestedScopes: ["", "  "],
        defaultRequestedScopes: [" operator.admin ", "operator.admin"],
      }),
    ).toEqual(["operator.admin"]);

    expect(
      resolveGatewayConnectScopes({
        requestedScopes: [],
        defaultRequestedScopes: ["", "  "],
      }),
    ).toEqual(["operator.read"]);
  });

  it("resolves pre-auth timing from provider-specific env keys", () => {
    const env = {
      PROVIDER_HANDSHAKE_TIMEOUT_MS: "6000",
      PROVIDER_TEST_HANDSHAKE_TIMEOUT_MS: "2500",
      PROVIDER_TEST: "1",
    };
    const envKeys = {
      timeoutMs: "PROVIDER_HANDSHAKE_TIMEOUT_MS",
      testTimeoutMs: "PROVIDER_TEST_HANDSHAKE_TIMEOUT_MS",
      testFlag: "PROVIDER_TEST",
    };

    expect(resolvePreauthHandshakeTimeoutMs({ env, envKeys })).toBe(6000);
    expect(
      resolvePreauthHandshakeTimeoutMs({
        env,
        envKeys,
        preauthHandshakeTimeoutMs: 7000,
      }),
    ).toBe(7000);
    expect(resolveDeviceTokenOnlyFallbackMs({ env, envKeys })).toBe(4000);
  });

  it("defaults the connect frame id to a monotonic correlation id", async () => {
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    MockWebSocket.challengeNonce = null;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    try {
      const client = new GatewayRpcClient("wss://gateway.example/ws", "token", {
        clientId: "control-ios",
        clientMode: "ui",
        clientPlatform: "react-native",
        enableDeviceIdentity: false,
      });

      await client.connect();
      const ws = MockWebSocket.instances[0];
      const connectFrame = JSON.parse(ws.sent[0]) as {
        id: string;
        method: string;
      };
      expect(connectFrame.method).toBe("connect");
      expect(connectFrame.id).toMatch(/^mc-\d+-\d+$/u);
      expect(connectFrame.id).not.toBe("control-ios");

      await client.close();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("reuses the advertised client id for connect when connectFrameId is 'client-id'", async () => {
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    MockWebSocket.challengeNonce = null;
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    try {
      const client = new GatewayRpcClient("wss://gateway.example/ws", "token", {
        clientId: "control-ios",
        clientMode: "ui",
        clientPlatform: "react-native",
        enableDeviceIdentity: false,
        connectFrameId: "client-id",
      });

      await client.connect();
      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();

      const connectFrame = JSON.parse(ws.sent[0]) as {
        id: string;
        method: string;
        params: { client: { id: string } };
      };
      expect(connectFrame.method).toBe("connect");
      expect(connectFrame.id).toBe("control-ios");
      expect(connectFrame.params.client.id).toBe("control-ios");

      // Regular RPCs keep monotonic ids even under the client-id connect strategy.
      await client.request("sessions.list", {});
      const rpcFrame = JSON.parse(ws.sent[1]) as { id: string; method: string };
      expect(rpcFrame.method).toBe("sessions.list");
      expect(rpcFrame.id).toMatch(/^mc-\d+-\d+$/u);
      expect(rpcFrame.id).not.toBe("control-ios");

      await client.close();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("sends exactly one clean connect under the device-challenge path with a fixed client-id frame", async () => {
    // Guards the reused (fixed) connect frame id against aliasing: the
    // challenge path and the token-only fallback timer are mutually exclusive,
    // so only one connect frame is ever in flight and `pending` is never
    // corrupted by a stale duplicate id.
    const originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    MockWebSocket.challengeNonce = "nonce-xyz";
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;

    try {
      const client = new GatewayRpcClient("wss://gateway.example/ws", "token", {
        clientId: "control-ios",
        clientMode: "ui",
        clientPlatform: "react-native",
        connectFrameId: "client-id",
        // A loader that returns null forces the device-challenge-first path
        // (positive token-only fallback) without needing real crypto.
        deviceIdentityLoader: async () => null,
        preauthHandshakeTimeoutMs: 8000,
      });

      await client.connect();
      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();

      const connectFrames = ws.sent
        .map((raw) => JSON.parse(raw) as { id: string; method: string })
        .filter((frame) => frame.method === "connect");
      // Exactly one connect frame — the fallback timer must not have fired a duplicate.
      expect(connectFrames).toHaveLength(1);
      expect(connectFrames[0].id).toBe("control-ios");

      // A follow-up RPC resolves cleanly, proving the connect handshake left no
      // leaked or wrong-rejected pending entry behind.
      const result = await client.request("sessions.list", {});
      expect(result).toEqual({});

      await client.close();
    } finally {
      MockWebSocket.challengeNonce = null;
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
