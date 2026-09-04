import { describe, expect, it } from "vitest";
import * as OpenCode from "../../../providers/opencode/index.js";
import {
  OPENCODE_ENDPOINT_FAMILY,
  OPENCODE_OPENAPI_SHA256,
  OPENCODE_RUNTIME_SUPPORT,
  OPENCODE_SERVER_VERSION,
  OpenCodeApiClient,
  createOpenCodeProviderModule,
  encodeOpenCodeSessionId,
  validateOpenCodeScope,
} from "../../../providers/opencode/index.js";
import type { RuntimeClient } from "../../../core/runtime/client.js";
import type { RuntimeProviderModule } from "../../../core/runtime/providers/types.js";
import type { OpenCodeProviderModule } from "../../../providers/opencode/provider-module.js";

const scope = { directory: "/workspace/project", workspace: "/workspace" };

describe("OpenCode provider module", () => {
  it("publishes only the supported OpenCode identity and capability contract", () => {
    expect(OPENCODE_RUNTIME_SUPPORT).toEqual({ runs: true, streaming: true });
    expect(Object.isFrozen(OPENCODE_RUNTIME_SUPPORT)).toBe(true);
    expect(OPENCODE_SERVER_VERSION).toBe("1.18.27");
    expect(OPENCODE_OPENAPI_SHA256).toMatch(/^[a-f0-9]{64}$/);
    expect(OPENCODE_ENDPOINT_FAMILY).toBe("legacy-http-sse");
  });

  it("creates a provider-neutral module with one shared factory and no aliases", () => {
    const module: OpenCodeProviderModule = createOpenCodeProviderModule({
      baseUrl: "http://localhost:4096",
      scope,
    });
    expect(module.kind).toBe("opencode");
    expect(module.aliases).toBeUndefined();
    expect(module.capabilities).toBe(OPENCODE_RUNTIME_SUPPORT);
    expect(module.createClient).toBe(module.createApiClient);
    expect(module.createClient).toBeTypeOf("function");
  });

  it("captures provider-owned settings while allowing only supplied neutral overrides", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ healthy: true, version: "1.18.27" }), {
        headers: { "content-type": "application/json" },
      });
    };
    const module = createOpenCodeProviderModule({
      baseUrl: "http://captured.example/",
      scope,
      username: "captured-user",
      password: "captured-password",
      defaultModel: "captured/model",
      fetchImpl,
      defaultTimeoutMs: 111,
      cache: "no-store",
      credentials: "include",
    });
    const createClient = module.createClient!;
    const client = createClient({
      baseUrl: "http://override.example/",
      onTrace: () => undefined,
      defaultTimeoutMs: 222,
    }) as OpenCodeApiClient;

    expect(client.scope).toEqual(scope);
    await expect(client.probeHealth()).resolves.toEqual({ healthy: true, version: "1.18.27" });
    expect(calls[0]?.url).toBe("http://override.example/global/health");
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: `Basic ${btoa("captured-user:captured-password")}`,
    });
  });

  it("keeps the barrel limited to the intentional downstream symbols", () => {
    expect(Object.keys(OpenCode).sort()).toEqual([
      "OPENCODE_ENDPOINT_FAMILY",
      "OPENCODE_OPENAPI_SHA256",
      "OPENCODE_RUNTIME_SUPPORT",
      "OPENCODE_SERVER_VERSION",
      "OpenCodeApiClient",
      "createOpenCodeProviderModule",
      "encodeOpenCodeSessionId",
      "validateOpenCodeScope",
    ]);
    expect(validateOpenCodeScope({ directory: "/tmp/project" })).toEqual({ directory: "/tmp/project" });
    expect(encodeOpenCodeSessionId("ses_test")).toBe("ses_test");
  });

  it("returns a RuntimeClient from both factory names and shares capabilities", async () => {
    const module = createOpenCodeProviderModule({ baseUrl: "http://localhost:4096", scope });
    const options = { baseUrl: "http://localhost:4096" };
    const client = module.createClient!(options) as RuntimeClient;
    const deprecatedClient = module.createApiClient!(options) as RuntimeClient;
    expect(typeof client.getRuntimeCapabilities).toBe("function");
    expect(typeof deprecatedClient.getRuntimeCapabilities).toBe("function");
    expect((await client.getRuntimeCapabilities()).supports).toBe(OPENCODE_RUNTIME_SUPPORT);
    expect((await deprecatedClient.getRuntimeCapabilities()).supports).toBe(OPENCODE_RUNTIME_SUPPORT);
  });

  it("allows captured configuration when provider-neutral client options are omitted", () => {
    const module = createOpenCodeProviderModule({ baseUrl: "http://localhost:4096", scope });
    const runtimeModule: RuntimeProviderModule = module;
    expect(runtimeModule.kind).toBe("opencode");

    const capturedClient: OpenCodeApiClient = module.createClient!();
    const timeoutClient: OpenCodeApiClient = module.createClient!({ defaultTimeoutMs: 0 });
    expect(capturedClient).toBeInstanceOf(OpenCodeApiClient);
    expect(timeoutClient).toBeInstanceOf(OpenCodeApiClient);
  });
});
