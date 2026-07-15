import { describe, expect, it, vi } from "vitest";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory";
import { GATEWAY_RAW_EXTENSION } from "../../../../core/runtime/control-plane/raw-gateway.js";

class HandshakeWebSocket extends EventTarget {
  static readonly OPEN = 1;
  static instances: HandshakeWebSocket[] = [];

  readonly readyState = HandshakeWebSocket.OPEN;
  readonly sent: string[] = [];
  challengeEmitted = false;

  constructor(readonly url: string) {
    super();
    HandshakeWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.dispatchEvent(new Event("open"));
      this.challengeEmitted = true;
      this.message({
        type: "event",
        event: "connect.challenge",
        payload: { nonce: "factory-profile-nonce" },
      });
    });
  }

  send(data: string): void {
    this.sent.push(String(data));
    const frame = JSON.parse(String(data)) as { id: string; method: string };
    queueMicrotask(() => this.message({
      type: "res",
      id: frame.id,
      ok: true,
      payload: { type: "hello-ok", protocol: 4 },
    }));
  }

  close(): void {
    this.dispatchEvent(new Event("close"));
  }

  private message(frame: unknown): void {
    const event = new Event("message") as Event & { data: string };
    Object.defineProperty(event, "data", { value: JSON.stringify(frame) });
    this.dispatchEvent(event);
  }
}

describe("OpenClaw control-plane factory client profile", () => {
  it("rejects an invalid reconnect policy before opening a socket", async () => {
    const originalWebSocket = globalThis.WebSocket;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    try {
      await expect(createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        gatewayReconnect: { maxAttempts: 0, baseDelayMs: 10, maxDelayMs: 20 },
      })).rejects.toThrow("maxAttempts must be a positive integer");
      expect(HandshakeWebSocket.instances).toHaveLength(0);
    } finally { globalThis.WebSocket = originalWebSocket; }
  });
  it("forwards provider-neutral gateway connection settings to the owned client", async () => {
    const originalWebSocket = globalThis.WebSocket;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    const deviceIdentityLoader = vi.fn(async () => null);
    const onRpcTrace = vi.fn();
    try {
      const plane = await createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        gatewayConnection: {
          clientId: "mobile-client",
          clientVersion: "2.3.4",
          clientPlatform: "react-native",
          clientMode: "mobile",
          connectFrameId: "monotonic",
          minProtocol: 3,
          maxProtocol: 5,
          enableDeviceIdentity: true,
          deviceIdentityLoader,
          requestedScopes: ["operator.read", "operator.write"],
          preauthHandshakeTimeoutMs: 4_321,
          requestTimeoutMs: 8_765,
          maxConcurrentRequests: 7,
          onRpcTrace,
        },
      });
      const frame = JSON.parse(HandshakeWebSocket.instances[0].sent[0]) as {
        id: string;
        params: { minProtocol: number; maxProtocol: number; scopes: string[]; client: Record<string, string> };
      };
      expect(frame.id).not.toBe("mobile-client");
      expect(frame.params).toMatchObject({
        minProtocol: 3,
        maxProtocol: 5,
        scopes: ["operator.read", "operator.write"],
        client: { id: "mobile-client", version: "2.3.4", platform: "react-native", mode: "mobile" },
      });
      expect(deviceIdentityLoader).toHaveBeenCalledTimes(1);
      await plane.extensions.get(GATEWAY_RAW_EXTENSION)!.request("sessions.list");
      expect(onRpcTrace).toHaveBeenCalledWith(expect.objectContaining({
        method: "sessions.list",
        params: {},
        ok: true,
      }));
      await plane.dispose();
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });

  it("connects the owned real client with stable profile and auth/device defaults", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalIndexedDb = globalThis.indexedDB;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    Object.defineProperty(globalThis, "indexedDB", {
      configurable: true,
      value: { open: vi.fn(() => { throw new Error("test store unavailable"); }) },
    });

    try {
      const plane = await createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        token: "factory-token",
      });
      const socket = HandshakeWebSocket.instances[0];
      const connectFrame = JSON.parse(socket.sent[0]) as {
        id: string;
        method: string;
        params: {
          auth: { token: string; password: string };
          client: { id: string; version: string; platform: string; mode: string };
        };
      };

      expect(socket.challengeEmitted).toBe(true);
      expect(connectFrame.method).toBe("connect");
      expect(connectFrame.id).toBe(connectFrame.params.client.id);
      expect(connectFrame.params.client).toEqual({
        id: "openclaw-control-ui",
        version: "0.1.0",
        platform: "web",
        mode: "webchat",
      });
      expect(connectFrame.params.auth).toEqual({
        token: "factory-token",
        password: "factory-token",
      });

      await plane.dispose();
    } finally {
      globalThis.WebSocket = originalWebSocket;
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: originalIndexedDb,
      });
    }
  });

  it("resolves fresh auth before connecting and lets resolver authorization override the static token", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalIndexedDb = globalThis.indexedDB;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    const resolveAuth = vi.fn(async () => ({ headers: { Authorization: "Bearer fresh-token" } }));
    try {
      const plane = await createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        token: "stale-token",
        resolveAuth,
      });
      const frame = JSON.parse(HandshakeWebSocket.instances[0].sent[0]) as { params: { auth: { token: string } } };
      expect(resolveAuth).toHaveBeenCalledTimes(1);
      expect(frame.params.auth.token).toBe("fresh-token");
      await plane.dispose();
    } finally {
      globalThis.WebSocket = originalWebSocket;
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: originalIndexedDb });
    }
  });

  it.each([
    [{ authorization: "Bearer fresh-lower" }, "fresh-lower"],
    [{ aUtHoRiZaTiOn: "Bearer fresh-mixed" }, "fresh-mixed"],
    [{ authorization: "Bearer fresh-first", AUTHORIZATION: "Bearer fresh-last" }, "fresh-last"],
  ])("uses the resolver bearer token case-insensitively without semantic duplicates", async (headers, expected) => {
    const originalWebSocket = globalThis.WebSocket;
    const originalIndexedDb = globalThis.indexedDB;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      const plane = await createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        token: "stale-token",
        resolveAuth: async () => ({ headers }),
      });
      const frame = JSON.parse(HandshakeWebSocket.instances[0].sent[0]) as { params: { auth: { token: string } } };
      expect(frame.params.auth.token).toBe(expected);
      await plane.dispose();
    } finally {
      globalThis.WebSocket = originalWebSocket;
      Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: originalIndexedDb });
    }
  });

  it("does not open a socket when auth resolution fails", async () => {
    const originalWebSocket = globalThis.WebSocket;
    HandshakeWebSocket.instances = [];
    globalThis.WebSocket = HandshakeWebSocket as unknown as typeof WebSocket;
    try {
      await expect(createOpenClawRuntimeControlClient({
        webSocketUrl: "wss://openclaw.example/ws",
        resolveAuth: async () => { throw new Error("auth store unavailable"); },
      })).rejects.toMatchObject({
        name: "TransportError",
        transport: { kind: "websocket", phase: "authenticate", operation: "openclaw.connect", retryable: false },
      });
      expect(HandshakeWebSocket.instances).toHaveLength(0);
    } finally {
      globalThis.WebSocket = originalWebSocket;
    }
  });
});
