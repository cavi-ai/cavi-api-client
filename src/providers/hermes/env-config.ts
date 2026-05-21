import type {
  HttpApiEnvSource,
  HttpApiSurfaceConfig,
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

function clean(value: string | undefined, trim: boolean): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = trim ? value.trim() : value;
  return cleaned || undefined;
}

function firstEnvValue(
  env: HttpApiEnvSource,
  primary: string,
  aliases: readonly string[],
  trim: boolean,
  includeAliases: boolean,
): string | undefined {
  const primaryValue = clean(env[primary], trim);
  if (primaryValue !== undefined) return primaryValue;
  if (!includeAliases) return undefined;
  for (const alias of aliases) {
    const value = clean(env[alias], trim);
    if (value !== undefined) return value;
  }
  return undefined;
}

function cleanToken(value: string | undefined): string | null {
  return value || null;
}

export function resolveHermesHttpApiConfigFromEnv(
  env: HttpApiEnvSource,
  options: ResolveHermesHttpApiConfigOptions = {},
): HttpApiSurfaceConfig {
  const trim = options.trimValues ?? true;
  const includeAliases = options.includeAliases ?? true;
  const defaults = options.defaults;

  const baseUrl = firstEnvValue(
    env,
    HERMES_HTTP_API_ENV_KEYS.baseUrl,
    HERMES_HTTP_API_ENV_ALIASES.baseUrl,
    trim,
    includeAliases,
  );
  const authToken = firstEnvValue(
    env,
    HERMES_HTTP_API_ENV_KEYS.authToken,
    HERMES_HTTP_API_ENV_ALIASES.authToken,
    trim,
    includeAliases,
  );
  const clientId = firstEnvValue(
    env,
    HERMES_HTTP_API_ENV_KEYS.clientId,
    HERMES_HTTP_API_ENV_ALIASES.clientId,
    trim,
    includeAliases,
  );

  return {
    baseUrl: baseUrl ?? defaults?.baseUrl ?? "http://127.0.0.1:8787",
    authToken: cleanToken(authToken) ?? defaults?.authToken ?? null,
    clientId: clientId ?? defaults?.clientId ?? "cavi-api-client",
  };
}
