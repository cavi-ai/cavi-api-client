// CAVI-specific env composition. Owns the CAVI/library env-var names and the
// CAVI defaults (local gateway URL, "cavi-api-client" client id). It composes
// the gateway-agnostic core primitive (resolveHttpSurfaceConfigFromEnv) once
// per surface — core stays free of any CAVI naming.

import {
  resolveHttpSurfaceConfigFromEnv,
  type HttpApiEnvSource,
  type HttpApiSurfaceConfig,
} from "../../../core/env/config.js";

const CAVI_DEFAULT_BASE_URL = "http://127.0.0.1:8787";
const CAVI_DEFAULT_CLIENT_ID = "cavi-api-client";

export const HTTP_API_CLIENT_ENV_KEYS = {
  caviBaseUrl: "CAVI_API_BASE_URL",
  caviAuthToken: "CAVI_API_AUTH_TOKEN",
  caviClientId: "CAVI_API_CLIENT_ID",
  gatewayBaseUrl: "GATEWAY_API_BASE_URL",
  gatewayAuthToken: "GATEWAY_API_AUTH_TOKEN",
  gatewayClientId: "GATEWAY_API_CLIENT_ID",
  libraryBaseUrl: "LIBRARY_API_BASE_URL",
  libraryAuthToken: "LIBRARY_API_AUTH_TOKEN",
  libraryClientId: "LIBRARY_API_CLIENT_ID",
} as const;

export const HTTP_API_CLIENT_ENV_ALIASES = {
  caviBaseUrl: ["EXPO_PUBLIC_CAVI_API_BASE_URL", "EXPO_PUBLIC_CAVI_CONTROL_COMPAT_BASE_URL", "VITE_CAVI_API_BASE_URL"],
  caviAuthToken: ["EXPO_PUBLIC_CAVI_API_AUTH_TOKEN", "EXPO_PUBLIC_GATEWAY_TOKEN", "VITE_CAVI_API_AUTH_TOKEN"],
  caviClientId: ["EXPO_PUBLIC_CAVI_API_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_CLIENT_ID", "VITE_CAVI_API_CLIENT_ID"],
  gatewayBaseUrl: ["EXPO_PUBLIC_GATEWAY_API_BASE_URL", "VITE_GATEWAY_API_BASE_URL"],
  gatewayAuthToken: ["EXPO_PUBLIC_GATEWAY_TOKEN", "EXPO_PUBLIC_GATEWAY_API_AUTH_TOKEN", "VITE_GATEWAY_API_AUTH_TOKEN"],
  gatewayClientId: ["EXPO_PUBLIC_GATEWAY_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_API_CLIENT_ID", "VITE_GATEWAY_API_CLIENT_ID"],
  libraryBaseUrl: ["EXPO_PUBLIC_LIBRARY_API_BASE_URL", "EXPO_PUBLIC_CAVI_LIBRARY_API_BASE_URL", "VITE_LIBRARY_API_BASE_URL"],
  libraryAuthToken: ["EXPO_PUBLIC_LIBRARY_API_AUTH_TOKEN", "EXPO_PUBLIC_GATEWAY_TOKEN", "VITE_LIBRARY_API_AUTH_TOKEN"],
  libraryClientId: ["EXPO_PUBLIC_LIBRARY_API_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_CLIENT_ID", "VITE_LIBRARY_API_CLIENT_ID"],
} as const;

export type HttpApiResolvedConfig = {
  cavi: HttpApiSurfaceConfig;
  gateway: HttpApiSurfaceConfig;
  library: HttpApiSurfaceConfig;
};

export type ResolveHttpApiConfigOptions = {
  defaults?: Partial<HttpApiResolvedConfig>;
  trimValues?: boolean;
  includeAliases?: boolean;
};

export function resolveHttpApiConfigFromEnv(
  env: HttpApiEnvSource,
  options: ResolveHttpApiConfigOptions = {},
): HttpApiResolvedConfig {
  const { trimValues, includeAliases, defaults } = options;
  const surfaceOptions = { trimValues, includeAliases };

  const cavi = resolveHttpSurfaceConfigFromEnv(
    env,
    {
      keys: {
        baseUrl: HTTP_API_CLIENT_ENV_KEYS.caviBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_KEYS.caviAuthToken,
        clientId: HTTP_API_CLIENT_ENV_KEYS.caviClientId,
      },
      aliases: {
        baseUrl: HTTP_API_CLIENT_ENV_ALIASES.caviBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_ALIASES.caviAuthToken,
        clientId: HTTP_API_CLIENT_ENV_ALIASES.caviClientId,
      },
      fallback: { baseUrl: CAVI_DEFAULT_BASE_URL, clientId: CAVI_DEFAULT_CLIENT_ID },
    },
    { ...surfaceOptions, defaults: defaults?.cavi },
  );

  const gateway = resolveHttpSurfaceConfigFromEnv(
    env,
    {
      keys: {
        baseUrl: HTTP_API_CLIENT_ENV_KEYS.gatewayBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_KEYS.gatewayAuthToken,
        clientId: HTTP_API_CLIENT_ENV_KEYS.gatewayClientId,
      },
      aliases: {
        baseUrl: HTTP_API_CLIENT_ENV_ALIASES.gatewayBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_ALIASES.gatewayAuthToken,
        clientId: HTTP_API_CLIENT_ENV_ALIASES.gatewayClientId,
      },
      fallback: { baseUrl: CAVI_DEFAULT_BASE_URL, clientId: CAVI_DEFAULT_CLIENT_ID },
    },
    { ...surfaceOptions, defaults: defaults?.gateway },
  );

  // Library falls back to the resolved CAVI surface (env → user defaults → CAVI).
  const library = resolveHttpSurfaceConfigFromEnv(
    env,
    {
      keys: {
        baseUrl: HTTP_API_CLIENT_ENV_KEYS.libraryBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_KEYS.libraryAuthToken,
        clientId: HTTP_API_CLIENT_ENV_KEYS.libraryClientId,
      },
      aliases: {
        baseUrl: HTTP_API_CLIENT_ENV_ALIASES.libraryBaseUrl,
        authToken: HTTP_API_CLIENT_ENV_ALIASES.libraryAuthToken,
        clientId: HTTP_API_CLIENT_ENV_ALIASES.libraryClientId,
      },
      fallback: { baseUrl: cavi.baseUrl, authToken: cavi.authToken, clientId: cavi.clientId },
    },
    { ...surfaceOptions, defaults: defaults?.library },
  );

  return { cavi, gateway, library };
}
