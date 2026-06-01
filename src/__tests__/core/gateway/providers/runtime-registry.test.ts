import { describe, expect, it } from "vitest";
import {
  createGatewayProviderRegistry,
  createProviderRegistry,
  createRuntimeProviderRegistry,
} from "../../../../core/gateway/providers/registry";
import { CLAUDE_PROVIDER_MODULE } from "../../../../providers/claude/provider-module";
import { HERMES_PROVIDER_MODULE } from "../../../../providers/hermes/provider-module";

describe("runtime provider registry (F2)", () => {
  it("registers and resolves a runtime-only module by kind + alias", () => {
    const registry = createRuntimeProviderRegistry({ modules: [CLAUDE_PROVIDER_MODULE] });
    expect(registry.resolveProvider("claude-sdk")?.kind).toBe("claude-sdk");
    expect(registry.resolveProvider("anthropic")?.kind).toBe("claude-sdk");
    expect(registry.listProviders()).toHaveLength(1);
  });

  it("the gateway registry is unchanged and still gateway-typed", () => {
    const registry = createGatewayProviderRegistry({ modules: [HERMES_PROVIDER_MODULE] });
    const hermes = registry.resolveProvider("hermes");
    expect(typeof hermes?.createWebSocketClient).toBe("function");
  });

  it("the generic core can hold a mixed runtime registry", () => {
    const registry = createProviderRegistry({
      modules: [CLAUDE_PROVIDER_MODULE, HERMES_PROVIDER_MODULE],
    });
    expect(registry.listProviders()).toHaveLength(2);
    expect(registry.resolveProvider("claude")?.kind).toBe("claude-sdk");
  });
});
