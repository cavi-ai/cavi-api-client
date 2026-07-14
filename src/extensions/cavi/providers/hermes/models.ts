import type { ModelCatalogClient, RuntimeModelDescriptor } from "../../../../core/runtime/control-plane/models.js";
import type { HermesDashboardRestClient } from "./dashboard-rest.js";

type ModelProvider = {
  slug: string;
  name: string;
  models: readonly string[];
  is_current: boolean;
  is_user_defined: boolean;
  source: string;
};

export function createHermesModelCatalogClient(rest: HermesDashboardRestClient): ModelCatalogClient {
  return {
    async listModels() {
      const payload = await rest.getModels();
      const currentProvider = typeof payload.provider === "string" ? payload.provider : "";
      const currentModel = typeof payload.model === "string" ? payload.model : "";
      const data = (payload.providers as readonly ModelProvider[]).flatMap((provider) =>
        provider.models.map((model): RuntimeModelDescriptor => ({
          providerId: provider.slug,
          id: model,
          displayName: model,
          availability: "available",
          authenticated: provider.is_current,
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
        })),
      );
      return { data };
    },
  };
}
