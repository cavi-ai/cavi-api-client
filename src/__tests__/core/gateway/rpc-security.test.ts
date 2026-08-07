import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode } from "../../../core/errors.js";
import {
  GatewayRpcClient,
  type GatewayRpcTraceEntry,
} from "../../../core/gateway/rpc/client.js";

class SecurityTestWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: SecurityTestWebSocket[] = [];

  readyState = SecurityTestWebSocket.CONNECTING;
  readonly sent: string[] = [];
  deferCloseEvent = false;
  private deferredCloseEvent: Event | null = null;
  readonly close = vi.fn((code?: number, reason?: string) => {
    this.readyState = SecurityTestWebSocket.CLOSING;
    const event = new Event("close") as Event & {
      code: number;
      reason: string;
      wasClean: boolean;
    };
    Object.defineProperties(event, {
      code: { value: code ?? 1000 },
      reason: { value: reason ?? "" },
      wasClean: { value: code === undefined || code === 1000 },
    });
    if (this.deferCloseEvent) {
      this.deferredCloseEvent = event;
      return;
    }
    this.dispatchClose(event);
  });

  constructor(readonly url: string) {
    super();
    SecurityTestWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = SecurityTestWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    });
  }

  send(data: string): void {
    this.sent.push(String(data));
    const frame = JSON.parse(String(data)) as { id: string; method: string };
    if (frame.method === "connect") {
      queueMicrotask(() => this.respond(frame.id, {
        type: "hello-ok",
        protocol: 4,
        auth: { role: "operator", scopes: ["operator.read"] },
      }));
    }
  }

  respond(id: string, payload: unknown): void {
    this.dispatchRaw(JSON.stringify({ type: "res", id, ok: true, payload }));
  }

  respondError(id: string, error: { code: string; message: string }): void {
    this.dispatchRaw(JSON.stringify({ type: "res", id, ok: false, error }));
  }

  dispatchRaw(data: string): void {
    const event = new Event("message") as Event & { data: string };
    Object.defineProperty(event, "data", { value: data });
    this.dispatchEvent(event);
  }

  releaseCloseEvent(): void {
    const event = this.deferredCloseEvent;
    if (!event) {
      return;
    }
    this.deferredCloseEvent = null;
    this.dispatchClose(event);
  }

  private dispatchClose(event: Event): void {
    this.readyState = SecurityTestWebSocket.CLOSED;
    this.dispatchEvent(event);
  }
}

