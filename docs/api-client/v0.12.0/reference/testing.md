# @cavi-ai/api-client/testing

Package subpath: ./testing

<a id="symbol-testing-httptransportconformancefixture"></a>

## HttpTransportConformanceFixture

Kind: type

```ts
export type HttpTransportConformanceFixture = FixtureFor<"http", HttpTransportConformanceObservation>;
```

<a id="symbol-testing-httptransportconformanceobservation"></a>

## HttpTransportConformanceObservation

Kind: type

```ts
export type HttpTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
    kind: "http";
    requests: readonly HttpRequestObservation[];
}>;
```

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

<a id="symbol-testing-inspecttransportconformance"></a>

## inspectTransportConformance

Kind: function

```ts
export declare function inspectTransportConformance(fixture: TransportConformanceFixture): Promise<TransportConformanceReport>;
```

<a id="symbol-testing-jsonrpctransportconformancefixture"></a>

## JsonRpcTransportConformanceFixture

Kind: type

```ts
export type JsonRpcTransportConformanceFixture = FixtureFor<"json-rpc", JsonRpcTransportConformanceObservation>;
```

<a id="symbol-testing-jsonrpctransportconformanceobservation"></a>

## JsonRpcTransportConformanceObservation

Kind: type

```ts
export type JsonRpcTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
    kind: "json-rpc";
    requests: readonly JsonRpcRequestObservation[];
    responses: readonly JsonRpcResponseObservation[];
    notifications: readonly JsonRpcNotificationObservation[];
}>;
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

<a id="symbol-testing-rawgatewayconformancefactory"></a>

## RawGatewayConformanceFactory

Kind: type

```ts
export type RawGatewayConformanceFactory = () => RawGatewayConformanceFixture | Promise<RawGatewayConformanceFixture>;
```

<a id="symbol-testing-rawgatewayconformancefixture"></a>

## RawGatewayConformanceFixture

Kind: type

```ts
export type RawGatewayConformanceFixture = Readonly<{
    channel: RawGatewayChannel;
    descriptor: RuntimeControlExtensionDescriptor<RawGatewayChannel>;
    response: unknown;
    ordinaryOperationId: string;
    ordinaryError: unknown;
    unsupportedOperationId: string;
    emitEvent: (event: RawGatewayEvent) => void;
    emitState: (state: RawGatewayConnectionState) => void;
    disposalCount: () => number;
    connectCount: () => number;
    /** Optional rejection identity used to prove rejected disposal is still cached exact-once. */
    expectedDisposalError?: unknown;
}>;
```

<a id="symbol-testing-rawgatewayconformancereport"></a>

## RawGatewayConformanceReport

Kind: type

```ts
export type RawGatewayConformanceReport = Readonly<{
    valid: boolean;
    failures: readonly string[];
}>;
```

<a id="symbol-testing-runrawgatewayconformance"></a>

## runRawGatewayConformance

Kind: function

```ts
/** Exercise the provider-neutral raw gateway contract without selecting a provider. */
export declare function runRawGatewayConformance(createChannel: RawGatewayConformanceFactory): Promise<RawGatewayConformanceReport>;
```

<a id="symbol-testing-runruntimecontrolclientconformance"></a>

## runRuntimeControlClientConformance

Kind: function

```ts
export declare function runRuntimeControlClientConformance(harness: RuntimeControlClientConformanceHarness): Promise<RuntimeControlClientConformanceReport>;
```

<a id="symbol-testing-runruntimecontrolscenarios"></a>

## runRuntimeControlScenarios

Kind: function

```ts
export declare function runRuntimeControlScenarios(environment: RuntimeControlScenarioEnvironment): Promise<RuntimeControlScenarioReport>;
```

<a id="symbol-testing-runtime-control-client-modules"></a>

## RUNTIME_CONTROL_CLIENT_MODULES

Kind: variable

```ts
export declare const RUNTIME_CONTROL_CLIENT_MODULES: readonly [
    "authStatus",
    "sessions",
    "models",
    "usage",
    "tasks",
    "workspace",
    "events"
];
```

<a id="symbol-testing-runtime-control-client-operation-capabilities"></a>

## RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES

Kind: variable

```ts
export declare const RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES: {
    readonly "authStatus.listAuthStatus": "controlPlane.authStatus.list";
    readonly "sessions.listSessions": "controlPlane.sessions.list";
    readonly "sessions.getSession": "controlPlane.sessions.get";
    readonly "sessions.cancelSession": "controlPlane.sessions.cancel";
    readonly "models.listModels": "controlPlane.models.list";
    readonly "usage.getUsage": "controlPlane.usage.get";
    readonly "tasks.listTasks": "controlPlane.tasks.list";
    readonly "tasks.getTask": "controlPlane.tasks.get";
    readonly "tasks.cancelTask": "controlPlane.tasks.cancel";
    readonly "workspace.listWorkspaces": "controlPlane.workspace.list";
    readonly "workspace.getWorkspace": "controlPlane.workspace.get";
    readonly "events.subscribe": "controlPlane.events.subscribe";
};
```

<a id="symbol-testing-runtime-control-scenario-extension"></a>

## RUNTIME_CONTROL_SCENARIO_EXTENSION

Kind: variable

```ts
export declare const RUNTIME_CONTROL_SCENARIO_EXTENSION: RuntimeControlExtensionDescriptor<RuntimeControlScenarioExtension>;
```

<a id="symbol-testing-runtime-control-scenarios"></a>

## RUNTIME_CONTROL_SCENARIOS

Kind: variable

```ts
export declare const RUNTIME_CONTROL_SCENARIOS: readonly RuntimeControlScenarioDefinition[];
```

<a id="symbol-testing-runtimecontrolclientconformanceharness"></a>

## RuntimeControlClientConformanceHarness

Kind: type

```ts
export type RuntimeControlClientConformanceHarness = Readonly<{
    /** Provider id every CapabilityUnavailable rejection must identify. */
    providerId: string;
    /** Creates the control plane to exercise. */
    create: () => RuntimeControlClient | Promise<RuntimeControlClient>;
    /** Sensitive values that must never appear in provider errors. */
    secrets?: readonly string[];
    /** Optional provider-backed lifecycle probes for abort and resource ownership. */
    lifecycle?: Readonly<{
        abortReason?: unknown;
        preAbort?: (signal: AbortSignal) => Promise<unknown>;
        inFlightAbort?: (signal: AbortSignal) => Promise<Readonly<{
            operation: Promise<unknown>;
            cleanup?: () => void | Promise<void>;
        }>>;
        ownership?: Readonly<{
            borrowed?: () => Promise<RuntimeControlClientResourceProbe>;
            owned?: () => Promise<RuntimeControlClientResourceProbe>;
        }>;
    }>;
}>;
```

<a id="symbol-testing-runtimecontrolclientconformancereport"></a>

## RuntimeControlClientConformanceReport

Kind: type

```ts
export type RuntimeControlClientConformanceReport = Readonly<{
    valid: boolean;
    modules: readonly (typeof RUNTIME_CONTROL_CLIENT_MODULES)[number][];
    supported: readonly RuntimeControlClientOperation[];
    unavailable: readonly RuntimeControlClientOperation[];
    failures: readonly string[];
}>;
```

<a id="symbol-testing-runtimecontrolclientoperation"></a>

## RuntimeControlClientOperation

Kind: type

```ts
export type RuntimeControlClientOperation = keyof typeof RUNTIME_CONTROL_CLIENT_OPERATION_CAPABILITIES;
```

<a id="symbol-testing-runtimecontrolclientresourceprobe"></a>

## RuntimeControlClientResourceProbe

Kind: type

```ts
export type RuntimeControlClientResourceProbe = Readonly<{
    dispose: () => void | Promise<void>;
    releases: () => number;
}>;
```

<a id="symbol-testing-runtimecontroldisposableresource"></a>

## RuntimeControlDisposableResource

Kind: type

```ts
export type RuntimeControlDisposableResource = Readonly<{
    cleanup: () => void | Promise<void>;
}>;
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

