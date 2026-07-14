import {
  createRuntimeControlClient as createCoreRuntimeControlClient,
} from "../core/runtime/providers/runtime-control-client-factory.js";
import type {
  RuntimeControlClientOptions,
} from "../core/runtime/providers/types.js";
import type { RuntimeControlClient } from "../core/runtime/control-plane/runtime-control-client.js";
import { createBuiltInRuntimeProviderRegistry } from "./runtime-provider-registry.js";

export function createRuntimeControlClient(
  provider: string,
  options: RuntimeControlClientOptions = {},
): Promise<RuntimeControlClient> {
  if (options.registry) {
    return createCoreRuntimeControlClient(provider, options);
  }
  return createCoreRuntimeControlClient(provider, {
    ...options,
    registry: createBuiltInRuntimeProviderRegistry(),
  });
}