describe("GatewayRpcClient security boundaries", () => {
  beforeEach(() => {
    SecurityTestWebSocket.instances = [];
    vi.stubGlobal("WebSocket", SecurityTestWebSocket);
  });

  afterEach(() => {
    for (const socket of SecurityTestWebSocket.instances) {
      socket.releaseCloseEvent();
    }
    vi.unstubAllGlobals();
  });

  it("closes before parsing an oversized inbound RPC frame", async () => {
    const client = new GatewayRpcClient("wss://gateway.test/rpc", null, {
      clientId: "security-test",
      enableDeviceIdentity: false,
      maxFrameBytes: 256,
    });
    await client.connect();
    const socket = SecurityTestWebSocket.instances[0]!;
    const request = client.request("sessions.list", {});
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    const frame = JSON.parse(socket.sent[1]!) as { id: string };
    const utf8Encode = vi.spyOn(TextEncoder.prototype, "encode");
    utf8Encode.mockClear();

    socket.respond(frame.id, { padding: "x".repeat(512) });

    await expect(request).rejects.toMatchObject({
      code: ApiClientErrorCode.SocketClosed,
    });
    expect(socket.close).toHaveBeenCalledWith(1009, "Message too large");
    expect(utf8Encode).not.toHaveBeenCalled();
    utf8Encode.mockRestore();
  });

  it("retires an oversized-frame socket before delayed callbacks can affect its replacement", async () => {
    const client = new GatewayRpcClient("wss://gateway.test/rpc", null, {
      clientId: "security-test",
      enableDeviceIdentity: false,
      maxFrameBytes: 256,
    });
    await client.connect();
    const staleSocket = SecurityTestWebSocket.instances[0]!;
    staleSocket.deferCloseEvent = true;
    const staleRequest = client.request("sessions.list", {});
    let staleRequestError: unknown;
    void staleRequest.catch((error: unknown) => {
      staleRequestError = error;
    });
    await vi.waitFor(() => expect(staleSocket.sent).toHaveLength(2));

    staleSocket.dispatchRaw(JSON.stringify({ padding: "x".repeat(512) }));

    await vi.waitFor(() =>
      expect(staleRequestError).toMatchObject({
        code: ApiClientErrorCode.SocketClosed,
      }),
    );
    expect(staleSocket.close).toHaveBeenCalledWith(1009, "Message too large");

    const receivedEvent = vi.fn();
    client.onEvent(receivedEvent);
    const replacementRequest = client.request<{ generation: string }>(
      "sessions.list",
      {},
    );
    let replacementSettled = false;
    void replacementRequest.then(
      () => {
        replacementSettled = true;
      },
      () => {
        replacementSettled = true;
      },
    );
    await vi.waitFor(() => expect(SecurityTestWebSocket.instances).toHaveLength(2));
    const replacementSocket = SecurityTestWebSocket.instances[1]!;
    await vi.waitFor(() => expect(replacementSocket.sent).toHaveLength(2));
    const replacementFrame = JSON.parse(replacementSocket.sent[1]!) as {
      id: string;
    };

    staleSocket.dispatchRaw(JSON.stringify({
      type: "event",
      event: "stale.event",
      payload: { generation: "stale" },
    }));
    staleSocket.dispatchEvent(new Event("error"));
    staleSocket.releaseCloseEvent();
    await Promise.resolve();

    expect(receivedEvent).not.toHaveBeenCalled();
    expect(client.getConnectionState()).toBe("connected");
    expect(replacementSettled).toBe(false);

    replacementSocket.respond(replacementFrame.id, { generation: "replacement" });
    await expect(replacementRequest).resolves.toEqual({ generation: "replacement" });
    await client.close();
  });

  it("skips trace-only serialization when no RPC trace hook is configured", async () => {
    const client = new GatewayRpcClient("wss://gateway.test/rpc", null, {
      clientId: "security-test",
      enableDeviceIdentity: false,
    });
    await client.connect();
    const socket = SecurityTestWebSocket.instances[0]!;
    const paramsToJson = vi.fn(() => ({ status: "active" }));
    const params = {
      status: "active",
      toJSON: paramsToJson,
    };

    const request = client.request<{ sessions: string[] }>(
      "sessions.list",
      params,
    );
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    const frame = JSON.parse(socket.sent[1]!) as {
      id: string;
      params: Record<string, unknown>;
    };
    expect(frame.params).toEqual({ status: "active" });
    socket.respond(frame.id, { sessions: ["session-1"] });

    await expect(request).resolves.toEqual({ sessions: ["session-1"] });
    expect(paramsToJson).toHaveBeenCalledTimes(1);
    await client.close();
  });

  it("redacts ordinary RPC params and successful result previews without mutating data", async () => {
    const traces: GatewayRpcTraceEntry[] = [];
    const client = new GatewayRpcClient("wss://gateway.test/rpc", null, {
      clientId: "security-test",
      enableDeviceIdentity: false,
      onRpcTrace: (entry) => traces.push(entry),
    });
    await client.connect();
    traces.length = 0;
    const socket = SecurityTestWebSocket.instances[0]!;
    const params = {
      token: "param-secret",
      nested: { note: "password=inline-param-secret" },
    };
    const result = {
      api_key: "result-secret",
      note: "authorization: Bearer inline-result-secret",
    };

    const request = client.request<typeof result>("sessions.list", params);
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    const frame = JSON.parse(socket.sent[1]!) as { id: string };
    socket.respond(frame.id, result);

    await expect(request).resolves.toEqual(result);
    expect(params).toEqual({
      token: "param-secret",
      nested: { note: "password=inline-param-secret" },
    });
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      method: "sessions.list",
      ok: true,
      params: {
        token: "[REDACTED]",
        nested: { note: "password=[REDACTED]" },
      },
    });
    expect(traces[0]!.resultPreview).toContain('"api_key":"[REDACTED]"');
    expect(JSON.stringify(traces)).not.toMatch(
      /param-secret|inline-param-secret|result-secret|inline-result-secret/u,
    );
  });

  it("redacts remote RPC error messages and codes in trace telemetry", async () => {
    const traces: GatewayRpcTraceEntry[] = [];
    const client = new GatewayRpcClient("wss://gateway.test/rpc", null, {
      clientId: "security-test",
      enableDeviceIdentity: false,
      onRpcTrace: (entry) => traces.push(entry),
    });
    await client.connect();
    traces.length = 0;
    const socket = SecurityTestWebSocket.instances[0]!;

    const request = client.request("sessions.list", {});
    await vi.waitFor(() => expect(socket.sent).toHaveLength(2));
    const frame = JSON.parse(socket.sent[1]!) as { id: string };
    socket.respondError(frame.id, {
      code: "token=remote-code-secret",
      message: "authorization: Bearer remote-message-secret password=remote-password-secret",
    });

    await expect(request).rejects.toBeInstanceOf(Error);
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({
      method: "sessions.list",
      ok: false,
      error: {
        message: expect.stringContaining("[REDACTED]"),
        code: "token=[REDACTED]",
      },
    });
    expect(JSON.stringify(traces)).not.toMatch(
      /remote-code-secret|remote-message-secret|remote-password-secret/u,
    );
  });
});
