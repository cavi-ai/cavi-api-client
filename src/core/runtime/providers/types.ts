import type { HttpApiClientOptions } from "../../http/types.js";
import type { RuntimeSurface } from "../capabilities.js";
import type { RuntimeClient } from "../client.js";

export type RuntimeClientOptions = Pick<
  HttpApiClientOptions,
  "baseUrl" | "fetchImpl" | "onTrace"
>;

export interface RuntimeProviderModule {
  kind: string;
  aliases?: readonly string[];
  capabilities?: Partial<Record<RuntimeSurface, boolean>>;
  createClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
  /** @deprecated Use createClient for new provider modules. */
  createApiClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
}

export interface RuntimeProviderRegistry<M extends RuntimeProviderModule = RuntimeProviderModule> {
  resolveProvider(provider: string | null | undefined): M | null;
  listProviders(): readonly M[];
}

export type CreateRuntimeProviderRegistryOptions<
  M extends RuntimeProviderModule = RuntimeProviderModule,
> = {
  modules?: readonly M[] | null;
  allowOverrides?: boolean;
};

export type CreateRuntimeClientOptions = {
  registry: RuntimeProviderRegistry;
  clientOptions: RuntimeClientOptions;
};
