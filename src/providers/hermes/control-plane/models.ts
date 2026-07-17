import type { ModelCatalogClient, RuntimeModelDescriptor } from "../../../core/runtime/control-plane/models.js";
import type { HermesDashboardRestClient } from "./dashboard-rest.js";

type ModelProvider = {
  slug: string;
  name: string;
  models: readonly string[];
  is_user_defined: boolean;
  source: string;
};

export function createHermesModelCatalogClient(rest: HermesDashboardRestClient): ModelCatalogClient {
  return {
    async listModels() {
      const payload = await rest.getModels();
      const currentProvider = typeof payload.provider === "string" ? payload.provider : "";
      const currentModel = typeof payload.model === "string" ? payload.model : "";
      const unique = new Map<string, RuntimeModelDescriptor>();
      for (const provider of payload.providers as readonly ModelProvider[]) {
        for (const model of provider.models) {
          const key = `${provider.slug}\u0000${model}`;
          if (unique.has(key)) continue;
          unique.set(key, {
            providerId: provider.slug,
            id: model,
            displayName: model,
            availability: "available",
            capabilities: {
              selected: provider.slug === currentProvider && model === currentModel,
              userDefined: provider.is_user_defined,
            },
            metadata: {
              provider: "hermes",
              stability: "experimental",
              source: { transport: "http", method: "models" },
              providerData: { providerDisplayName: provider.name, source: provider.source },
            },
          });
        }
      }
      return { data: [...unique.values()] };
    },
  };
}
