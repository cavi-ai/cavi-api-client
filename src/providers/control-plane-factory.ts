import {
  createRuntimeControlPlane as createCoreRuntimeControlPlane,
} from "../core/runtime/providers/control-plane-factory.js";
import type {
  CanonicalControlPlaneFactoryOptions,
} from "../core/runtime/providers/types.js";
import type { CanonicalRuntimeControlPlane } from "../core/runtime/control-plane/canonical.js";
import { createBuiltInRuntimeProviderRegistry } from "./runtime-provider-registry.js";

export function createRuntimeControlPlane(
  provider: string,
  options: CanonicalControlPlaneFactoryOptions = {},
): Promise<CanonicalRuntimeControlPlane> {
  if (options.registry) {
    return createCoreRuntimeControlPlane(provider, options);
  }
  return createCoreRuntimeControlPlane(provider, {
    ...options,
    registry: createBuiltInRuntimeProviderRegistry(),
  });
}
