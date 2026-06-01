import { describe, expect, it } from "vitest";
import type {
  GatewayProviderModule,
  RuntimeProviderModule,
} from "../../../../core/gateway/providers/types";

// A runtime-only provider (claude-sdk shape): no gateway factories, declares capabilities.
const claudeModule: RuntimeProviderModule = {
  kind: "claude-sdk",
  capabilities: { runs: true, streaming: true },
};

describe("RuntimeProviderModule", () => {
  it("a runtime-only module is valid without gateway factories", () => {
    expect(claudeModule.kind).toBe("claude-sdk");
    expect(claudeModule.capabilities?.runs).toBe(true);
  });

  it("a GatewayProviderModule is assignable to RuntimeProviderModule", () => {
    const gw: GatewayProviderModule = { kind: "hermes" };
    const asRuntime: RuntimeProviderModule = gw;
    expect(asRuntime.kind).toBe("hermes");
  });
});
