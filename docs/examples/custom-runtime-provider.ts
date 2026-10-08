import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeProviderModule,
} from "@cavi-ai/api-client";
import type { RuntimeClientOptions } from "@cavi-ai/api-client/core/runtime/providers";

// The application supplies a module with real transports and declared capabilities.
export function connectCustomRuntime(module: RuntimeProviderModule, clientOptions: RuntimeClientOptions) {
  const registry = createRuntimeProviderRegistry({ modules: [module] });
  return createRuntimeClient(module.kind, { registry, clientOptions });
}
