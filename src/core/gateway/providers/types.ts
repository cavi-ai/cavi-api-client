import type { GatewayAgentConfigApiClient } from "../agent/config.js";
import type { GatewayApiClient } from "../client/client.js";
import type { GatewayMediaApiClient } from "../resources/media.js";
import type {
  GatewaySseRunEventProvider,
  GatewaySseRunEventProviderOptions,
} from "../run/sse-run-event-provider.js";
import type { GatewayWikiApiClient } from "../resources/wiki.js";
import type { HttpApiClientOptions } from "../../http/types.js";
import type {
  GatewayWebSocketClient,
  GatewayWebSocketClientOptions,
} from "../../ws/index.js";
import type { RuntimeClient } from "../../runtime/client.js";
import type { RuntimeSurface } from "../../runtime/capabilities.js";

export type GatewayProviderKind =
  | "hermes"
  | "openclaw"
  | (string & {});

export const GATEWAY_PROVIDER_ENV_KEYS = [
  "CAVI_GATEWAY_PROVIDER",
  "GATEWAY_PROVIDER",
] as const;

export type GatewayProviderEnv = Record<string, string | undefined>;

export type CreateGatewaySseRunEventProviderOptions =
  GatewaySseRunEventProviderOptions & {
    sessionKey?: string;
  };

export interface GatewayProviderFactories {
  createApiClient?: (clientOptions: HttpApiClientOptions) => GatewayApiClient;
  createWebSocketClient?: (
    wsUrl: string,
    authToken: string | null,
    clientOptions: GatewayWebSocketClientOptions,
  ) => GatewayWebSocketClient;
  createSseRunEventProvider?: (
    options: CreateGatewaySseRunEventProviderOptions,
  ) => GatewaySseRunEventProvider;
  createMediaClient?: (clientOptions: HttpApiClientOptions) => GatewayMediaApiClient;
  createWikiClient?: (clientOptions: HttpApiClientOptions) => GatewayWikiApiClient;
  createAgentConfigClient?: (
    clientOptions: HttpApiClientOptions,
  ) => GatewayAgentConfigApiClient;
}

/** The universal provider plugin. Every provider (incl. runtime-only ones) is one. */
export interface RuntimeProviderModule {
  kind: GatewayProviderKind;
  aliases?: readonly string[];
  capabilities?: Partial<Record<RuntimeSurface, boolean>>;
  createApiClient?: (clientOptions: HttpApiClientOptions) => RuntimeClient;
}

export interface GatewayProviderModule
  extends RuntimeProviderModule,
    GatewayProviderFactories {
  /** Gateway providers return the gateway-capable client. */
  createApiClient?: (clientOptions: HttpApiClientOptions) => GatewayApiClient;
}

export interface GatewayProviderRegistry {
  resolveProvider(
    provider: string | null | undefined,
  ): GatewayProviderModule | null;
  listProviders(): readonly GatewayProviderModule[];
}

export type CreateGatewayProviderRegistryOptions = {
  modules?: readonly GatewayProviderModule[] | null;
  allowOverrides?: boolean;
};

export type ResolveGatewayProviderOptions = {
  provider?: GatewayProviderKind | string | null;
  env?: GatewayProviderEnv;
  defaultProvider?: GatewayProviderKind | string | null;
  registry?: GatewayProviderRegistry | null;
  providerModules?: readonly GatewayProviderModule[] | null;
  allowProviderOverrides?: boolean;
};
