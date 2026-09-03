import { describe, expect, it } from "vitest";
import { ApiClientErrorCode, ApiClientErrorType } from "../../../../core/errors";
import type { RuntimeClient } from "../../../../core/runtime/client";
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeClientOptions,
  type RuntimeProviderModule,
} from "../../../../core/runtime/providers/index";

const client: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "acme", supports: { runs: true } }),
  startRun: async () => ({ id: "run-1", state: "queued" }),
};

describe("createRuntimeClient", () => {
  it("prefers createClient and forwards transport options", () => {
    let received: RuntimeClientOptions | undefined;
    const fetchImpl = (() => Promise.reject(new Error("unused"))) as typeof fetch;
    const onTrace: NonNullable<RuntimeClientOptions["onTrace"]> = () => undefined;
    const clientOptions: RuntimeClientOptions = {
      baseUrl: "https://runtime.example",
      fetchImpl,
      onTrace,
      defaultTimeoutMs: 0,
      cache: "reload",
      credentials: "include",
    };
    let resolveCalls = 0;
    const provider: RuntimeProviderModule = {
      kind: "acme",
      capabilities: { runs: true },
      createClient: (options) => {
        received = options;
        return client;
      },
      createApiClient: () => {
        throw new Error("legacy factory should not run");
      },
    };
    const registry = {
      resolveProvider: () => {
        resolveCalls += 1;
        return provider;
      },
      listProviders: () => [provider],
    };

    expect(createRuntimeClient("acme", { registry, clientOptions })).toBe(client);
    expect(received).toBe(clientOptions);
    expect(resolveCalls).toBe(1);
  });

  it("supports legacy createApiClient modules", () => {
    let received: RuntimeClientOptions | undefined;
    const provider: RuntimeProviderModule = {
      kind: "legacy",
      capabilities: { runs: true },
      createApiClient: (options) => {
        received = options;
        return client;
      },
    };
    const registry = createRuntimeProviderRegistry({ modules: [provider] });
    const clientOptions: RuntimeClientOptions = { baseUrl: "https://runtime.example" };

    expect(
      createRuntimeClient("legacy", {
        registry,
        clientOptions,
      }),
    ).toBe(client);
    expect(received).toBe(clientOptions);
  });

  it("throws typed errors for unknown providers and missing factories", () => {
    const missingFactory: RuntimeProviderModule = {
      kind: "metadata-only",
      capabilities: { runs: true },
    };
    const registry = createRuntimeProviderRegistry({ modules: [missingFactory] });

    const capture = (provider: string) => {
      try {
        createRuntimeClient(provider, {
          registry,
          clientOptions: { baseUrl: "https://runtime.example" },
        });
      } catch (error) {
        return error;
      }
      throw new Error("expected createRuntimeClient to throw");
    };

    expect(capture("unknown")).toMatchObject({
      type: ApiClientErrorType.Configuration,
      code: ApiClientErrorCode.InvalidConfig,
    });
    expect(capture("metadata-only")).toMatchObject({ code: ApiClientErrorCode.EndpointNotFound });
  });
});
