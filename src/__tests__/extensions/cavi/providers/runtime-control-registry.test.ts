import { describe, expect, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createUnavailableRuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createRuntimeProviderRegistry } from "../../../../core/runtime/providers/registry.js";
import type {
  RuntimeControlClientOptions,
  RuntimeProviderModule,
} from "../../../../core/runtime/providers/types.js";
import { createRuntimeControlClient } from "../../../../providers/runtime-control-client-factory.js";
import { RUNTIME_PROVIDER_CAPABILITY_MATRIX } from "../../../../providers/capability-matrix.js";
import { withCaviRuntimeControlProviders } from "../../../../extensions/cavi/providers/runtime-control-registry.js";

const { createHermesExtensionClient } = vi.hoisted(() => ({
  createHermesExtensionClient: vi.fn(),
}));

vi.mock("../../../../extensions/cavi/providers/hermes/runtime-control-client.js", () => ({
  createHermesRuntimeControlClient: createHermesExtensionClient,
}));

const sessionClient = (id: string) => ({
  ...createUnavailableRuntimeControlClient(id, new Set()),
  sessions: {
    listSessions: async () => ({ data: [{ id }], nextCursor: null }),
    getSession: async () => ({ data: { id } }),
    cancelSession: async () => ({ data: { id, status: "cancelled" } }),
  },
});

function baseModules(hermesFactory?: RuntimeProviderModule["createRuntimeControlClient"]): RuntimeProviderModule[] {
  const available = (kind: string, aliases: readonly string[] = []): RuntimeProviderModule => ({
    kind,
    aliases,
    capabilities: { runs: true },
    createRuntimeControlClient: async () => sessionClient(kind),
  });
  return [
    available("hermes", ["hermes-api-server"]),
    available("openclaw", ["open-claw"]),
    available("codex-responses", ["codex", "openai-codex"]),
    available("claude-sdk", ["claude", "anthropic"]),
    available("gemini", ["google", "google-gemini"]),
  ].map((module) => module.kind === "hermes" && hermesFactory
    ? { ...module, createRuntimeControlClient: hermesFactory }
    : module);
}

async function listSessions(providerId: string, registry: ReturnType<typeof createRuntimeProviderRegistry>) {
  return (await createRuntimeControlClient(providerId, {
    registry,
    baseUrl: "https://core.call.test",
    token: "call-token",
  })).sessions.listSessions();
}