<a id="symbol-testing-runtimecontrolscenariodefinition"></a>

## RuntimeControlScenarioDefinition

Kind: type

```ts
export type RuntimeControlScenarioDefinition = Readonly<{
    id: string;
    capability: string;
    mutation?: boolean;
}>;
```

<a id="symbol-testing-runtimecontrolscenarioenvironment"></a>

## RuntimeControlScenarioEnvironment

Kind: type

```ts
export type RuntimeControlScenarioEnvironment = Readonly<{
    createClient: () => RuntimeControlClient | Promise<RuntimeControlClient>;
    mutationMode: "read-only" | "disposable";
    createResourcePrefix: () => string;
}>;
```

<a id="symbol-testing-runtimecontrolscenarioextension"></a>

## RuntimeControlScenarioExtension

Kind: type

```ts
export type RuntimeControlScenarioExtension = Readonly<{
    createDisposableResources(prefix: string): readonly RuntimeControlDisposableResource[] | Promise<readonly RuntimeControlDisposableResource[]>;
}>;
```

<a id="symbol-testing-runtimecontrolscenarioreport"></a>

## RuntimeControlScenarioReport

Kind: type

```ts
export type RuntimeControlScenarioReport = Readonly<{
    scenarios: readonly RuntimeControlScenarioResult[];
    failures: readonly string[];
}>;
```

