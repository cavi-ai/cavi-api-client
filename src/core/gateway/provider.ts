export type GatewayProviderKind = "gateway" | (string & {});

export const GATEWAY_PROVIDER_ENV_KEYS = [
  "CAVI_GATEWAY_PROVIDER",
  "GATEWAY_PROVIDER",
] as const;

export type GatewayProviderEnv = Record<string, string | undefined>;

export type ResolveGatewayProviderOptions = {
  provider?: GatewayProviderKind | "generic" | string | null;
  env?: GatewayProviderEnv;
  defaultProvider?: GatewayProviderKind | "generic" | string;
};

function normalizeGatewayProviderKind(
  value: string | null | undefined,
): GatewayProviderKind | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  return normalized === "generic" ? "gateway" : normalized;
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

  return normalizeGatewayProviderKind(options.defaultProvider ?? null) ?? "gateway";
}
