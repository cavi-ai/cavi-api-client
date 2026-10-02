import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeProviderModule,
} from "@cavi-ai/api-client";

const customProvider: RuntimeProviderModule = {
  kind: "acme",
  capabilities: { runs: true },
  createClient: () => ({
    getRuntimeCapabilities: async () => ({ providerKind: "acme", supports: { runs: true } }),
    startRun: async () => ({ run_id: "acme-run", status: "started" }),
  }),
};

export const customClient = createRuntimeClient("acme", {
  registry: createRuntimeProviderRegistry({ modules: [customProvider] }),
  clientOptions: { baseUrl: "https://runtime.acme.example" },
});
