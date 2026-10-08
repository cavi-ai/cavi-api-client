import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeClient,
  type RuntimeProviderModule,
} from "@cavi-ai/api-client";

// Supply your real request/mapping implementation; this adapter does not invent a run.
export function createCustomRuntime(baseUrl: string, startRun: RuntimeClient["startRun"]) {
  const module: RuntimeProviderModule = {
    kind: "acme",
    capabilities: { runs: true },
    createClient: () => ({
      getRuntimeCapabilities: async () => ({ providerKind: "acme", supports: { runs: true } }),
      startRun,
    }),
  };
  return createRuntimeClient(module.kind, {
    registry: createRuntimeProviderRegistry({ modules: [module] }),
    clientOptions: { baseUrl },
  });
}
