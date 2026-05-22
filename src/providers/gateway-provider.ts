import { GatewayApiClient } from "../core/gateway/client.js";
import { GatewayMediaApiClient } from "../core/gateway/media.js";
import { GatewayRpcClient, type GatewayRpcClientOptions } from "../core/gateway/rpc.js";
import {
  GatewaySseRunEventProvider,
  type GatewaySseRunEventProviderOptions,
} from "../core/gateway/sse-run-event-provider.js";
import { GatewayWikiApiClient } from "../core/gateway/wiki.js";
import { HermesApiClient } from "./hermes/client.js";
import { HermesMediaApiClient } from "./hermes/media.js";
import { HermesSseRunEventProvider } from "./hermes/sse-run-event-provider.js";
import { HermesWebSocketClient } from "./hermes/websocket.js";
import { HermesWikiApiClient } from "./hermes/wiki.js";
import { OpenClawApiClient } from "./openclaw/client.js";
import { OpenClawMediaApiClient } from "./openclaw/media.js";
import { OpenClawSseRunEventProvider } from "./openclaw/sse-run-event-provider.js";
import { OpenClawWebSocketClient } from "./openclaw/websocket.js";
import { OpenClawWikiApiClient } from "./openclaw/wiki.js";
import type { HttpApiClientOptions } from "../core/http/types.js";

export type GatewayProviderKind = "gateway" | "hermes" | "openclaw";

export const GATEWAY_PROVIDER_ENV_KEYS = [
  "CAVI_GATEWAY_PROVIDER",
  "GATEWAY_PROVIDER",
] as const;

export type GatewayProviderEnv = Record<string, string | undefined>;

export type ResolveGatewayProviderOptions = {
  provider?: GatewayProviderKind | string | null;
  env?: GatewayProviderEnv;
  defaultProvider?: GatewayProviderKind;
};

function normalizeGatewayProviderKind(
  value: string | null | undefined,
): GatewayProviderKind | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "gateway" || normalized === "generic") return "gateway";
  if (normalized === "hermes" || normalized === "hermes-api-server") return "hermes";
  if (normalized === "openclaw" || normalized === "open-claw") return "openclaw";
  throw new Error(`Unknown gateway provider "${value}"`);
}

export function resolveGatewayProviderKind(
  options: ResolveGatewayProviderOptions = {},
): GatewayProviderKind {
  const explicit = normalizeGatewayProviderKind(options.provider ?? null);
  if (explicit) return explicit;

  for (const key of GATEWAY_PROVIDER_ENV_KEYS) {
    const fromEnv = normalizeGatewayProviderKind(options.env?.[key]);
    if (fromEnv) return fromEnv;
  }

  return options.defaultProvider ?? "gateway";
}

export function createGatewayApiClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayApiClient {
  const provider = resolveGatewayProviderKind(providerOptions);
  if (provider === "hermes") {
    return new HermesApiClient(clientOptions);
  }
  if (provider === "openclaw") {
    return new OpenClawApiClient(clientOptions);
  }
  return new GatewayApiClient(clientOptions);
}

export function createGatewayWebSocketClient(
  wsUrl: string,
  authToken: string | null,
  clientOptions: GatewayRpcClientOptions = {},
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayRpcClient {
  const provider = resolveGatewayProviderKind(providerOptions);
  if (provider === "hermes") {
    return new HermesWebSocketClient(wsUrl, authToken, clientOptions);
  }
  if (provider === "openclaw") {
    return new OpenClawWebSocketClient(wsUrl, authToken, clientOptions);
  }
  return new GatewayRpcClient(wsUrl, authToken, clientOptions);
}

export const createGatewayRpcClient = createGatewayWebSocketClient;

export type CreateGatewaySseRunEventProviderOptions =
  GatewaySseRunEventProviderOptions & {
    sessionKey?: string;
  };

export function createGatewaySseRunEventProvider(
  options: CreateGatewaySseRunEventProviderOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewaySseRunEventProvider {
  const provider = resolveGatewayProviderKind(providerOptions);
  if (provider === "hermes") {
    const sessionKey = options.sessionKey?.trim();
    if (!sessionKey) {
      throw new Error("createGatewaySseRunEventProvider: Hermes requires sessionKey");
    }
    return new HermesSseRunEventProvider({ ...options, sessionKey });
  }
  if (provider === "openclaw") {
    return new OpenClawSseRunEventProvider(options);
  }
  return new GatewaySseRunEventProvider(options);
}

export function createGatewayMediaClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayMediaApiClient {
  const provider = resolveGatewayProviderKind(providerOptions);
  if (provider === "hermes") {
    return new HermesMediaApiClient(clientOptions);
  }
  if (provider === "openclaw") {
    return new OpenClawMediaApiClient(clientOptions);
  }
  return new GatewayMediaApiClient(clientOptions);
}

export function createGatewayWikiClient(
  clientOptions: HttpApiClientOptions,
  providerOptions: ResolveGatewayProviderOptions = {},
): GatewayWikiApiClient {
  const provider = resolveGatewayProviderKind(providerOptions);
  if (provider === "hermes") {
    return new HermesWikiApiClient(clientOptions);
  }
  if (provider === "openclaw") {
    return new OpenClawWikiApiClient(clientOptions);
  }
  return new GatewayWikiApiClient(clientOptions);
}
