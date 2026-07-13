import { describe, expect, it } from "vitest";
import {
  runtimeTransportSupports,
  type RuntimeTransportCapabilities,
} from "../../../../core/runtime/control-plane/index";

describe("runtime control-plane transports", () => {
  it("treats undeclared transports as unsupported", () => {
    const transports: RuntimeTransportCapabilities = {
      http: { kind: "http", stability: "stable", authenticated: true },
      sse: { kind: "sse", stability: "stable", authenticated: true, replay: false },
    };
    expect(runtimeTransportSupports(transports, "http")).toBe(true);
    expect(runtimeTransportSupports(transports, "sse")).toBe(true);
    expect(runtimeTransportSupports(transports, "websocket")).toBe(false);
  });
});
