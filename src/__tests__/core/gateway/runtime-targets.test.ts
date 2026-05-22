import { describe, expect, it } from "vitest";
import {
  resolveGatewayRuntimeHttpBase,
  resolveGatewayRuntimeHttpUrl,
  resolveGatewayRuntimeWsUrl,
  sameGatewayDaemon,
} from "../../../core/gateway/runtime-targets";

describe("gateway runtime targets", () => {
  it("treats localhost and 127.0.0.1 as the same loopback daemon when ports match", () => {
    expect(
      sameGatewayDaemon("http://localhost:18789", "http://127.0.0.1:18789"),
    ).toBe(true);
    expect(
      sameGatewayDaemon("http://localhost:18789", "http://127.0.0.1:9999"),
    ).toBe(false);
  });

  it("routes matching configured gateway HTTP through the same-origin frontend proxy", () => {
    expect(
      resolveGatewayRuntimeHttpBase("http://localhost:18789", {
        configuredGatewayBaseUrl: "http://127.0.0.1:18789",
        windowOrigin: "https://portal.example",
      }),
    ).toBe("https://portal.example");
  });

  it("routes matching configured gateway WS through the same-origin frontend proxy", () => {
    expect(
      resolveGatewayRuntimeWsUrl("http://localhost:18789", {
        configuredGatewayBaseUrl: "http://127.0.0.1:18789",
        windowOrigin: "https://portal.example",
      }),
    ).toBe("wss://portal.example/ws");
  });

  it("falls back to resolved direct gateway targets when configured daemon differs", () => {
    expect(
      resolveGatewayRuntimeHttpBase("http://localhost:18789", {
        configuredGatewayBaseUrl: "http://127.0.0.1:9999",
        windowOrigin: "https://portal.example",
      }),
    ).toBe("http://localhost:18789");
    expect(
      resolveGatewayRuntimeWsUrl("http://localhost:18789", {
        configuredGatewayBaseUrl: "http://127.0.0.1:9999",
        windowOrigin: "https://portal.example",
      }),
    ).toBe("ws://localhost:18789/ws");
  });

  it("builds runtime HTTP URLs with normalized path separators", () => {
    expect(
      resolveGatewayRuntimeHttpUrl("https://gateway.example/base/", "v1/runs"),
    ).toBe("https://gateway.example/base/v1/runs");
  });
});
