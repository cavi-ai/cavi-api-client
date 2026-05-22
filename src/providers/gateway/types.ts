import type { GatewayAgentConfigApiClient } from "../../core/gateway/agent/config.js";
import type { GatewayApiClient } from "../../core/gateway/client.js";
import type { GatewayMediaApiClient } from "../../core/gateway/media.js";
import type {
  GatewaySseRunEventProvider,
  GatewaySseRunEventProviderOptions,
} from "../../core/gateway/run/sse-run-event-provider.js";
import type { GatewayWikiApiClient } from "../../core/gateway/wiki.js";
import type { HttpApiClientOptions } from "../../core/http/types.js";
import type {
  GatewayWebSocketClient,
  GatewayWebSocketClientOptions,
} from "../../core/ws/index.js";

export type GatewayProviderKind =
  | "gateway"
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

export interface GatewayProviderModule extends GatewayProviderFactories {
  kind: GatewayProviderKind;
  aliases?: readonly string[];
}

export interface GatewayProviderRegistry {
  resolveProvider(
    provider: string | null | undefined,
  ): GatewayProviderModule | null;
  listProviders(): readonly GatewayProviderModule[];
}

export type CreateGatewayProviderRegistryOptions = {
  modules?: readonly GatewayProviderModule[] | null;
  includeBuiltIns?: boolean;
  allowOverrides?: boolean;
};

export type ResolveGatewayProviderOptions = {
  provider?: GatewayProviderKind | string | null;
  env?: GatewayProviderEnv;
  defaultProvider?: GatewayProviderKind | string;
  registry?: GatewayProviderRegistry | null;
  providerModules?: readonly GatewayProviderModule[] | null;
  allowProviderOverrides?: boolean;
};
