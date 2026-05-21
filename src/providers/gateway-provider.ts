import { GatewayApiClient } from "../core/gateway/client.js";
import { HermesApiClient } from "./hermes/client.js";
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
  return new GatewayApiClient(
    clientOptions,
    provider === "openclaw" ? "openclaw-api" : "gateway-api",
  );
}
