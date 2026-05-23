import { describe, expect, it } from "vitest";
import { GatewayApiClient } from "../../../core/gateway/client/client";
import {
  createGatewayProviderRegistry,
  requestedGatewayProvider,
  resolveGatewayProviderModule,
} from "../../../providers/gateway/registry";
import { GATEWAY_PROVIDER_ENV_KEYS } from "../../../providers/gateway/types";
import type { GatewayProviderModule } from "../../../providers/gateway/types";

const acmeProvider: GatewayProviderModule = {
  kind: "acme",
  aliases: ["acme-gateway"],
  createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
};

describe("gateway provider registry", () => {
  it("includes built-in providers and normalizes lookup tokens", () => {
    const registry = createGatewayProviderRegistry();

    expect(registry.resolveProvider("hermes")?.kind).toBe("hermes");
    expect(registry.resolveProvider(" OPENCLAW ")?.kind).toBe("openclaw");
    // "generic" is an alias for the gateway provider.
    expect(registry.resolveProvider("generic")?.kind).toBe("gateway");
    expect(registry.resolveProvider("gateway")?.kind).toBe("gateway");
    expect(registry.resolveProvider("nope")).toBeNull();
    expect(registry.listProviders()).toHaveLength(3);
  });

  it("registers custom modules by kind and aliases", () => {
    const registry = createGatewayProviderRegistry({ modules: [acmeProvider] });

    expect(registry.resolveProvider("acme")).toBe(acmeProvider);
    expect(registry.resolveProvider("acme-gateway")).toBe(acmeProvider);
    expect(registry.listProviders()).toHaveLength(4);
  });

  it("rejects duplicate provider keys by default", () => {
    expect(() =>
      createGatewayProviderRegistry({ modules: [{ kind: "hermes" }] }),
    ).toThrow(/Duplicate gateway provider key "hermes"/u);
  });

  it("allows intentional overrides", () => {
    const override: GatewayProviderModule = { kind: "hermes" };
    const registry = createGatewayProviderRegistry({
      modules: [override],
      allowOverrides: true,
    });

    expect(registry.resolveProvider("hermes")).toBe(override);
  });

  it("supports standalone registries without built-ins", () => {
    const registry = createGatewayProviderRegistry({
      includeBuiltIns: false,
      modules: [acmeProvider],
    });

    expect(registry.resolveProvider("hermes")).toBeNull();
    expect(registry.resolveProvider("acme")).toBe(acmeProvider);
    expect(registry.listProviders()).toHaveLength(1);
  });
});

describe("requestedGatewayProvider", () => {
  it("prefers an explicit provider over env and default", () => {
    expect(
      requestedGatewayProvider({
        provider: "  hermes ",
        env: { [GATEWAY_PROVIDER_ENV_KEYS[0]!]: "openclaw" },
      }),
    ).toBe("hermes");
  });

  it("falls back to env then to the default", () => {
    expect(
      requestedGatewayProvider({
        env: { [GATEWAY_PROVIDER_ENV_KEYS[0]!]: "openclaw" },
      }),
    ).toBe("openclaw");
    expect(requestedGatewayProvider({})).toBe("gateway");
    expect(requestedGatewayProvider({ defaultProvider: "acme" })).toBe("acme");
  });
});

describe("resolveGatewayProviderModule", () => {
  it("resolves built-in providers from explicit choice and env", () => {
    expect(resolveGatewayProviderModule({ provider: "hermes" }).kind).toBe("hermes");
    expect(
      resolveGatewayProviderModule({
        env: { [GATEWAY_PROVIDER_ENV_KEYS[0]!]: "openclaw" },
      }).kind,
    ).toBe("openclaw");
    expect(resolveGatewayProviderModule().kind).toBe("gateway");
  });

  it("resolves custom modules passed at the call boundary", () => {
    const module = resolveGatewayProviderModule({
      provider: "acme",
      providerModules: [acmeProvider],
    });

    expect(module).toBe(acmeProvider);
  });

  it("throws for an unknown provider", () => {
    expect(() => resolveGatewayProviderModule({ provider: "ghost" })).toThrow(
      /Unknown gateway provider "ghost"/u,
    );
  });
});
