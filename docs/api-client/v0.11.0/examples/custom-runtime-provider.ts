import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeControlPlane,
  type RuntimeProviderModule,
} from "@cavi-ai/api-client";

const controlPlane: RuntimeControlPlane = {
  transports: {
    http: {
      kind: "http",
      stability: "stable",
      authenticated: true,
    },
  },
};

const customProvider: RuntimeProviderModule = {
  kind: "acme",
  capabilities: { runs: true },
  controlPlane: {
    transports: controlPlane.transports,
    modules: {},
  },
  createClient: () => ({
    getRuntimeCapabilities: async () => ({ providerKind: "acme", supports: { runs: true } }),
    startRun: async () => ({ run_id: "acme-run", status: "started" }),
  }),
  createControlPlane: () => controlPlane,
};

export const customClient = createRuntimeClient("acme", {
  registry: createRuntimeProviderRegistry({ modules: [customProvider] }),
  clientOptions: { baseUrl: "https://runtime.acme.example" },
});

export const customControlPlane = customProvider.createControlPlane?.({
  baseUrl: "https://runtime.acme.example",
});
