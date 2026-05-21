export const HTTP_API_CLIENT_ENV_KEYS = {
  caviBaseUrl: "CAVI_API_BASE_URL",
  caviAuthToken: "CAVI_API_AUTH_TOKEN",
  caviClientId: "CAVI_API_CLIENT_ID",
  gatewayBaseUrl: "GATEWAY_API_BASE_URL",
  gatewayAuthToken: "GATEWAY_API_AUTH_TOKEN",
  gatewayClientId: "GATEWAY_API_CLIENT_ID",
  hermesBaseUrl: "HERMES_API_BASE_URL",
  hermesAuthToken: "HERMES_API_AUTH_TOKEN",
  hermesClientId: "HERMES_API_CLIENT_ID",
  libraryBaseUrl: "LIBRARY_API_BASE_URL",
  libraryAuthToken: "LIBRARY_API_AUTH_TOKEN",
  libraryClientId: "LIBRARY_API_CLIENT_ID",
} as const;

export const HTTP_API_CLIENT_ENV_ALIASES = {
  caviBaseUrl: ["EXPO_PUBLIC_CAVI_API_BASE_URL", "EXPO_PUBLIC_CAVI_CONTROL_COMPAT_BASE_URL", "VITE_CAVI_API_BASE_URL"],
  caviAuthToken: ["EXPO_PUBLIC_CAVI_API_AUTH_TOKEN", "EXPO_PUBLIC_GATEWAY_TOKEN", "VITE_CAVI_API_AUTH_TOKEN"],
  caviClientId: ["EXPO_PUBLIC_CAVI_API_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_CLIENT_ID", "VITE_CAVI_API_CLIENT_ID"],
  gatewayBaseUrl: ["EXPO_PUBLIC_GATEWAY_API_BASE_URL", "VITE_GATEWAY_API_BASE_URL", "EXPO_PUBLIC_HERMES_API_BASE_URL", "VITE_HERMES_API_BASE_URL"],
  gatewayAuthToken: ["EXPO_PUBLIC_GATEWAY_TOKEN", "EXPO_PUBLIC_GATEWAY_API_AUTH_TOKEN", "VITE_GATEWAY_API_AUTH_TOKEN", "EXPO_PUBLIC_HERMES_API_AUTH_TOKEN", "VITE_HERMES_API_AUTH_TOKEN"],
  gatewayClientId: ["EXPO_PUBLIC_GATEWAY_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_API_CLIENT_ID", "VITE_GATEWAY_API_CLIENT_ID", "EXPO_PUBLIC_HERMES_API_CLIENT_ID", "VITE_HERMES_API_CLIENT_ID"],
  hermesBaseUrl: ["EXPO_PUBLIC_HERMES_API_BASE_URL", "EXPO_PUBLIC_GATEWAY_API_BASE_URL", "VITE_HERMES_API_BASE_URL"],
  hermesAuthToken: ["EXPO_PUBLIC_HERMES_API_AUTH_TOKEN", "EXPO_PUBLIC_GATEWAY_TOKEN", "VITE_HERMES_API_AUTH_TOKEN"],
  hermesClientId: ["EXPO_PUBLIC_HERMES_API_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_CLIENT_ID", "VITE_HERMES_API_CLIENT_ID"],
  libraryBaseUrl: ["EXPO_PUBLIC_LIBRARY_API_BASE_URL", "EXPO_PUBLIC_CAVI_LIBRARY_API_BASE_URL", "VITE_LIBRARY_API_BASE_URL"],
  libraryAuthToken: ["EXPO_PUBLIC_LIBRARY_API_AUTH_TOKEN", "EXPO_PUBLIC_GATEWAY_TOKEN", "VITE_LIBRARY_API_AUTH_TOKEN"],
  libraryClientId: ["EXPO_PUBLIC_LIBRARY_API_CLIENT_ID", "EXPO_PUBLIC_GATEWAY_CLIENT_ID", "VITE_LIBRARY_API_CLIENT_ID"],
} as const;

export type HttpApiEnvSource = Record<string, string | undefined>;

export type HttpApiSurfaceConfig = {
  baseUrl: string;
  authToken: string | null;
  clientId: string;
};

export type HttpApiResolvedConfig = {
  cavi: HttpApiSurfaceConfig;
  gateway: HttpApiSurfaceConfig;
  hermes: HttpApiSurfaceConfig;
  library: HttpApiSurfaceConfig;
};