<a id="symbol-testing-runtimecontrolscenarioresult"></a>

## RuntimeControlScenarioResult

Kind: type

```ts
export type RuntimeControlScenarioResult = Readonly<{
    id: string;
    status: RuntimeControlScenarioStatus;
    capability: string;
    durationMs: number;
    detail?: string;
}>;
```

<a id="symbol-testing-runtimecontrolscenariostatus"></a>

## RuntimeControlScenarioStatus

Kind: type

```ts
export type RuntimeControlScenarioStatus = "passed" | "unavailable" | "failed" | "skipped";
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

<a id="symbol-testing-ssetransportconformancefixture"></a>

## SseTransportConformanceFixture

Kind: type

```ts
export type SseTransportConformanceFixture = FixtureFor<"sse", SseTransportConformanceObservation>;
```

<a id="symbol-testing-ssetransportconformanceobservation"></a>

## SseTransportConformanceObservation

Kind: type

```ts
export type SseTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
    kind: "sse";
    connections: readonly SseConnectionObservation[];
    deliveredIds: readonly string[];
}>;
```

<a id="symbol-testing-stdiotransportconformancefixture"></a>

## StdioTransportConformanceFixture

Kind: type

```ts
export type StdioTransportConformanceFixture = FixtureFor<"stdio", StdioTransportConformanceObservation>;
```

<a id="symbol-testing-stdiotransportconformanceobservation"></a>

## StdioTransportConformanceObservation

Kind: type

```ts
export type StdioTransportConformanceObservation = ByteTransportConformanceObservation<"stdio">;
```

<a id="symbol-testing-transportconformancefixture"></a>

## TransportConformanceFixture

Kind: type

```ts
export type TransportConformanceFixture = HttpTransportConformanceFixture | SseTransportConformanceFixture | WebSocketTransportConformanceFixture | JsonRpcTransportConformanceFixture | StdioTransportConformanceFixture | UnixTransportConformanceFixture;
```

<a id="symbol-testing-transportconformanceissue"></a>

## TransportConformanceIssue

Kind: type

```ts
export type TransportConformanceIssue = Readonly<{
    code: "abort_leak" | "unbounded_retry" | "mutation_replayed" | "secret_exposed" | "resource_leak" | "protocol_mismatch";
    message: string;
}>;
```

<a id="symbol-testing-transportconformancereport"></a>

## TransportConformanceReport

Kind: type

```ts
export type TransportConformanceReport = Readonly<{
    ok: boolean;
    kind: TransportKind;
    issues: readonly TransportConformanceIssue[];
}>;
```

<a id="symbol-testing-transportconformancesharedobservation"></a>

## TransportConformanceSharedObservation

Kind: type

```ts
export type TransportConformanceSharedObservation = Readonly<{
    maxAttempts: number;
    emissionsAfterAbort: number;
    serializedErrors: readonly string[];
    serializedEvents: readonly string[];
    openResources: number;
}>;
```

<a id="symbol-testing-transportkind"></a>

## TransportKind

Kind: type

```ts
export type TransportKind = "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix";
```

<a id="symbol-testing-unixtransportconformancefixture"></a>

## UnixTransportConformanceFixture

Kind: type

```ts
export type UnixTransportConformanceFixture = FixtureFor<"unix", UnixTransportConformanceObservation>;
```

<a id="symbol-testing-unixtransportconformanceobservation"></a>

## UnixTransportConformanceObservation

Kind: type

```ts
export type UnixTransportConformanceObservation = ByteTransportConformanceObservation<"unix">;
```

<a id="symbol-testing-validatekanbancard"></a>

## validateKanbanCard

Kind: function

```ts
/** Return a list of human-readable errors for a card that violates the contract. */
export declare function validateKanbanCard(card: KanbanCard): string[];
```

<a id="symbol-testing-websockettransportconformancefixture"></a>

## WebSocketTransportConformanceFixture

Kind: type

```ts
export type WebSocketTransportConformanceFixture = FixtureFor<"websocket", WebSocketTransportConformanceObservation>;
```

<a id="symbol-testing-websockettransportconformanceobservation"></a>

## WebSocketTransportConformanceObservation

Kind: type

```ts
export type WebSocketTransportConformanceObservation = TransportConformanceSharedObservation & Readonly<{
    kind: "websocket";
    lifecycle: readonly WebSocketLifecycleObservation[];
}>;
```
