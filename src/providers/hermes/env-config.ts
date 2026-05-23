import {
  resolveHttpSurfaceConfigFromEnv,
  type HttpApiEnvSource,
  type HttpApiSurfaceConfig,
} from "../../core/env/config.js";

export const HERMES_HTTP_API_ENV_KEYS = {
  baseUrl: "HERMES_API_BASE_URL",
  authToken: "HERMES_API_AUTH_TOKEN",
  clientId: "HERMES_API_CLIENT_ID",
} as const;

export const HERMES_HTTP_API_ENV_ALIASES = {
  baseUrl: [
    "EXPO_PUBLIC_HERMES_API_BASE_URL",
    "VITE_HERMES_API_BASE_URL",
    "GATEWAY_API_BASE_URL",
    "EXPO_PUBLIC_GATEWAY_API_BASE_URL",
    "VITE_GATEWAY_API_BASE_URL",
  ],
  authToken: [
    "EXPO_PUBLIC_HERMES_API_AUTH_TOKEN",
    "VITE_HERMES_API_AUTH_TOKEN",
    "GATEWAY_API_AUTH_TOKEN",
    "EXPO_PUBLIC_GATEWAY_TOKEN",
    "EXPO_PUBLIC_GATEWAY_API_AUTH_TOKEN",
    "VITE_GATEWAY_API_AUTH_TOKEN",
  ],
  clientId: [
    "EXPO_PUBLIC_HERMES_API_CLIENT_ID",
    "VITE_HERMES_API_CLIENT_ID",
    "GATEWAY_API_CLIENT_ID",
    "EXPO_PUBLIC_GATEWAY_CLIENT_ID",
    "EXPO_PUBLIC_GATEWAY_API_CLIENT_ID",
    "VITE_GATEWAY_API_CLIENT_ID",
  ],
} as const;

export type ResolveHermesHttpApiConfigOptions = {
  defaults?: Partial<HttpApiSurfaceConfig>;
  trimValues?: boolean;
  includeAliases?: boolean;
};

export function resolveHermesHttpApiConfigFromEnv(
  env: HttpApiEnvSource,
  options: ResolveHermesHttpApiConfigOptions = {},
): HttpApiSurfaceConfig {
  return resolveHttpSurfaceConfigFromEnv(
    env,
    {
      keys: HERMES_HTTP_API_ENV_KEYS,
      aliases: HERMES_HTTP_API_ENV_ALIASES,
      fallback: { baseUrl: "http://127.0.0.1:8787", clientId: "cavi-api-client" },
    },
    options,
  );
}
