import type { HttpApiClientOptions } from "../../http/types.js";
import type { RuntimeSurface } from "../capabilities.js";
import type { RuntimeClient } from "../client.js";
import type { RuntimeControlClient } from "../control-plane/runtime-control-client.js";
import type { RuntimeTransportCapabilities } from "../control-plane/transports.js";
import type { TransportAuthResolver, TransportLifecycleEvent, TransportRetryPolicy } from "../../transport/types.js";
import type { GatewayRpcClientOptions } from "../../gateway/rpc/client.js";

type GatewayTransport = unknown;

export type RuntimeClientOptions = Pick<
  HttpApiClientOptions,
  | "baseUrl"
  | "fetchImpl"
  | "onTrace"
  | "defaultTimeoutMs"
  | "cache"
  | "credentials"
>;

export type RuntimeControlPlaneDeclaration = {
  transports?: RuntimeTransportCapabilities;
  modules?: Partial<
    Record<
      "sessions" | "models" | "usage" | "tasks" | "workspace" | "authStatus" | "events",
      true
    >
  >;
};

export interface RuntimeProviderModule {
  kind: string;
  aliases?: readonly string[];
  capabilities?: Partial<Record<RuntimeSurface, boolean>>;
  controlPlane?: RuntimeControlPlaneDeclaration;
  createClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
  createRuntimeControlClient?: RuntimeControlClientFactory;
  /** @deprecated Use createClient for new provider modules. */
  createApiClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
}

export type RuntimeControlClientOptions = {
  baseUrl?: string;
  webSocketUrl?: string;
  token?: string;
  resolveAuth?: TransportAuthResolver;
  signal?: AbortSignal;
  trace?: (event: TransportLifecycleEvent) => void;
  /** Provider-neutral gateway handshake and request settings for an owned connection. */
  gatewayConnection?: GatewayRpcClientOptions;
  /** Opt-in bounded retry policy for reconnecting an owned gateway after a retryable drop. */
  gatewayReconnect?: TransportRetryPolicy;
  transport?: GatewayTransport;
  registry?: RuntimeProviderRegistry;
};

export type RuntimeControlClientFactory = (
  options: RuntimeControlClientOptions,
) => Promise<RuntimeControlClient>;

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
