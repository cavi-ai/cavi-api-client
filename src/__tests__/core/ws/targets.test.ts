import { describe, expect, it } from "vitest";
import {
  describeWebSocketClose,
  resolveGatewayTargets,
  resolveHttpWebSocketTargets,
  tryResolveGatewayTargets,
} from "../../../core/ws";

describe("core ws", () => {
  it("resolves paired HTTP and WebSocket targets from HTTP inputs", () => {
    expect(resolveHttpWebSocketTargets("https://gateway.example/base/")).toEqual({
      httpBase: "https://gateway.example/base",
      wsUrl: "wss://gateway.example/ws",
    });
    expect(resolveGatewayTargets("http://localhost:18789")).toEqual({
      httpBase: "http://localhost:18789",
      wsUrl: "ws://localhost:18789/ws",
    });
  });

  it("preserves explicit WebSocket paths and maps the HTTP base to origin", () => {
    expect(resolveHttpWebSocketTargets("wss://gateway.example/api/ws")).toEqual({
      httpBase: "https://gateway.example",
      wsUrl: "wss://gateway.example/api/ws",
    });
    expect(resolveHttpWebSocketTargets("ws://gateway.example")).toEqual({
      httpBase: "http://gateway.example",
      wsUrl: "ws://gateway.example/ws",
    });
  });

  it("returns null for unusable target input in the safe resolver", () => {
    expect(tryResolveGatewayTargets("")).toBeNull();
    expect(tryResolveGatewayTargets("file:///tmp/gateway")).toBeNull();
  });

  it("normalizes close events without binding to a gateway error type", () => {
    expect(describeWebSocketClose({ code: 1006 }, "socket closed")).toEqual({
      code: 1006,
      reason: null,
      message: "socket closed (1006)",
    });
    expect(describeWebSocketClose({ reason: "going away" }, "socket closed")).toEqual({
      code: null,
      reason: "going away",
      message: "socket closed: going away",
    });
  });
});
