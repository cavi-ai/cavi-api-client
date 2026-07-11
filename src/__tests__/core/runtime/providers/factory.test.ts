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
    const registry = createRuntimeProviderRegistry({ modules: [provider] });
    const clientOptions = { baseUrl: "https://runtime.example" };

    expect(createRuntimeClient("acme", { registry, clientOptions })).toBe(client);
    expect(received).toEqual(clientOptions);
  });

  it("supports legacy createApiClient modules", () => {
    const provider: RuntimeProviderModule = {
      kind: "legacy",
      capabilities: { runs: true },
      createApiClient: () => client,
    };
    const registry = createRuntimeProviderRegistry({ modules: [provider] });

    expect(
      createRuntimeClient("legacy", {
        registry,
        clientOptions: { baseUrl: "https://runtime.example" },
      }),
    ).toBe(client);
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
