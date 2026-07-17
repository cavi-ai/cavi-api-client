import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { CapabilityUnavailable } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createUnavailableRuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createRuntimeProviderRegistry } from "../../../../core/runtime/providers/registry.js";
import type {
  RuntimeControlClientOptions,
  RuntimeProviderModule,
} from "../../../../core/runtime/providers/types.js";
import type { TransportMessageChannel } from "../../../../core/transport/channel.js";
import { createRuntimeControlClient } from "../../../../providers/runtime-control-client-factory.js";
import { RUNTIME_PROVIDER_CAPABILITY_MATRIX } from "../../../../providers/capability-matrix.js";
import { withCaviRuntimeControlProviders } from "../../../../extensions/cavi/providers/runtime-control-registry.js";
import { CAVI_CONTROL_EXTENSION } from "../../../../extensions/cavi/adapters/runtime-control-extension.js";

const { createHermesExtensionClient, createAdapters } = vi.hoisted(() => ({
  createHermesExtensionClient: vi.fn(),
  createAdapters: vi.fn((options: unknown) => ({ options })),
}));

vi.mock("../../../../extensions/cavi/providers/hermes/runtime-control.js", () => ({
  createHermesRuntimeControlClient: createHermesExtensionClient,
}));
vi.mock("../../../../extensions/cavi/adapters/create-cavi-control-adapters.js", () => ({
  createCaviControlAdapters: createAdapters,
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
  it("installs independently constructed CAVI adapters for OpenClaw and Hermes", async () => {
    createHermesExtensionClient.mockImplementation(async () => sessionClient("hermes"));
    const base = createRuntimeProviderRegistry({ modules: baseModules() });
    const openclawCavi = { marker: "openclaw" } as never;
    const hermesCavi = { marker: "hermes" } as never;
    const options = { openclaw: { cavi: openclawCavi }, hermes: { cavi: hermesCavi } };
    const originalOpenclaw = base.resolveProvider("openclaw");
    const originalHermes = base.resolveProvider("hermes");
    const registry = withCaviRuntimeControlProviders(base, options);

    const [openclaw, hermes, codex] = await Promise.all([
      createRuntimeControlClient("openclaw", { registry }),
      createRuntimeControlClient("hermes", { registry }),
      createRuntimeControlClient("codex", { registry }),
    ]);

    expect(openclaw.extensions.has(CAVI_CONTROL_EXTENSION)).toBe(true);
    expect(openclaw.extensions.get(CAVI_CONTROL_EXTENSION)).toMatchObject({
      options: { marker: "openclaw" },
    });
    expect(hermes.extensions.has(CAVI_CONTROL_EXTENSION)).toBe(true);
    expect(hermes.extensions.get(CAVI_CONTROL_EXTENSION)).toMatchObject({
      options: { marker: "hermes" },
    });
    expect(codex.extensions.has(CAVI_CONTROL_EXTENSION)).toBe(false);
    expect(codex.extensions.get(CAVI_CONTROL_EXTENSION)).toBeUndefined();
    expect(openclaw.extensions.get(CAVI_CONTROL_EXTENSION))
      .not.toBe(hermes.extensions.get(CAVI_CONTROL_EXTENSION));
    expect(base.resolveProvider("openclaw")).toBe(originalOpenclaw);
    expect(base.resolveProvider("hermes")).toBe(originalHermes);
    expect(options).toEqual({ openclaw: { cavi: openclawCavi }, hermes: { cavi: hermesCavi } });
  });
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
      "authStatus", "dispose", "events", "extensions", "models", "sessions", "tasks", "usage", "workspace",
    ]);
    await expect(client.sessions.listSessions()).rejects.toMatchObject({
      name: "CapabilityUnavailable",
      providerId: "hermes",
      capability: "controlPlane.sessions.list",
    });
  });

  it("fails closed on alias shadowing and leaves shadow-provider calls untouched", async () => {
    const duplicateAlias = { kind: "other", aliases: ["hermes"], marker: true } as RuntimeProviderModule;
    const base = createRuntimeProviderRegistry({
      modules: [...baseModules(), duplicateAlias],
      allowOverrides: true,
    });

    expect(base.resolveProvider("hermes")).toBe(duplicateAlias);
    expect(() => withCaviRuntimeControlProviders(base, {
      hermes: { dashboardBaseUrl: "https://dashboard.test" },
    })).toThrowError("Invalid CAVI runtime-control registry: Hermes resolution is shadowed");
    expect(base.resolveProvider("hermes")).toBe(duplicateAlias);
    await expect(listSessions("hermes", base)).rejects.toEqual(
      new CapabilityUnavailable("other", "controlPlane.sessions.list"),
    );
  });

  it("fails closed when the canonical Hermes module is missing or ambiguous", () => {
    const missing = createRuntimeProviderRegistry({ modules: baseModules().slice(1) });
    expect(() => withCaviRuntimeControlProviders(missing)).toThrowError(
      "Invalid CAVI runtime-control registry: expected exactly one canonical Hermes module",
    );

    const ambiguous = createRuntimeProviderRegistry({
      modules: [...baseModules(), { kind: " HERMES ", aliases: ["other-hermes"] }],
      allowOverrides: true,
    });
    expect(() => withCaviRuntimeControlProviders(ambiguous)).toThrowError(
      "Invalid CAVI runtime-control registry: expected exactly one canonical Hermes module",
    );
  });

  it("fails closed when enhanced OpenClaw is missing, ambiguous, or alias-shadowed", () => {
    const cavi = { gatewayBaseUrl: "https://gateway.test" } as never;
    const missing = createRuntimeProviderRegistry({
      modules: baseModules().filter((module) => module.kind !== "openclaw"),
    });
    expect(() => withCaviRuntimeControlProviders(missing, { openclaw: { cavi } })).toThrowError(
      "Invalid CAVI runtime-control registry: expected exactly one canonical OpenClaw module",
    );

    const ambiguous = createRuntimeProviderRegistry({
      modules: [...baseModules(), { kind: " OPENCLAW ", aliases: ["another-openclaw"] }],
      allowOverrides: true,
    });
    expect(() => withCaviRuntimeControlProviders(ambiguous, { openclaw: { cavi } })).toThrowError(
      "Invalid CAVI runtime-control registry: expected exactly one canonical OpenClaw module",
    );

    const shadow = { kind: "other", aliases: ["openclaw"] } as RuntimeProviderModule;
    const shadowed = createRuntimeProviderRegistry({
      modules: [...baseModules(), shadow],
      allowOverrides: true,
    });
    expect(() => withCaviRuntimeControlProviders(shadowed, { openclaw: { cavi } })).toThrowError(
      "Invalid CAVI runtime-control registry: OpenClaw resolution is shadowed",
    );
    expect(shadowed.resolveProvider("openclaw")).toBe(shadow);
  });

  it("fails closed when configured OpenClaw has no composable runtime-control factory", () => {
    const modules = baseModules();
    modules[1] = { ...modules[1]!, createRuntimeControlClient: undefined };
    const base = createRuntimeProviderRegistry({ modules });
    const originalOpenclaw = base.resolveProvider("openclaw");
    const cavi = { gatewayBaseUrl: "https://gateway.test" } as never;

    expect(() => withCaviRuntimeControlProviders(base, { openclaw: { cavi } })).toThrowError(
      "Invalid CAVI runtime-control registry: canonical OpenClaw module has no runtime-control factory",
    );
    expect(base.resolveProvider("openclaw")).toBe(originalOpenclaw);

    const unconfigured = withCaviRuntimeControlProviders(base);
    expect(unconfigured.resolveProvider("openclaw")?.createRuntimeControlClient).toBeUndefined();
    expect(base.resolveProvider("openclaw")).toBe(originalOpenclaw);
  });

  it("matches defensive registry copies semantically and preserves generic custom fields", () => {
    type CustomModule = RuntimeProviderModule & { readonly custom: { readonly owner: string } };
    const source: CustomModule[] = baseModules().map((module) => ({
      ...module,
      custom: { owner: module.kind },
    }));
    const registry = createRuntimeProviderRegistry<CustomModule>({ modules: source });
    const defensive = {
      resolveProvider(provider: string | null | undefined) {
        const resolved = registry.resolveProvider(provider);
        return resolved ? { ...resolved } : null;
      },
      listProviders() {
        return registry.listProviders().map((module) => ({ ...module }));
      },
    };

    const enhanced = withCaviRuntimeControlProviders(defensive);
    expectTypeOf(enhanced).toEqualTypeOf<ReturnType<typeof createRuntimeProviderRegistry<CustomModule>>>();
    expect(enhanced.resolveProvider("hermes")?.custom).toEqual({ owner: "hermes" });
    expect(enhanced.resolveProvider("openclaw")).toEqual(source[1]);
  });

  it("snapshots nested extension config while retaining opaque runtime objects", async () => {
    const channel = {
      request: vi.fn(), subscribe: vi.fn(), close: vi.fn(),
    } as unknown as TransportMessageChannel<unknown>;
    const client = { request: vi.fn(), subscribe: vi.fn(), dispose: vi.fn() };
    const signal = new AbortController().signal;
    const fetch = vi.fn();
    const defaultHeaders = { "x-owner": "first" };
    const nestedSnapshot = { rows: [{ id: "one" }] };
    const cavi = {
      gatewayBaseUrl: "https://gateway.test",
      authToken: "token",
      defaultHeaders,
      client,
      snapshotFallbacks: { overview: nestedSnapshot },
    } as never;
    const setup = {
      hermes: {
        dashboardBaseUrl: "https://dashboard.test",
        channel,
        signal,
        fetch: fetch as never,
        cavi,
      },
    };
    const base = createRuntimeProviderRegistry({ modules: baseModules() });
    const first = withCaviRuntimeControlProviders(base, setup);
    const second = withCaviRuntimeControlProviders(base, setup);

    defaultHeaders["x-owner"] = "mutated";
    nestedSnapshot.rows[0]!.id = "mutated";
    (setup.hermes.cavi as typeof cavi) = { gatewayBaseUrl: "https://changed.test" } as never;
    createHermesExtensionClient.mockImplementation(async (received) => {
      const options = received as typeof setup.hermes;
      expect(options.channel).toBe(channel);
      expect(options.signal).toBe(signal);
      expect(options.fetch).toBe(fetch);
      expect((options.cavi as { client: unknown }).client).toBe(client);
      expect((options.cavi as { defaultHeaders: Record<string, string> }).defaultHeaders)
        .toEqual({ "x-owner": "first" });
      expect((options.cavi as { snapshotFallbacks: { overview: { rows: Array<{ id: string }> } } })
        .snapshotFallbacks.overview.rows[0]?.id).toBe("one");
      return sessionClient("snapshotted");
    });

    await Promise.all([listSessions("hermes", first), listSessions("hermes", second)]);
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
