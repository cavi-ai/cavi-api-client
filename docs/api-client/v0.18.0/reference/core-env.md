# @cavi-ai/api-client/core/env

Package subpath: ./core/env

<a id="symbol-core-env-global-repo-root-key"></a>

## GLOBAL_REPO_ROOT_KEY

Kind: variable

```ts
export declare const GLOBAL_REPO_ROOT_KEY: "__CAVI_REPO_ROOT__";
```

<a id="symbol-core-env-httpapienvsource"></a>

## HttpApiEnvSource

Kind: type

```ts
export type HttpApiEnvSource = Record<string, string | undefined>;
```

<a id="symbol-core-env-httpapisurfaceconfig"></a>

## HttpApiSurfaceConfig

Kind: type

```ts
export type HttpApiSurfaceConfig = {
    baseUrl: string;
    authToken: string | null;
    clientId: string;
};
```

<a id="symbol-core-env-httpsurfaceenvaliases"></a>

## HttpSurfaceEnvAliases

Kind: type

```ts
/** Fallback env-var names checked (in order) when the primary key is unset. */
export type HttpSurfaceEnvAliases = {
    baseUrl?: readonly string[];
    authToken?: readonly string[];
    clientId?: readonly string[];
};
```

<a id="symbol-core-env-httpsurfaceenvfallback"></a>

## HttpSurfaceEnvFallback

Kind: type

```ts
/** Last-resort values used when neither the primary nor any alias env var is set. */
export type HttpSurfaceEnvFallback = {
    baseUrl: string;
    authToken?: string | null;
    clientId: string;
};
```

<a id="symbol-core-env-httpsurfaceenvkeys"></a>

## HttpSurfaceEnvKeys

Kind: type

```ts
/** Primary env-var names for one HTTP surface. */
export type HttpSurfaceEnvKeys = {
    baseUrl: string;
    authToken: string;
    clientId: string;
};
```

<a id="symbol-core-env-httpsurfaceenvspec"></a>

## HttpSurfaceEnvSpec

Kind: type

```ts
export type HttpSurfaceEnvSpec = {
    keys: HttpSurfaceEnvKeys;
    aliases?: HttpSurfaceEnvAliases;
    fallback: HttpSurfaceEnvFallback;
};
```

<a id="symbol-core-env-repo-root-env-key"></a>

## REPO_ROOT_ENV_KEY

Kind: variable

```ts
export declare const REPO_ROOT_ENV_KEY: "REPO_ROOT";
```

<a id="symbol-core-env-reporootenv"></a>

## RepoRootEnv

Kind: type

```ts
export type RepoRootEnv = Record<string, string | undefined>;
```

<a id="symbol-core-env-requirereporoot"></a>

## requireRepoRoot

Kind: function

```ts
export declare function requireRepoRoot(options?: ResolveRepoRootOptions): string;
```

<a id="symbol-core-env-resolvehttpsurfaceconfigfromenv"></a>

## resolveHttpSurfaceConfigFromEnv

Kind: function

```ts
/**
 * Resolve a single HTTP surface's config from an env bag.
 * Precedence per field: primary key → aliases → caller `defaults` → spec `fallback`.
 */
export declare function resolveHttpSurfaceConfigFromEnv(env: HttpApiEnvSource, spec: HttpSurfaceEnvSpec, options?: ResolveHttpSurfaceConfigOptions): HttpApiSurfaceConfig;
```

<a id="symbol-core-env-resolvehttpsurfaceconfigoptions"></a>

## ResolveHttpSurfaceConfigOptions

Kind: type

```ts
export type ResolveHttpSurfaceConfigOptions = {
    defaults?: Partial<HttpApiSurfaceConfig>;
    trimValues?: boolean;
    includeAliases?: boolean;
};
```

<a id="symbol-core-env-resolvereporoot"></a>

## resolveRepoRoot

Kind: function

```ts
export declare function resolveRepoRoot(options?: ResolveRepoRootOptions): string | null;
```

<a id="symbol-core-env-resolvereporootoptions"></a>

## ResolveRepoRootOptions

Kind: type

```ts
export type ResolveRepoRootOptions = {
    repoRoot?: string | null;
    env?: RepoRootEnv;
    globalRepoRoot?: string | null;
};
```
