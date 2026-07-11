import { describe, expect, it } from "vitest";
import {
  createRuntimeProviderRegistry,
  type RuntimeProviderModule,
} from "../../../../core/runtime/providers/index";

const module = (kind: string, aliases: readonly string[] = []): RuntimeProviderModule => ({
  kind,
  aliases,
  capabilities: { runs: true },
});

describe("runtime provider registry", () => {
  it("resolves normalized kinds and aliases", () => {
    const acme = module("Acme", ["acme-runtime"]);
    const registry = createRuntimeProviderRegistry({ modules: [acme] });

    expect(registry.resolveProvider(" ACME ")).toBe(acme);
    expect(registry.resolveProvider("acme-runtime")).toBe(acme);
    expect(registry.resolveProvider("missing")).toBeNull();
  });

  it("rejects duplicate aliases unless overrides are enabled", () => {
    const first = module("first", ["shared"]);
    const second = module("second", ["shared"]);

    expect(() => createRuntimeProviderRegistry({ modules: [first, second] })).toThrow(
      'Duplicate provider key "shared"',
    );
    expect(
      createRuntimeProviderRegistry({ modules: [first, second], allowOverrides: true })
        .resolveProvider("shared"),
    ).toBe(second);
  });
});
