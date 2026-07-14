import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  CapabilityUnavailable,
  createUnavailableRuntimeControlClient,
} from "../../../../core/runtime/control-plane/runtime-control-client";
import {
  createRuntimeControlClient,
  createRuntimeProviderRegistry,
  type RuntimeControlClientOptions,
  type RuntimeProviderModule,
} from "../../../../core/runtime/providers/index";

describe("createRuntimeControlClient", () => {
  it("uses a registered provider canonical factory", async () => {
    const fixturePlane = createUnavailableRuntimeControlClient("fixture", new Set());
    const createFixtureRuntimeControlClient = vi.fn(async () => fixturePlane);
    const fixture: RuntimeProviderModule = {
      kind: "fixture",
      createClient: vi.fn(),
      createRuntimeControlClient: createFixtureRuntimeControlClient,
    };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    await expect(createRuntimeControlClient("fixture", { registry })).resolves.toBe(fixturePlane);
    expect(createFixtureRuntimeControlClient).toHaveBeenCalledWith({ registry });
  });

  it("normalizes provider aliases through the registry", async () => {
    const fixturePlane = createUnavailableRuntimeControlClient("fixture", new Set());
    const fixture: RuntimeProviderModule = {
      kind: "fixture",
      aliases: ["fixture-runtime"],
      createRuntimeControlClient: async () => fixturePlane,
    };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    await expect(createRuntimeControlClient(" FIXTURE-RUNTIME ", { registry })).resolves.toBe(
      fixturePlane,
    );
  });

  it("returns the canonical unavailable facade when a provider has no canonical factory", async () => {
    const fixture: RuntimeProviderModule = { kind: "fixture" };
    const registry = createRuntimeProviderRegistry({ modules: [fixture] });

    const plane = await createRuntimeControlClient(" GEMINI ", { registry });

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
    expectTypeOf<keyof RuntimeControlClientOptions>().toEqualTypeOf<
      | "baseUrl"
      | "webSocketUrl"
      | "token"
      | "resolveAuth"
      | "signal"
      | "trace"
      | "transport"
      | "registry"
    >();

    const options: RuntimeControlClientOptions = {
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
