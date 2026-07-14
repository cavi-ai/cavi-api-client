import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUnavailableCanonicalControlPlane } from "../../core/runtime/control-plane/canonical";

const { createCanonicalControlPlane, fixturePlane } = vi.hoisted(() => ({
  createCanonicalControlPlane: vi.fn(),
  fixturePlane: { marker: "built-in-plane" },
}));

vi.mock("../../providers/hermes/provider-module", () => ({
  HERMES_PROVIDER_MODULE: {
    kind: "hermes",
    aliases: ["hermes-api-server"],
    createCanonicalControlPlane,
  },
}));

vi.mock("../../providers/openclaw/provider-module", () => ({
  OPENCLAW_PROVIDER_MODULE: {
    kind: "openclaw",
    aliases: ["open-claw"],
  },
}));

describe("package default createRuntimeControlPlane", () => {
  beforeEach(() => {
    createCanonicalControlPlane.mockReset();
    createCanonicalControlPlane.mockResolvedValue(fixturePlane);
  });

  it("uses a canonical hook from the built-in provider registry without injection", async () => {
    const { createRuntimeControlPlane } = await import("../../index");

    await expect(createRuntimeControlPlane(" HERMES-API-SERVER ")).resolves.toBe(fixturePlane);
    expect(createCanonicalControlPlane).toHaveBeenCalledWith(
      expect.objectContaining({ registry: expect.anything() }),
    );
  });

  it("preserves an explicitly injected registry override", async () => {
    const { createRuntimeControlPlane, createRuntimeProviderRegistry } = await import(
      "../../index"
    );
    const explicitPlane = createUnavailableCanonicalControlPlane("fixture", new Set());
    const explicitFactory = vi.fn(async () => explicitPlane);
    const registry = createRuntimeProviderRegistry({
      modules: [{ kind: "fixture", createCanonicalControlPlane: explicitFactory }],
    });

    await expect(createRuntimeControlPlane("fixture", { registry })).resolves.toBe(explicitPlane);
    expect(explicitFactory).toHaveBeenCalledWith({ registry });
    expect(createCanonicalControlPlane).not.toHaveBeenCalled();
  });
});