describe("withCaviRuntimeControlProviders", () => {
  it("keeps one provider-neutral consumer path for kinds, aliases, and unknown providers", async () => {
    createHermesExtensionClient.mockImplementation(async (options: RuntimeControlClientOptions & {
      dashboardBaseUrl?: string;
      dashboardToken?: string;
    }) => sessionClient(`${options.dashboardBaseUrl}|${options.dashboardToken}|${options.baseUrl}|${options.token}`));
    const base = createRuntimeProviderRegistry({ modules: baseModules() });
    const registry = withCaviRuntimeControlProviders(base, {
      hermes: { dashboardBaseUrl: "https://dashboard.test", dashboardToken: "dashboard-token" },
    });

    for (const [provider, expected] of [
      ["hermes", "https://dashboard.test|dashboard-token|https://core.call.test|call-token"],
      [" HERMES-API-SERVER ", "https://dashboard.test|dashboard-token|https://core.call.test|call-token"],
      ["openclaw", "openclaw"], ["open-claw", "openclaw"],
      ["codex", "codex-responses"], ["claude", "claude-sdk"], ["gemini", "gemini"],
    ] as const) {
      await expect(listSessions(provider, registry)).resolves.toMatchObject({ data: [{ id: expected }] });
    }

    const unknown = await createRuntimeControlClient("unknown", { registry });
    await expect(unknown.sessions.listSessions()).rejects.toEqual(
      new CapabilityUnavailable("unknown", "controlPlane.sessions.list"),
    );
  });

  it("clones modules, preserves metadata, overrides a preexisting Hermes factory, and changes no root matrix", () => {
    const oldFactory = vi.fn(async () => sessionClient("old"));
    const modules = baseModules(oldFactory);
    const base = createRuntimeProviderRegistry({ modules });
    const matrix = RUNTIME_PROVIDER_CAPABILITY_MATRIX;
    const registry = withCaviRuntimeControlProviders(base, { hermes: { dashboardBaseUrl: "https://one.test" } });
    const originalHermes = base.resolveProvider("hermes")!;
    const enhancedHermes = registry.resolveProvider("hermes")!;

    expect(registry).not.toBe(base);
    expect(registry.listProviders()).not.toBe(base.listProviders());
    expect(enhancedHermes).not.toBe(originalHermes);
    expect(enhancedHermes).toMatchObject({
      kind: originalHermes.kind,
      aliases: originalHermes.aliases,
      capabilities: originalHermes.capabilities,
    });
    expect(enhancedHermes.createRuntimeControlClient).not.toBe(oldFactory);
    expect(base.resolveProvider("hermes")).toBe(originalHermes);
    expect(RUNTIME_PROVIDER_CAPABILITY_MATRIX).toBe(matrix);
  });

  it("keeps setup options isolated per registry and lets call-time core options win overlaps", async () => {
    createHermesExtensionClient.mockImplementation(async (options: RuntimeControlClientOptions & {
      dashboardBaseUrl?: string;
      dashboardToken?: string;
      cavi?: { marker?: string };
    }) => sessionClient(`${options.dashboardBaseUrl}|${options.dashboardToken}|${options.baseUrl}|${options.token}|${options.cavi?.marker}`));
    const base = createRuntimeProviderRegistry({ modules: baseModules() });
    const first = withCaviRuntimeControlProviders(base, {
      hermes: { dashboardBaseUrl: "https://first.test", dashboardToken: "first", cavi: { marker: "one" } as never },
    });
    const second = withCaviRuntimeControlProviders(base, {
      hermes: { dashboardBaseUrl: "https://second.test", dashboardToken: "second", cavi: { marker: "two" } as never },
    });

    const [one, two] = await Promise.all([
      listSessions("hermes", first),
      createRuntimeControlClient("hermes", { registry: second, baseUrl: "https://override.test", token: "override" })
        .then((client) => client.sessions.listSessions()),
    ]);
    expect(one).toMatchObject({ data: [{ id: "https://first.test|first|https://core.call.test|call-token|one" }] });
    expect(two).toMatchObject({ data: [{ id: "https://second.test|second|https://override.test|override|two" }] });
  });

  it("returns the complete unavailable shape when Hermes extension configuration is missing", async () => {
    createHermesExtensionClient.mockImplementation(async () =>
      createUnavailableRuntimeControlClient("hermes", new Set())
    );
    const base = createRuntimeProviderRegistry({ modules: baseModules() });
    const registry = withCaviRuntimeControlProviders(base);
    const client = await createRuntimeControlClient("hermes", { registry });

    expect(Object.keys(client).sort()).toEqual([
      "authStatus", "dispose", "events", "models", "sessions", "tasks", "usage", "workspace",
    ]);
    await expect(client.sessions.listSessions()).rejects.toMatchObject({
      name: "CapabilityUnavailable",
      providerId: "hermes",
      capability: "controlPlane.sessions.list",
    });
  });

  it("rebuilds duplicate and alias resolution without mutating the base", () => {
    const duplicateAlias = { kind: "other", aliases: ["hermes"], marker: true } as RuntimeProviderModule;
    const base = createRuntimeProviderRegistry({
      modules: [...baseModules(), duplicateAlias],
      allowOverrides: true,
    });

    expect(base.resolveProvider("hermes")).toBe(duplicateAlias);
    const enhanced = withCaviRuntimeControlProviders(base, { hermes: { dashboardBaseUrl: "https://dashboard.test" } });
    expect(enhanced.resolveProvider("hermes")?.kind).toBe("other");
    expect(enhanced.resolveProvider("hermes-api-server")?.kind).toBe("hermes");
    expect(base.resolveProvider("hermes")).toBe(duplicateAlias);
  });

  it("does not leak extension-only configuration into non-Hermes factories", async () => {
    const openclawFactory = vi.fn(async () => sessionClient("openclaw"));
    const modules = baseModules();
    modules[1] = { ...modules[1]!, createRuntimeControlClient: openclawFactory };
    const registry = withCaviRuntimeControlProviders(createRuntimeProviderRegistry({ modules }), {
      hermes: { dashboardBaseUrl: "https://dashboard.test", dashboardToken: "secret" },
    });

    await listSessions("openclaw", registry);
    expect(openclawFactory).toHaveBeenCalledWith({
      registry,
      baseUrl: "https://core.call.test",
      token: "call-token",
    });
  });
});
