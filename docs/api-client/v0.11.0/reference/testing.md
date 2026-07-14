# @cavi-ai/api-client/testing

Package subpath: ./testing

<a id="symbol-testing-inspectruntimeproviderconformance"></a>

## inspectRuntimeProviderConformance

Kind: function

```ts
export declare function inspectRuntimeProviderConformance(fixture: RuntimeProviderConformanceFixture): Promise<RuntimeProviderConformanceReport>;
```

<a id="symbol-testing-runtimeproviderconformancecheck"></a>

## RuntimeProviderConformanceCheck

Kind: type

```ts
export type RuntimeProviderConformanceCheck = {
    id: string;
    status: "pass" | "fail" | "skip";
    message: string;
};
```

<a id="symbol-testing-runtimeproviderconformancefixture"></a>

## RuntimeProviderConformanceFixture

Kind: type

```ts
export type RuntimeProviderConformanceFixture = {
    module: RuntimeProviderModule;
    clientOptions: RuntimeClientOptions;
};
```

<a id="symbol-testing-runtimeproviderconformancereport"></a>

## RuntimeProviderConformanceReport

Kind: type

```ts
export type RuntimeProviderConformanceReport = {
    providerKind: string;
    valid: boolean;
    checks: readonly RuntimeProviderConformanceCheck[];
};
```