export type ResolveHttpApiConfigOptions = {
  defaults?: Partial<HttpApiResolvedConfig>;
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

export function resolveHttpApiConfigFromEnv(
  env: HttpApiEnvSource,
  options: ResolveHttpApiConfigOptions = {},
): HttpApiResolvedConfig {
  const trim = options.trimValues ?? true;
  const includeAliases = options.includeAliases ?? true;
  const defaults = options.defaults;

  const caviBaseUrl = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.caviBaseUrl, HTTP_API_CLIENT_ENV_ALIASES.caviBaseUrl, trim, includeAliases);
  const caviAuthToken = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.caviAuthToken, HTTP_API_CLIENT_ENV_ALIASES.caviAuthToken, trim, includeAliases);
  const caviClientId = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.caviClientId, HTTP_API_CLIENT_ENV_ALIASES.caviClientId, trim, includeAliases);

  const gatewayBaseUrl = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.gatewayBaseUrl, HTTP_API_CLIENT_ENV_ALIASES.gatewayBaseUrl, trim, includeAliases);
  const gatewayAuthToken = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.gatewayAuthToken, HTTP_API_CLIENT_ENV_ALIASES.gatewayAuthToken, trim, includeAliases);
  const gatewayClientId = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.gatewayClientId, HTTP_API_CLIENT_ENV_ALIASES.gatewayClientId, trim, includeAliases);

  const hermesBaseUrl = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.hermesBaseUrl, HTTP_API_CLIENT_ENV_ALIASES.hermesBaseUrl, trim, includeAliases);
  const hermesAuthToken = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.hermesAuthToken, HTTP_API_CLIENT_ENV_ALIASES.hermesAuthToken, trim, includeAliases);
  const hermesClientId = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.hermesClientId, HTTP_API_CLIENT_ENV_ALIASES.hermesClientId, trim, includeAliases);

  const libraryBaseUrl = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.libraryBaseUrl, HTTP_API_CLIENT_ENV_ALIASES.libraryBaseUrl, trim, includeAliases);
  const libraryAuthToken = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.libraryAuthToken, HTTP_API_CLIENT_ENV_ALIASES.libraryAuthToken, trim, includeAliases);
  const libraryClientId = firstEnvValue(env, HTTP_API_CLIENT_ENV_KEYS.libraryClientId, HTTP_API_CLIENT_ENV_ALIASES.libraryClientId, trim, includeAliases);

  return {
    cavi: {
      baseUrl: caviBaseUrl ?? defaults?.cavi?.baseUrl ?? "http://127.0.0.1:8787",
      authToken: cleanToken(caviAuthToken) ?? defaults?.cavi?.authToken ?? null,
      clientId: caviClientId ?? defaults?.cavi?.clientId ?? "cavi-api-client",
    },
    gateway: {
      baseUrl: gatewayBaseUrl ?? defaults?.gateway?.baseUrl ?? hermesBaseUrl ?? defaults?.hermes?.baseUrl ?? "http://127.0.0.1:8787",
      authToken: cleanToken(gatewayAuthToken) ?? defaults?.gateway?.authToken ?? cleanToken(hermesAuthToken) ?? defaults?.hermes?.authToken ?? null,
      clientId: gatewayClientId ?? defaults?.gateway?.clientId ?? hermesClientId ?? defaults?.hermes?.clientId ?? "cavi-api-client",
    },
    hermes: {
      baseUrl: hermesBaseUrl ?? defaults?.hermes?.baseUrl ?? gatewayBaseUrl ?? defaults?.gateway?.baseUrl ?? "http://127.0.0.1:8787",
      authToken: cleanToken(hermesAuthToken) ?? defaults?.hermes?.authToken ?? cleanToken(gatewayAuthToken) ?? defaults?.gateway?.authToken ?? null,
      clientId: hermesClientId ?? defaults?.hermes?.clientId ?? gatewayClientId ?? defaults?.gateway?.clientId ?? "cavi-api-client",
    },
    library: {
      baseUrl: libraryBaseUrl ?? defaults?.library?.baseUrl ?? caviBaseUrl ?? defaults?.cavi?.baseUrl ?? "http://127.0.0.1:8787",
      authToken: cleanToken(libraryAuthToken) ?? defaults?.library?.authToken ?? cleanToken(caviAuthToken) ?? defaults?.cavi?.authToken ?? null,
      clientId: libraryClientId ?? defaults?.library?.clientId ?? caviClientId ?? defaults?.cavi?.clientId ?? "cavi-api-client",
    },
  };
}
