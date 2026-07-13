# @cavi-ai/api-client/core/runtime/providers

Package subpath: ./core/runtime/providers

<a id="symbol-core-runtime-providers-createproviderregistry"></a>

## createProviderRegistry

Kind: function

```ts
export declare function createProviderRegistry<M extends RuntimeProviderModule>(options?: CreateRuntimeProviderRegistryOptions<M>): RuntimeProviderRegistry<M>;
```

<a id="symbol-core-runtime-providers-createruntimeclient"></a>

## createRuntimeClient

Kind: function

```ts
export declare function createRuntimeClient(provider: string, options: CreateRuntimeClientOptions): RuntimeClient;
```

<a id="symbol-core-runtime-providers-createruntimeclientoptions"></a>

## CreateRuntimeClientOptions

Kind: type

```ts
export type CreateRuntimeClientOptions = {
    registry: RuntimeProviderRegistry;
    clientOptions: RuntimeClientOptions;
};
```

<a id="symbol-core-runtime-providers-createruntimeproviderregistry"></a>

## createRuntimeProviderRegistry

Kind: function

```ts
export declare function createRuntimeProviderRegistry(options?: CreateRuntimeProviderRegistryOptions): RuntimeProviderRegistry;
```

<a id="symbol-core-runtime-providers-createruntimeproviderregistryoptions"></a>

## CreateRuntimeProviderRegistryOptions

Kind: type

```ts
export type CreateRuntimeProviderRegistryOptions<M extends RuntimeProviderModule = RuntimeProviderModule> = {
    modules?: readonly M[] | null;
    allowOverrides?: boolean;
};
```

<a id="symbol-core-runtime-providers-normalizeruntimeprovidertoken"></a>

## normalizeRuntimeProviderToken

Kind: function

```ts
export declare function normalizeRuntimeProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-core-runtime-providers-runtimeclientoptions"></a>

## RuntimeClientOptions

Kind: type

```ts
export type RuntimeClientOptions = Pick<HttpApiClientOptions, "baseUrl" | "fetchImpl" | "onTrace">;
```

<a id="symbol-core-runtime-providers-runtimecontrolplanedeclaration"></a>

## RuntimeControlPlaneDeclaration

Kind: type

```ts
export type RuntimeControlPlaneDeclaration = {
    transports?: RuntimeTransportCapabilities;
    modules?: Partial<Record<"sessions" | "models" | "usage" | "tasks" | "workspace" | "authStatus" | "events", true>>;
};
```

<a id="symbol-core-runtime-providers-runtimeprovidermodule"></a>

## RuntimeProviderModule

Kind: interface

```ts
export interface RuntimeProviderModule {
    kind: string;
    aliases?: readonly string[];
    capabilities?: Partial<Record<RuntimeSurface, boolean>>;
    controlPlane?: RuntimeControlPlaneDeclaration;
    createClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
    createControlPlane?: (clientOptions: RuntimeClientOptions) => RuntimeControlPlane;
    /** @deprecated Use createClient for new provider modules. */
    createApiClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
}
```

<a id="symbol-core-runtime-providers-runtimeproviderregistry"></a>

## RuntimeProviderRegistry

Kind: interface

```ts
export interface RuntimeProviderRegistry<M extends RuntimeProviderModule = RuntimeProviderModule> {
    resolveProvider(provider: string | null | undefined): M | null;
    listProviders(): readonly M[];
}
```
