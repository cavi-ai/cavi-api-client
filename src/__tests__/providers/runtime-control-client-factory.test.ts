import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUnavailableRuntimeControlClient } from "../../core/runtime/control-plane/runtime-control-client";

const { createBuiltInRuntimeControlClient, fixturePlane } = vi.hoisted(() => ({
  createBuiltInRuntimeControlClient: vi.fn(),
  fixturePlane: { marker: "built-in-plane" },
}));

vi.mock("../../providers/hermes/provider-module", () => ({
  HERMES_PROVIDER_MODULE: {
    kind: "hermes",
    aliases: ["hermes-api-server"],
    createRuntimeControlClient: createBuiltInRuntimeControlClient,
  },
}));

vi.mock("../../providers/openclaw/provider-module", () => ({
  OPENCLAW_PROVIDER_MODULE: {
    kind: "openclaw",
    aliases: ["open-claw"],
  },
}));

describe("package default createRuntimeControlClient", () => {
  beforeEach(() => {
    createBuiltInRuntimeControlClient.mockReset();
    createBuiltInRuntimeControlClient.mockResolvedValue(fixturePlane);
  });

  it("uses a canonical hook from the built-in provider registry without injection", async () => {
    const { createRuntimeControlClient } = await import("../../index");

    await expect(createRuntimeControlClient(" HERMES-API-SERVER ")).resolves.toBe(fixturePlane);
    expect(createBuiltInRuntimeControlClient).toHaveBeenCalledWith(
      expect.objectContaining({ registry: expect.anything() }),
    );
  });

  it("preserves an explicitly injected registry override", async () => {
    const { createRuntimeControlClient, createRuntimeProviderRegistry } = await import(
      "../../index"
    );
    const explicitPlane = createUnavailableRuntimeControlClient("fixture", new Set());
    const explicitFactory = vi.fn(async () => explicitPlane);
    const registry = createRuntimeProviderRegistry({
      modules: [{ kind: "fixture", createRuntimeControlClient: explicitFactory }],
    });

    await expect(createRuntimeControlClient("fixture", { registry })).resolves.toBe(explicitPlane);
    expect(explicitFactory).toHaveBeenCalledWith({ registry });
    expect(createBuiltInRuntimeControlClient).not.toHaveBeenCalled();
  });
});
