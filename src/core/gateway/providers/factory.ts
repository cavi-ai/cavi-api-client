import { GatewayAgentConfigApiClient } from "../agent/config.js";
import { GatewayApiClient } from "../client/client.js";
import { GatewayMediaApiClient } from "../resources/media.js";
import { GatewaySseRunEventProvider } from "../run/sse-run-event-provider.js";
import { GatewayWikiApiClient } from "../resources/wiki.js";
import { GatewayWebSocketClient } from "../../ws/index.js";
import type { HttpApiClientOptions } from "../../http/types.js";
import { resolveGatewayProviderModule } from "./registry.js";
import type {
  CreateGatewaySseRunEventProviderOptions,
  GatewayProviderKind,
  ResolveGatewayProviderOptions,
} from "./types.js";
import type { GatewayWebSocketClientOptions } from "../../ws/index.js";

export function resolveGatewayProviderKind(
  options: ResolveGatewayProviderOptions = {},
): GatewayProviderKind {
  return resolveGatewayProviderModule(options)?.kind ?? "gateway";
}

export function createGatewayApiClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayApiClient {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createApiClient?.(clientOptions) ?? new GatewayApiClient(clientOptions);
}

export function createGatewayWebSocketClient(
  wsUrl: string,
  authToken: string | null,
  clientOptions: GatewayWebSocketClientOptions = {},
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayWebSocketClient {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createWebSocketClient?.(wsUrl, authToken, clientOptions) ??
    new GatewayWebSocketClient(wsUrl, authToken, clientOptions);
}

export const createGatewayRpcClient = createGatewayWebSocketClient;

export function createGatewaySseRunEventProvider(
  options: CreateGatewaySseRunEventProviderOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewaySseRunEventProvider {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createSseRunEventProvider?.(options) ??
    new GatewaySseRunEventProvider(options);
}

export function createGatewayMediaClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayMediaApiClient {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createMediaClient?.(clientOptions) ??
    new GatewayMediaApiClient(clientOptions);
}

export function createGatewayWikiClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayWikiApiClient {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createWikiClient?.(clientOptions) ??
    new GatewayWikiApiClient(clientOptions);
}

export function createGatewayAgentConfigClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayAgentConfigApiClient {
  const provider = resolveGatewayProviderModule(providerOptions);
  return provider?.createAgentConfigClient?.(clientOptions) ??
    new GatewayAgentConfigApiClient(clientOptions);
}
