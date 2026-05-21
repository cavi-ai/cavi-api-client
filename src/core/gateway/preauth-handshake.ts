// CANONICAL — single source of truth lives here. Do not duplicate. See packages/README.md.

/**
 * Keep token-only connect fallback **strictly before** the gateway pre-auth handshake
 * timeout. Parsing must stay aligned with `src/gateway/handshake-timeouts.ts`
 * (`getPreauthHandshakeTimeoutMsFromEnv`).
 *
 * **Deployment contract:** Node/electron clients can pick up `OPENCLAW_HANDSHAKE_TIMEOUT_MS`
 * from `process.env`. Browser bundles usually have no gateway env; if the gateway uses a
 * non-default handshake budget, pass the same value via `GatewayRpcClientOptions.preauthHandshakeTimeoutMs`
 * (or the matching React hook props). There is no automatic server→client discovery of that
 * budget today.
 */
export const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10_000;

const HANDSHAKE_SAFETY_MARGIN_MS = 2_000;
/** Leave at least this much room before the server closes the pre-auth window. */
const MIN_MS_BEFORE_SERVER_CLOSE = 250;
type GatewayHandshakeEnv = Readonly<{
  OPENCLAW_HANDSHAKE_TIMEOUT_MS?: string;
  OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS?: string;
  VITEST?: string;
}>;

/**
 * Resolves the effective pre-auth handshake deadline (same env keys as the gateway).
 * When `env` is omitted (typical browser), returns the default deadline unless the caller
 * passes `preauthHandshakeTimeoutMs` into `resolveDeviceTokenOnlyFallbackMs` / the RPC client.
 */
export function resolvePreauthHandshakeTimeoutMsFromEnv(env?: GatewayHandshakeEnv): number {
  if (!env) {
    return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
  }
  const configuredTimeout =
    env.OPENCLAW_HANDSHAKE_TIMEOUT_MS || (env.VITEST && env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS);
  if (configuredTimeout) {
    const parsed = Number(configuredTimeout);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS;
}

export type ResolveDeviceTokenOnlyFallbackMsParams = {
  env?: GatewayHandshakeEnv;
  /**
   * Gateway handshake budget (ms). Required for correct token-only timing in browsers when
   * the server sets `OPENCLAW_HANDSHAKE_TIMEOUT_MS` away from default; optional in Node if env matches.
   */
  preauthHandshakeTimeoutMs?: number;
};

/** Delay before sending `connect` without a nonce when device identity is enabled. */
export function resolveDeviceTokenOnlyFallbackMs(
  params?: ResolveDeviceTokenOnlyFallbackMsParams,
): number {
  const rawTimeout =
    typeof params?.preauthHandshakeTimeoutMs === "number" &&
    Number.isFinite(params.preauthHandshakeTimeoutMs) &&
    params.preauthHandshakeTimeoutMs > 0
      ? params.preauthHandshakeTimeoutMs
      : resolvePreauthHandshakeTimeoutMsFromEnv(params?.env);

  const preferred = Math.max(750, rawTimeout - HANDSHAKE_SAFETY_MARGIN_MS);
  const maxAllowed = Math.max(1, rawTimeout - MIN_MS_BEFORE_SERVER_CLOSE);
  return Math.min(preferred, maxAllowed);
}
