import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  CapabilityUnavailable,
  createUnavailableCanonicalControlPlane,
} from "../../../../core/runtime/control-plane/canonical";
import {
  createRuntimeControlPlane,
  createRuntimeProviderRegistry,
  type CanonicalControlPlaneFactoryOptions,
  type RuntimeProviderModule,
} from "../../../../core/runtime/providers/index";

describe("createRuntimeControlPlane", () => {
  it("uses a registered provider canonical factory", async () => {
    const fixturePlane = createUnavailableCanonicalControlPlane("fixture", new Set());
    const createCanonicalControlPlane = vi.fn(async () => fixturePlane);
    const fixture: RuntimeProviderModule = {
      kind: "fixture",
      createClient: vi.fn(),
      createCanonicalControlPlane,
    };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    await expect(createRuntimeControlPlane("fixture", { registry })).resolves.toBe(fixturePlane);
    expect(createCanonicalControlPlane).toHaveBeenCalledWith({ registry });
  });

  it("normalizes provider aliases through the registry", async () => {
    const fixturePlane = createUnavailableCanonicalControlPlane("fixture", new Set());
    const fixture: RuntimeProviderModule = {
      kind: "fixture",
      aliases: ["fixture-runtime"],
      createCanonicalControlPlane: async () => fixturePlane,
    };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    await expect(createRuntimeControlPlane(" FIXTURE-RUNTIME ", { registry })).resolves.toBe(
      fixturePlane,
    );
  });

  it("returns the canonical unavailable facade when a provider has no canonical factory", async () => {
    const fixture: RuntimeProviderModule = { kind: "fixture" };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    const plane = await createRuntimeControlPlane(" GEMINI ", { registry });

    expect(plane).toMatchObject({
      authStatus: expect.any(Object),
      sessions: expect.any(Object),
      models: expect.any(Object),
      usage: expect.any(Object),
      tasks: expect.any(Object),
      workspace: expect.any(Object),
      events: expect.any(Object),
      dispose: expect.any(Function),
    });
    await expect(plane.sessions.listSessions()).rejects.toMatchObject<CapabilityUnavailable>({
      name: "CapabilityUnavailable",
      providerId: "gemini",
      capability: "controlPlane.sessions.list",
    });
    await expect(plane.dispose()).resolves.toBeUndefined();
  });

  it("keeps factory options provider-neutral", () => {
    expectTypeOf<keyof CanonicalControlPlaneFactoryOptions>().toEqualTypeOf<
      | "baseUrl"
      | "webSocketUrl"
      | "token"
      | "resolveAuth"
      | "signal"
      | "trace"
      | "transport"
      | "registry"
    >();

    const options: CanonicalControlPlaneFactoryOptions = {
      baseUrl: "https://runtime.example",
      webSocketUrl: "wss://runtime.example",
      token: "token",
      resolveAuth: async () => ({ headers: { Authorization: "Bearer token" } }),
      signal: new AbortController().signal,
      trace: () => undefined,
      transport: {},
    };
    expect(options).toBeDefined();
  });
});
