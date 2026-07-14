import { createRuntimeProviderRegistry } from "../../../core/runtime/providers/registry.js";
import type {
  RuntimeControlClientFactory,
  RuntimeProviderRegistry,
} from "../../../core/runtime/providers/types.js";
import {
  createHermesRuntimeControlClient,
  type HermesCaviRuntimeControlOptions,
} from "./hermes/runtime-control-client.js";

export interface CaviRuntimeControlProviderOptions {
  hermes?: HermesCaviRuntimeControlOptions;
}

export function withCaviRuntimeControlProviders(
  base: RuntimeProviderRegistry,
  options: CaviRuntimeControlProviderOptions = {},
): RuntimeProviderRegistry {
  const resolvedHermes = base.resolveProvider("hermes");
  const hermesOptions = { ...(options.hermes ?? {}) };
  const createRuntimeControlClient: RuntimeControlClientFactory = (coreOptions) =>
    createHermesRuntimeControlClient({
      ...hermesOptions,
      ...coreOptions,
    });
  const modules = base.listProviders().map((module) =>
    module === resolvedHermes
      ? { ...module, createRuntimeControlClient }
      : module
  );

  return createRuntimeProviderRegistry({ modules, allowOverrides: true });
}
