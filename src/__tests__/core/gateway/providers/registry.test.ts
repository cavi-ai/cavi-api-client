import { describe, expect, it } from "vitest";
import { GatewayApiClient } from "../../../../core/gateway/client/client";
import {
  createGatewayProviderRegistry,
  requestedGatewayProvider,
  resolveGatewayProviderModule,
} from "../../../../core/gateway/providers/registry";
import { GATEWAY_PROVIDER_ENV_KEYS } from "../../../../core/gateway/providers/types";
import type { GatewayProviderModule } from "../../../../core/gateway/providers/types";
import { HERMES_PROVIDER_MODULE } from "../../../../providers/hermes/provider-module";
import { OPENCLAW_PROVIDER_MODULE } from "../../../../providers/openclaw/provider-module";

const acmeProvider: GatewayProviderModule = {
  kind: "acme",
  aliases: ["acme-gateway"],
  createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
};

describe("gateway provider registry", () => {
  it("starts empty and normalizes generic lookup tokens", () => {
    const registry = createGatewayProviderRegistry();

    expect(registry.resolveProvider("hermes")).toBeNull();
    expect(registry.resolveProvider("generic")).toBeNull();
    expect(registry.resolveProvider("gateway")).toBeNull();
    expect(registry.resolveProvider("nope")).toBeNull();
    expect(registry.listProviders()).toHaveLength(0);
  });

  it("registers supported provider modules at the caller boundary", () => {
    const registry = createGatewayProviderRegistry({
      modules: [HERMES_PROVIDER_MODULE, OPENCLAW_PROVIDER_MODULE],
    });

    expect(registry.resolveProvider("hermes")?.kind).toBe("hermes");
    expect(registry.resolveProvider(" OPENCLAW ")?.kind).toBe("openclaw");
    expect(registry.listProviders()).toHaveLength(2);
  });

  it("registers custom modules by kind and aliases", () => {
    const registry = createGatewayProviderRegistry({ modules: [acmeProvider] });

    expect(registry.resolveProvider("acme")).toBe(acmeProvider);
    expect(registry.resolveProvider("acme-gateway")).toBe(acmeProvider);
    expect(registry.listProviders()).toHaveLength(1);
  });

  it("rejects duplicate provider keys by default", () => {
    expect(() =>
      createGatewayProviderRegistry({
        modules: [HERMES_PROVIDER_MODULE, { kind: "hermes" }],
      }),
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

  it("supports standalone registries", () => {
    const registry = createGatewayProviderRegistry({
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
    expect(requestedGatewayProvider({})).toBeNull();
    expect(requestedGatewayProvider({ defaultProvider: "acme" })).toBe("acme");
  });
});

describe("resolveGatewayProviderModule", () => {
  it("resolves registered providers from explicit choice and env", () => {
    const providerModules = [HERMES_PROVIDER_MODULE, OPENCLAW_PROVIDER_MODULE];

    expect(resolveGatewayProviderModule({
      provider: "hermes",
      providerModules,
    })?.kind).toBe("hermes");
    expect(
      resolveGatewayProviderModule({
        env: { [GATEWAY_PROVIDER_ENV_KEYS[0]!]: "openclaw" },
        providerModules,
      })?.kind,
    ).toBe("openclaw");
    expect(resolveGatewayProviderModule()).toBeNull();
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
