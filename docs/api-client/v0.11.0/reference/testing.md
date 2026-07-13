# @cavi-ai/api-client/testing

Package subpath: ./testing

<a id="symbol-testing-inspectkanbanconformance"></a>

## inspectKanbanConformance

Kind: function

```ts
/**
 * Exercise a KanbanClient's core methods and validate the canonical shape.
 *
 * NOTE: this MUTATES the target backend — it creates a card, updates and moves
 * it, then deletes it. Run it against a disposable board, not production data.
 */
export declare function inspectKanbanConformance(client: KanbanClient): Promise<KanbanConformanceReport>;
```

<a id="symbol-testing-inspectruntimecontrolplaneconformance"></a>

## inspectRuntimeControlPlaneConformance

Kind: function

```ts
export declare function inspectRuntimeControlPlaneConformance(fixture: RuntimeControlPlaneConformanceFixture): Promise<RuntimeControlPlaneConformanceReport>;
```

<a id="symbol-testing-inspectruntimeproviderconformance"></a>

## inspectRuntimeProviderConformance

Kind: function

```ts
export declare function inspectRuntimeProviderConformance(fixture: RuntimeProviderConformanceFixture): Promise<RuntimeProviderConformanceReport>;
```

<a id="symbol-testing-kanbanconformancecheck"></a>

## KanbanConformanceCheck

Kind: interface

```ts
export interface KanbanConformanceCheck {
    name: string;
    ok: boolean;
    detail?: string;
}
```

<a id="symbol-testing-kanbanconformancereport"></a>

## KanbanConformanceReport

Kind: interface

```ts
export interface KanbanConformanceReport {
    ok: boolean;
    checks: KanbanConformanceCheck[];
}
```

<a id="symbol-testing-runtimecontrolplaneconformancecheck"></a>

## RuntimeControlPlaneConformanceCheck

Kind: type

```ts
export type RuntimeControlPlaneConformanceCheck = RuntimeProviderConformanceCheck;
```

<a id="symbol-testing-runtimecontrolplaneconformancefixture"></a>

## RuntimeControlPlaneConformanceFixture

Kind: type

```ts
export type RuntimeControlPlaneConformanceFixture = {
    module: RuntimeProviderModule;
    clientOptions: RuntimeClientOptions;
};
```

<a id="symbol-testing-runtimecontrolplaneconformancereport"></a>

## RuntimeControlPlaneConformanceReport

Kind: type

```ts
export type RuntimeControlPlaneConformanceReport = {
    providerKind: string;
    valid: boolean;
    checks: readonly RuntimeControlPlaneConformanceCheck[];
};
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

<a id="symbol-testing-validatekanbancard"></a>

## validateKanbanCard

Kind: function

```ts
/** Return a list of human-readable errors for a card that violates the contract. */
export declare function validateKanbanCard(card: KanbanCard): string[];
```
