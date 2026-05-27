// Gateway-agnostic env resolution primitive. Core knows how to read a single
// HTTP surface's config from an env bag with primary keys + ordered aliases +
// caller-supplied fallbacks. It deliberately knows NOTHING about any specific
// domain, provider, or surface/env-var name or default — those live in the
// owning layer (extensions/cavi, providers/*) which composes this primitive.

export type HttpApiEnvSource = Record<string, string | undefined>;

export type HttpApiSurfaceConfig = {
  baseUrl: string;
  authToken: string | null;
  clientId: string;
};

/** Primary env-var names for one HTTP surface. */
export type HttpSurfaceEnvKeys = {
  baseUrl: string;
  authToken: string;
  clientId: string;
};

/** Fallback env-var names checked (in order) when the primary key is unset. */
export type HttpSurfaceEnvAliases = {
  baseUrl?: readonly string[];
  authToken?: readonly string[];
  clientId?: readonly string[];
};

/** Last-resort values used when neither the primary nor any alias env var is set. */
export type HttpSurfaceEnvFallback = {
  baseUrl: string;
  authToken?: string | null;
  clientId: string;
};

export type HttpSurfaceEnvSpec = {
  keys: HttpSurfaceEnvKeys;
  aliases?: HttpSurfaceEnvAliases;
  fallback: HttpSurfaceEnvFallback;
};

export type ResolveHttpSurfaceConfigOptions = {
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

/**
 * Resolve a single HTTP surface's config from an env bag.
 * Precedence per field: primary key → aliases → caller `defaults` → spec `fallback`.
 */
export function resolveHttpSurfaceConfigFromEnv(
  env: HttpApiEnvSource,
  spec: HttpSurfaceEnvSpec,
  options: ResolveHttpSurfaceConfigOptions = {},
): HttpApiSurfaceConfig {
  const trim = options.trimValues ?? true;
  const includeAliases = options.includeAliases ?? true;
  const defaults = options.defaults;

  const baseUrl = firstEnvValue(env, spec.keys.baseUrl, spec.aliases?.baseUrl ?? [], trim, includeAliases);
  const authToken = firstEnvValue(env, spec.keys.authToken, spec.aliases?.authToken ?? [], trim, includeAliases);
  const clientId = firstEnvValue(env, spec.keys.clientId, spec.aliases?.clientId ?? [], trim, includeAliases);

  return {
    baseUrl: baseUrl ?? defaults?.baseUrl ?? spec.fallback.baseUrl,
    authToken: cleanToken(authToken) ?? defaults?.authToken ?? spec.fallback.authToken ?? null,
    clientId: clientId ?? defaults?.clientId ?? spec.fallback.clientId,
  };
}
