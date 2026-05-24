// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

/**
 * Keep token-only connect fallback strictly before the gateway pre-auth
 * handshake timeout. Core owns the timing math; providers and host apps own
 * gateway-specific env keys or explicit timeout overrides.
 */
export const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10_000;

const HANDSHAKE_SAFETY_MARGIN_MS = 2_000;
/** Leave at least this much room before the server closes the pre-auth window. */
const MIN_MS_BEFORE_SERVER_CLOSE = 250;

export type GatewayPreauthHandshakeEnv = Readonly<Record<string, string | undefined>>;

export type GatewayPreauthHandshakeEnvKeys = Readonly<{
  timeoutMs: string;
  testTimeoutMs?: string;
  testFlag?: string;
}>;

export const GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS: GatewayPreauthHandshakeEnvKeys = {
  timeoutMs: "GATEWAY_PREAUTH_HANDSHAKE_TIMEOUT_MS",
  testTimeoutMs: "GATEWAY_TEST_PREAUTH_HANDSHAKE_TIMEOUT_MS",
  testFlag: "VITEST",
};

export type ResolvePreauthHandshakeTimeoutMsParams = {
  env?: GatewayPreauthHandshakeEnv;
  envKeys?: GatewayPreauthHandshakeEnvKeys;
  preauthHandshakeTimeoutMs?: number;
};

type LegacyGatewayHandshakeEnv = Readonly<{
  GATEWAY_PREAUTH_HANDSHAKE_TIMEOUT_MS?: string;
  GATEWAY_TEST_PREAUTH_HANDSHAKE_TIMEOUT_MS?: string;
  VITEST?: string;
}>;

function parsePositiveMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function resolvePreauthHandshakeTimeoutMs(
  params: ResolvePreauthHandshakeTimeoutMsParams = {},
): number {
  if (
    typeof params.preauthHandshakeTimeoutMs === "number" &&
    Number.isFinite(params.preauthHandshakeTimeoutMs) &&
    params.preauthHandshakeTimeoutMs > 0
  ) {
    return params.preauthHandshakeTimeoutMs;
  }
  const env = params.env;
  if (!env) {
    return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
  }
  const keys = params.envKeys ?? GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS;
  const configuredTimeout = parsePositiveMs(env[keys.timeoutMs]);
  if (configuredTimeout) return configuredTimeout;
  const testFlag = keys.testFlag ? env[keys.testFlag] : undefined;
  const testTimeout = keys.testTimeoutMs && testFlag
    ? parsePositiveMs(env[keys.testTimeoutMs])
    : null;
  if (testTimeout) return testTimeout;
  return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}

/**
 * @deprecated Use resolvePreauthHandshakeTimeoutMs({ env }) with generic
 * gateway env keys, or pass provider-specific env keys explicitly.
 */
export function resolvePreauthHandshakeTimeoutMsFromEnv(
  env?: LegacyGatewayHandshakeEnv,
): number {
  return resolvePreauthHandshakeTimeoutMs({ env });
}

export type ResolveDeviceTokenOnlyFallbackMsParams = {
  env?: GatewayPreauthHandshakeEnv;
  envKeys?: GatewayPreauthHandshakeEnvKeys;
  /** Explicit gateway handshake budget in milliseconds. */
  preauthHandshakeTimeoutMs?: number;
};

/** Delay before sending `connect` without a nonce when device identity is enabled. */
export function resolveDeviceTokenOnlyFallbackMs(
  params?: ResolveDeviceTokenOnlyFallbackMsParams,
): number {
  const rawTimeout = resolvePreauthHandshakeTimeoutMs(params);

  const preferred = Math.max(750, rawTimeout - HANDSHAKE_SAFETY_MARGIN_MS);
  const maxAllowed = Math.max(1, rawTimeout - MIN_MS_BEFORE_SERVER_CLOSE);
  return Math.min(preferred, maxAllowed);
}
