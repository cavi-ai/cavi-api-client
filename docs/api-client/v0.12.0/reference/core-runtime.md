# @cavi-ai/api-client/core/runtime

Package subpath: ./core/runtime

<a id="symbol-core-runtime-assertprotocolversion"></a>

## assertProtocolVersion

Kind: function

```ts
/** Throw a typed ProtocolMismatch error when the reported version is not `expected`. */
export declare function assertProtocolVersion(carrier: ProtocolVersionCarrier, expected: string): void;
```

<a id="symbol-core-runtime-authstatusclient"></a>

## AuthStatusClient

Kind: interface

```ts
export interface AuthStatusClient {
    listAuthStatus(): Promise<readonly RuntimeAuthStatus[]>;
}
```

<a id="symbol-core-runtime-builddryrunstatus"></a>

## buildDryRunStatus

Kind: function

```ts
/**
 * Build the canonical `dry_run` RuntimeRunStatus every provider's dryRun
 * short-circuit returns (A3). Single-source shape — same pattern as
 * normalizeRuntimeUsage: `dryRun: true` always builds + validates the
 * provider request first, then returns this WITHOUT any network call.
 */
export declare function buildDryRunStatus(model?: string): RuntimeRunStatus;
```

<a id="symbol-core-runtime-builddryrunstreamevent"></a>

## buildDryRunStreamEvent

Kind: function

```ts
/** Build the single terminal stream event a dryRun streamRun() emits (A3). */
export declare function buildDryRunStreamEvent(model?: string): RunStreamRunCompletedEvent;
```

<a id="symbol-core-runtime-capabilityunavailable"></a>

## CapabilityUnavailable

Kind: class

```ts
export declare class CapabilityUnavailable extends Error {
    readonly providerId: string;
    readonly capability: string;
    readonly name = "CapabilityUnavailable";
    constructor(providerId: string, capability: string);
}
```

<a id="symbol-core-runtime-checkprotocolversion"></a>

## checkProtocolVersion

Kind: function

```ts
/** Compare a provider's reported protocol version against the expected one. */
export declare function checkProtocolVersion(carrier: ProtocolVersionCarrier, expected: string): ProtocolVersionCheck;
```

<a id="symbol-core-runtime-createproviderregistry"></a>

## createProviderRegistry

Kind: function

```ts
export declare function createProviderRegistry<M extends RuntimeProviderModule>(options?: CreateRuntimeProviderRegistryOptions<M>): RuntimeProviderRegistry<M>;
```

<a id="symbol-core-runtime-createruntimeclient"></a>

## createRuntimeClient

Kind: function

```ts
export declare function createRuntimeClient(provider: string, options: CreateRuntimeClientOptions): RuntimeClient;
```

<a id="symbol-core-runtime-createruntimeclientoptions"></a>

## CreateRuntimeClientOptions

Kind: type

```ts
export type CreateRuntimeClientOptions = {
    registry: RuntimeProviderRegistry;
    clientOptions: RuntimeClientOptions;
};
```

<a id="symbol-core-runtime-createruntimecontrolclient"></a>

## createRuntimeControlClient

Kind: function

```ts
export declare function createRuntimeControlClient(provider: string, options?: RuntimeControlClientOptions): Promise<RuntimeControlClient>;
```

<a id="symbol-core-runtime-createruntimecontrolextensionregistry"></a>

## createRuntimeControlExtensionRegistry

Kind: function

```ts
export declare function createRuntimeControlExtensionRegistry(entries?: Iterable<RuntimeControlExtensionEntry>): RuntimeControlExtensionRegistry;
```

<a id="symbol-core-runtime-createruntimeproviderregistry"></a>

## createRuntimeProviderRegistry

Kind: function

```ts
export declare function createRuntimeProviderRegistry(options?: CreateRuntimeProviderRegistryOptions): RuntimeProviderRegistry;
```

<a id="symbol-core-runtime-createruntimeproviderregistryoptions"></a>

## CreateRuntimeProviderRegistryOptions

Kind: type

```ts
export type CreateRuntimeProviderRegistryOptions<M extends RuntimeProviderModule = RuntimeProviderModule> = {
    modules?: readonly M[] | null;
    allowOverrides?: boolean;
};
```

<a id="symbol-core-runtime-createunavailableruntimecontrolclient"></a>

## createUnavailableRuntimeControlClient

Kind: function

```ts
export declare function createUnavailableRuntimeControlClient(providerId: string, capabilities: ReadonlySet<string>): RuntimeControlClient;
```

<a id="symbol-core-runtime-defineruntimecontrolextension"></a>

## defineRuntimeControlExtension

Kind: function

```ts
export declare function defineRuntimeControlExtension<T>(id: string): RuntimeControlExtensionDescriptor<T>;
```

<a id="symbol-core-runtime-estimateusagecost"></a>

## estimateUsageCost

Kind: function

```ts
/**
 * Estimate run cost from normalized usage + consumer-supplied prices. The
 * package ships NO price table — prices are always the caller's. Any missing
 * token count or price contributes 0.
 */
export declare function estimateUsageCost(usage: RuntimeUsage, prices: TokenPrices): number;
```

<a id="symbol-core-runtime-gateway-raw-extension"></a>

## GATEWAY_RAW_EXTENSION

Kind: variable

```ts
export declare const GATEWAY_RAW_EXTENSION: RuntimeControlExtensionDescriptor<RawGatewayChannel>;
```

<a id="symbol-core-runtime-getbrowserwindoworigin"></a>

## getBrowserWindowOrigin

Kind: function

```ts
export declare function getBrowserWindowOrigin(): string | null;
```

<a id="symbol-core-runtime-inspectruntimeeventsequence"></a>

## inspectRuntimeEventSequence

Kind: function

```ts
export declare function inspectRuntimeEventSequence(events: readonly RuntimeControlPlaneEvent[]): RuntimeEventSequenceInspection;
```

<a id="symbol-core-runtime-isruntimerunstartbody"></a>

## isRuntimeRunStartBody

Kind: function

```ts
export declare function isRuntimeRunStartBody(value: unknown): value is RuntimeRunStartBody;
```

<a id="symbol-core-runtime-listsessionsoptions"></a>

## ListSessionsOptions

Kind: type

```ts
export type ListSessionsOptions = SessionRequestOptions & {
    cursor?: string;
    limit?: number;
};
```

<a id="symbol-core-runtime-modelcatalogclient"></a>

## ModelCatalogClient

Kind: interface

```ts
export interface ModelCatalogClient {
    listModels(query?: {
        cursor?: string;
        limit?: number;
    }): Promise<RuntimePage<RuntimeModelDescriptor>>;
}
```

<a id="symbol-core-runtime-normalizeruntimebasepath"></a>

## normalizeRuntimeBasePath

Kind: function

```ts
export declare function normalizeRuntimeBasePath(rawBasePath: string | null | undefined): string;
```

<a id="symbol-core-runtime-normalizeruntimeprovidertoken"></a>

## normalizeRuntimeProviderToken

Kind: function

```ts
export declare function normalizeRuntimeProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-core-runtime-normalizeruntimeusage"></a>

## normalizeRuntimeUsage

Kind: function

```ts
/**
 * Normalize a flat provider-native usage record into RuntimeUsage. Tolerant of
 * snake_case / camelCase across providers. Provider mappers are preferred where
 * the native (possibly nested) object is in hand; this covers callers holding
 * only the legacy flat `RuntimeRunStatus.usage`. `providerKind` is reserved for
 * future provider-specific disambiguation.
 */
export declare function normalizeRuntimeUsage(raw: Record<string, number> | undefined, providerKind: string): RuntimeUsage | undefined;
```

<a id="symbol-core-runtime-protocolversioncarrier"></a>

## ProtocolVersionCarrier

Kind: type

```ts
export type ProtocolVersionCarrier = {
    protocolVersion?: string | null;
};
```

<a id="symbol-core-runtime-protocolversioncheck"></a>

## ProtocolVersionCheck

Kind: type

```ts
export type ProtocolVersionCheck = {
    ok: boolean;
    expected: string;
    actual: string | null;
};
```

<a id="symbol-core-runtime-rawgatewaychannel"></a>

## RawGatewayChannel

Kind: interface

```ts
export interface RawGatewayChannel {
    request<TResult = unknown>(operationId: string, payload?: Readonly<Record<string, unknown>>, options?: RawGatewayRequestOptions): Promise<TResult>;
    subscribe(listener: (event: RawGatewayEvent) => void): () => void;
    getConnectionState(): RawGatewayConnectionState;
    onConnectionState(listener: (state: RawGatewayConnectionState) => void): () => void;
    connect(): Promise<void>;
    dispose(): Promise<void>;
}
```

<a id="symbol-core-runtime-rawgatewayconnectionstate"></a>

## RawGatewayConnectionState

Kind: type

```ts
export type RawGatewayConnectionState = "idle" | "connecting" | "reconnecting" | "connected" | "error";
```

<a id="symbol-core-runtime-rawgatewayevent"></a>

## RawGatewayEvent

Kind: type

```ts
export type RawGatewayEvent = Readonly<{
    event: string;
    payload: unknown;
}>;
```

<a id="symbol-core-runtime-rawgatewayrequestoptions"></a>

## RawGatewayRequestOptions

Kind: type

```ts
export type RawGatewayRequestOptions = Readonly<{
    signal?: AbortSignal;
}>;
```

<a id="symbol-core-runtime-resolvepublicruntimeasset"></a>

## resolvePublicRuntimeAsset

Kind: function

```ts
export declare function resolvePublicRuntimeAsset(pathname: string, rawBasePath: string | null | undefined): string;
```

<a id="symbol-core-runtime-run-stream-event-names"></a>

## RUN_STREAM_EVENT_NAMES

Kind: variable

```ts
export declare const RUN_STREAM_EVENT_NAMES: {
    readonly MESSAGE_DELTA: "message.delta";
    readonly RUN_COMPLETED: "run.completed";
    readonly RUN_FAILED: "run.failed";
    readonly RUN_CANCELLED: "run.cancelled";
    readonly APPROVAL_REQUEST: "approval.request";
    readonly TOOL_CALL_STARTED: "tool.call.started";
    readonly TOOL_CALL_COMPLETED: "tool.call.completed";
    readonly TOOL_CALL_FAILED: "tool.call.failed";
};
```

<a id="symbol-core-runtime-runeventstreamhandlers"></a>

## RunEventStreamHandlers

Kind: type

```ts
export type RunEventStreamHandlers = {
    onEvent: (event: RunStreamEvent) => void;
    /** Transport / parse errors. Lifecycle "run.failed" is delivered via onEvent, not here. */
    onError?: (error: unknown) => void;
    /** Fired once after the stream has emitted its last event of the run. */
    onComplete?: () => void;
};
```

<a id="symbol-core-runtime-runeventstreamprovider"></a>

## RunEventStreamProvider

Kind: interface

```ts
/**
 * Harness-agnostic source of live run events. Implementations bind to a
 * transport and translate native messages into the canonical RunStreamEvent
 * union; every emitted event's `event` field MUST be one of
 * RUN_STREAM_EVENT_NAMES.
 */
export interface RunEventStreamProvider {
    subscribe(params: RunEventStreamSubscribeParams, handlers: RunEventStreamHandlers): Promise<RunEventStreamSubscription>;
}
```

<a id="symbol-core-runtime-runeventstreamsubscribeparams"></a>

## RunEventStreamSubscribeParams

Kind: type

```ts
export type RunEventStreamSubscribeParams = {
    runId: string;
    /** Optional caller-supplied abort signal. Implementations MUST honor abort and dispose. */
    signal?: AbortSignal;
};
```

<a id="symbol-core-runtime-runeventstreamsubscription"></a>

## RunEventStreamSubscription

Kind: type

```ts
/** Disposes an active subscription. Idempotent. */
export type RunEventStreamSubscription = {
    dispose(): void | Promise<void>;
};
```

<a id="symbol-core-runtime-runstreamapprovalchoice"></a>

## RunStreamApprovalChoice

Kind: type

```ts
export type RunStreamApprovalChoice = "once" | "session" | "always" | "deny";
```

<a id="symbol-core-runtime-runstreamapprovalrequestevent"></a>

## RunStreamApprovalRequestEvent

Kind: type

```ts
export type RunStreamApprovalRequestEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.APPROVAL_REQUEST;
    runId: string;
    choices: RunStreamApprovalChoice[];
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamevent"></a>

## RunStreamEvent

Kind: type

```ts
export type RunStreamEvent = RunStreamMessageDeltaEvent | RunStreamRunCompletedEvent | RunStreamRunFailedEvent | RunStreamRunCancelledEvent | RunStreamApprovalRequestEvent | RunStreamToolEvent;
```

<a id="symbol-core-runtime-runstreameventname"></a>

## RunStreamEventName

Kind: type

```ts
export type RunStreamEventName = (typeof RUN_STREAM_EVENT_NAMES)[keyof typeof RUN_STREAM_EVENT_NAMES];
```

<a id="symbol-core-runtime-runstreammessagedeltaevent"></a>

## RunStreamMessageDeltaEvent

Kind: type

```ts
export type RunStreamMessageDeltaEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA;
    runId: string;
    delta: string;
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamruncancelledevent"></a>

## RunStreamRunCancelledEvent

Kind: type

```ts
export type RunStreamRunCancelledEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.RUN_CANCELLED;
    runId: string;
    reason?: string;
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamruncompletedevent"></a>

## RunStreamRunCompletedEvent

Kind: type

```ts
export type RunStreamRunCompletedEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.RUN_COMPLETED;
    runId: string;
    output?: string;
    /** Provider-agnostic normalized usage, when the terminal stream carries it. */
    usage?: RuntimeUsage;
    at?: number;
    /** Present only on a dryRun short-circuit stream event (A3): "dry_run". */
    status?: RuntimeRunState;
};
```

<a id="symbol-core-runtime-runstreamrunfailedevent"></a>

## RunStreamRunFailedEvent

Kind: type

```ts
export type RunStreamRunFailedEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.RUN_FAILED;
    runId: string;
    error: string;
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamtoolcall"></a>

## RunStreamToolCall

Kind: type

```ts
export type RunStreamToolCall = {
    id: string;
    name: string;
    status: RunStreamToolStatus;
    event?: string;
    input?: string;
    output?: string;
    error?: string;
    durationMs?: number;
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamtoolevent"></a>

## RunStreamToolEvent

Kind: type

```ts
export type RunStreamToolEvent = {
    event: typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_STARTED | typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_COMPLETED | typeof RUN_STREAM_EVENT_NAMES.TOOL_CALL_FAILED;
    runId: string;
    toolCall: RunStreamToolCall;
    at?: number;
};
```

<a id="symbol-core-runtime-runstreamtoolstatus"></a>

## RunStreamToolStatus

Kind: type

```ts
export type RunStreamToolStatus = "pending" | "running" | "completed" | "failed";
```

<a id="symbol-core-runtime-runtime-control-plane-event-names"></a>

## RUNTIME_CONTROL_PLANE_EVENT_NAMES

Kind: variable

```ts
export declare const RUNTIME_CONTROL_PLANE_EVENT_NAMES: readonly [
    "operation.started",
    "operation.updated",
    "message.delta",
    "reasoning.delta",
    "tool.started",
    "tool.progress",
    "tool.completed",
    "approval.requested",
    "approval.resolved",
    "usage.updated",
    "stream.reconnected",
    "stream.gap",
    "operation.completed",
    "operation.failed",
    "operation.cancelled",
    "operation.interrupted"
];
```

<a id="symbol-core-runtime-runtime-surfaces"></a>

## RUNTIME_SURFACES

Kind: variable

```ts
/** Every surface a provider may declare support for. */
export declare const RUNTIME_SURFACES: readonly [
    "runs",
    "streaming",
    "media",
    "wiki",
    "agentConfig",
    "teams",
    "kanban",
    "workspace",
    "operator",
    "discourse",
    "batch"
];
```

<a id="symbol-core-runtime-runtime-transport-kinds"></a>

## RUNTIME_TRANSPORT_KINDS

Kind: variable

```ts
export declare const RUNTIME_TRANSPORT_KINDS: readonly [
    "http",
    "sse",
    "websocket",
    "json-rpc",
    "stdio",
    "unix-socket"
];
```

<a id="symbol-core-runtime-runtimeauthstatus"></a>

## RuntimeAuthStatus

Kind: interface

```ts
export interface RuntimeAuthStatus {
    providerId: string;
    profileId?: string;
    status: "authenticated" | "unauthenticated" | "expired" | "unknown";
    expiresAt?: string;
    sourceCategory?: string;
    reasonCode?: string;
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-runtimebatchcounts"></a>

## RuntimeBatchCounts

Kind: type

```ts
export type RuntimeBatchCounts = {
    total?: number;
    processing?: number;
    succeeded?: number;
    errored?: number;
    canceled?: number;
    expired?: number;
};
```

<a id="symbol-core-runtime-runtimebatchoutcome"></a>

## RuntimeBatchOutcome

Kind: type

```ts
export type RuntimeBatchOutcome = "succeeded" | "errored" | "canceled" | "expired" | (string & {});
```

<a id="symbol-core-runtime-runtimebatchrequest"></a>

## RuntimeBatchRequest

Kind: type

```ts
/** One entry in a batch submission — a run body plus a caller correlation id. */
export type RuntimeBatchRequest = {
    /** Caller-chosen id, echoed on the matching result. */
    customId: string;
    body: RuntimeRunStartBody;
};
```

<a id="symbol-core-runtime-runtimebatchresult"></a>

## RuntimeBatchResult

Kind: type

```ts
export type RuntimeBatchResult = {
    customId: string;
    outcome: RuntimeBatchOutcome;
    /** Present when outcome === "succeeded": the normalized run status (incl. tokens). */
    run?: RuntimeRunStatus;
    error?: string;
};
```

<a id="symbol-core-runtime-runtimebatchstate"></a>

## RuntimeBatchState

Kind: type

```ts
export type RuntimeBatchState = "in_progress" | "canceling" | "completed" | "cancelled" | "failed" | (string & {});
```

<a id="symbol-core-runtime-runtimebatchstatus"></a>

## RuntimeBatchStatus

Kind: type

```ts
export type RuntimeBatchStatus = {
    batch_id: string;
    status: RuntimeBatchState;
    counts?: RuntimeBatchCounts;
    createdAt?: number | string;
    endedAt?: number | string;
    /** True once results are retrievable (the provider batch has ended). */
    resultsAvailable?: boolean;
};
```

<a id="symbol-core-runtime-runtimecapabilities"></a>

## RuntimeCapabilities

Kind: type

```ts
/** Provider-declared capability profile. Returned by RuntimeClient. */
export type RuntimeCapabilities = {
    providerKind: string;
    protocolVersion?: string | null;
    auth?: {
        type?: string;
        required?: boolean;
    };
    supports: Partial<Record<RuntimeSurface, boolean>>;
};
```

<a id="symbol-core-runtime-runtimeclient"></a>

## RuntimeClient

Kind: interface

```ts
/**
 * The UNIVERSAL agent-runtime contract every provider implements.
 * Gateway-only surfaces (teams/kanban/workspace/operator) live on
 * `GatewayClient`, which extends this.
 */
export interface RuntimeClient {
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    /**
     * Optional — synchronous/stateless providers (e.g. Claude SDK) omit these.
     * Consumers should null-check (`client.cancelRun?.(id)`) or gate on
     * `RuntimeCapabilities`. Providers that expose the method but can't serve it
     * should throw `ApiClientError(EndpointNotFound)`.
     */
    getRun?(runId: string): Promise<RuntimeRunStatus>;
    cancelRun?(runId: string): Promise<{
        status: string;
    }>;
    /**
     * Start a run and stream it as canonical RunStreamEvents. Optional: providers
     * that use a subscribe-by-runId model (gateways) omit this and expose a
     * RunEventStreamProvider instead.
     */
    streamRun?(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    /**
     * Batch surface (optional). Providers that support async batch processing
     * declare `supports.batch` and implement these; others omit them. Consumers
     * null-check (`client.submitBatch?.(…)`) or gate on `RuntimeCapabilities`.
     */
    submitBatch?(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
    getBatch?(batchId: string): Promise<RuntimeBatchStatus>;
    cancelBatch?(batchId: string): Promise<RuntimeBatchStatus>;
    /**
     * Retrieve batch results. Throws an `EndpointNotFound`-class error if the
     * batch has not ended yet — poll `getBatch` until `resultsAvailable` is true.
     */
    getBatchResults?(batchId: string): Promise<RuntimeBatchResult[]>;
}
```

<a id="symbol-core-runtime-runtimeclientoptions"></a>

## RuntimeClientOptions

Kind: type

```ts
export type RuntimeClientOptions = Pick<HttpApiClientOptions, "baseUrl" | "fetchImpl" | "onTrace">;
```

<a id="symbol-core-runtime-runtimecontrolclient"></a>

## RuntimeControlClient

Kind: interface

```ts
export interface RuntimeControlClient {
    readonly authStatus: AuthStatusClient;
    readonly sessions: SessionClient;
    readonly models: ModelCatalogClient;
    readonly usage: UsageClient;
    readonly tasks: TaskClient;
    readonly workspace: WorkspaceClient;
    readonly events: RuntimeEventClient;
    readonly extensions: RuntimeControlExtensionRegistry;
    dispose(): Promise<void>;
}
```

<a id="symbol-core-runtime-runtimecontrolclientfactory"></a>

## RuntimeControlClientFactory

Kind: type

```ts
export type RuntimeControlClientFactory = (options: RuntimeControlClientOptions) => Promise<RuntimeControlClient>;
```

<a id="symbol-core-runtime-runtimecontrolclientoptions"></a>

## RuntimeControlClientOptions

Kind: type

```ts
export type RuntimeControlClientOptions = {
    baseUrl?: string;
    webSocketUrl?: string;
    token?: string;
    resolveAuth?: TransportAuthResolver;
    signal?: AbortSignal;
    trace?: (event: TransportLifecycleEvent) => void;
    /** Provider-neutral gateway handshake and request settings for an owned connection. */
    gatewayConnection?: GatewayRpcClientOptions;
    /** Opt-in bounded retry policy for reconnecting an owned gateway after a retryable drop. */
    gatewayReconnect?: TransportRetryPolicy;
    transport?: GatewayTransport;
    registry?: RuntimeProviderRegistry;
};
```

<a id="symbol-core-runtime-runtimecontrolextensiondescriptor"></a>

## RuntimeControlExtensionDescriptor

Kind: type

```ts
export type RuntimeControlExtensionDescriptor<T> = Readonly<{
    id: string;
    [extensionType]?: T;
}>;
```

<a id="symbol-core-runtime-runtimecontrolextensionregistry"></a>

## RuntimeControlExtensionRegistry

Kind: interface

```ts
export interface RuntimeControlExtensionRegistry {
    has<T>(descriptor: RuntimeControlExtensionDescriptor<T>): boolean;
    get<T>(descriptor: RuntimeControlExtensionDescriptor<T>): T | undefined;
    list(): readonly string[];
}
```

<a id="symbol-core-runtime-runtimecontrolplane"></a>

## RuntimeControlPlane

Kind: interface

```ts
export interface RuntimeControlPlane {
    transports: RuntimeTransportCapabilities;
    sessions?: SessionClient;
    models?: ModelCatalogClient;
    usage?: UsageClient;
    tasks?: TaskClient;
    workspace?: WorkspaceClient;
    authStatus?: AuthStatusClient;
    events?: RuntimeEventClient;
}
```

<a id="symbol-core-runtime-runtimecontrolplanedeclaration"></a>

## RuntimeControlPlaneDeclaration

Kind: type

```ts
export type RuntimeControlPlaneDeclaration = {
    transports?: RuntimeTransportCapabilities;
    modules?: Partial<Record<"sessions" | "models" | "usage" | "tasks" | "workspace" | "authStatus" | "events", true>>;
};
```

<a id="symbol-core-runtime-runtimecontrolplaneevent"></a>

## RuntimeControlPlaneEvent

Kind: type

```ts
export type RuntimeControlPlaneEvent = (RuntimeControlPlaneEventBase & {
    event: "operation.started";
}) | (RuntimeControlPlaneEventBase & {
    event: "operation.updated";
    update: unknown;
}) | (RuntimeControlPlaneEventBase & {
    event: "message.delta";
    delta: string;
}) | (RuntimeControlPlaneEventBase & {
    event: "reasoning.delta";
    delta: string;
}) | (RuntimeControlPlaneEventBase & {
    event: "tool.started";
    toolCallId: string;
    toolName: string;
}) | (RuntimeControlPlaneEventBase & {
    event: "tool.progress";
    toolCallId: string;
    progress: unknown;
}) | (RuntimeControlPlaneEventBase & {
    event: "tool.completed";
    toolCallId: string;
    result?: unknown;
}) | (RuntimeControlPlaneEventBase & {
    event: "approval.requested";
    approvalId: string;
    request?: unknown;
}) | (RuntimeControlPlaneEventBase & {
    event: "approval.resolved";
    approvalId: string;
    approved: boolean;
}) | (RuntimeControlPlaneEventBase & {
    event: "usage.updated";
    usage: RuntimeUsage;
}) | (RuntimeControlPlaneEventBase & {
    event: "stream.reconnected";
    cursor?: string;
}) | (RuntimeControlPlaneEventBase & {
    event: "stream.gap";
    reason: string;
}) | (RuntimeControlPlaneEventBase & {
    event: "operation.completed";
}) | (RuntimeControlPlaneEventBase & {
    event: "operation.failed";
    error: unknown;
}) | (RuntimeControlPlaneEventBase & {
    event: "operation.cancelled";
}) | (RuntimeControlPlaneEventBase & {
    event: "operation.interrupted";
    reason?: string;
});
```

<a id="symbol-core-runtime-runtimecontrolplaneeventname"></a>

## RuntimeControlPlaneEventName

Kind: type

```ts
export type RuntimeControlPlaneEventName = (typeof RUNTIME_CONTROL_PLANE_EVENT_NAMES)[number];
```

<a id="symbol-core-runtime-runtimecontrolplanemetadata"></a>

## RuntimeControlPlaneMetadata

Kind: type

```ts
export type RuntimeControlPlaneMetadata = {
    provider: string;
    stability: RuntimeProviderStability;
    source: RuntimeControlPlaneSource;
    providerData?: unknown;
};
```

<a id="symbol-core-runtime-runtimecontrolplanesource"></a>

## RuntimeControlPlaneSource

Kind: type

```ts
export type RuntimeControlPlaneSource = {
    transport: "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix-socket";
    method: string;
};
```

<a id="symbol-core-runtime-runtimeeventclient"></a>

## RuntimeEventClient

Kind: interface

```ts
export interface RuntimeEventClient {
    subscribe(params: {
        operationId: string;
        cursor?: string;
        signal?: AbortSignal;
    }, handlers: {
        onEvent(event: RuntimeControlPlaneEvent): void;
        onError?(error: unknown): void;
    }): Promise<RuntimeEventSubscription>;
}
```

<a id="symbol-core-runtime-runtimeeventsequenceinspection"></a>

## RuntimeEventSequenceInspection

Kind: interface

```ts
export interface RuntimeEventSequenceInspection {
    valid: boolean;
    terminalCount: number;
    gaps: number;
}
```

<a id="symbol-core-runtime-runtimeeventsubscription"></a>

## RuntimeEventSubscription

Kind: interface

```ts
export interface RuntimeEventSubscription {
    dispose(): void | Promise<void>;
}
```

<a id="symbol-core-runtime-runtimemodeldescriptor"></a>

## RuntimeModelDescriptor

Kind: interface

```ts
export interface RuntimeModelDescriptor {
    providerId: string;
    id: string;
    displayName?: string;
    availability: "available" | "unavailable" | "unknown";
    capabilities?: Readonly<Record<string, boolean>>;
    authenticated?: boolean;
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-runtimepage"></a>

## RuntimePage

Kind: type

```ts
export type RuntimePage<T> = {
    data: readonly T[];
    nextCursor?: string;
};
```

<a id="symbol-core-runtime-runtimeprovidermodule"></a>

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
    createRuntimeControlClient?: RuntimeControlClientFactory;
    /** @deprecated Use createClient for new provider modules. */
    createApiClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
}
```

<a id="symbol-core-runtime-runtimeproviderregistry"></a>

## RuntimeProviderRegistry

Kind: interface

```ts
export interface RuntimeProviderRegistry<M extends RuntimeProviderModule = RuntimeProviderModule> {
    resolveProvider(provider: string | null | undefined): M | null;
    listProviders(): readonly M[];
}
```

<a id="symbol-core-runtime-runtimeproviderstability"></a>

## RuntimeProviderStability

Kind: type

```ts
export type RuntimeProviderStability = "stable" | "experimental";
```

<a id="symbol-core-runtime-runtimeruninput"></a>

## RuntimeRunInput

Kind: type

```ts
export type RuntimeRunInput = string | RuntimeRunMessage[];
```

<a id="symbol-core-runtime-runtimerunmessage"></a>

## RuntimeRunMessage

Kind: type

```ts
/** A single conversation message. Structurally shared by every provider. */
export type RuntimeRunMessage = {
    role: string;
    content: string | Record<string, unknown>[];
    [key: string]: unknown;
};
```

<a id="symbol-core-runtime-runtimerunstartbody"></a>

## RuntimeRunStartBody

Kind: type

```ts
/**
 * The UNIVERSAL run-start body. Carries only fields every agent runtime
 * understands. Provider/gateway-only concepts (sessions, routing, target
 * profiles, tasks) are NOT here — they live on `GatewayRunStartBody`.
 */
export type RuntimeRunStartBody = {
    input: RuntimeRunInput;
    /** System / developer instructions (Anthropic `system`). */
    instructions?: string;
    model?: string;
    tools?: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
    dryRun?: boolean;
};
```

<a id="symbol-core-runtime-runtimerunstate"></a>

## RuntimeRunState

Kind: type

```ts
export type RuntimeRunState = "started" | "running" | "completed" | "failed" | "cancelled" | "stopping" | "dry_run" | (string & {});
```

<a id="symbol-core-runtime-runtimerunstatus"></a>

## RuntimeRunStatus

Kind: type

```ts
/** The UNIVERSAL run status. Gateway-only fields live on `GatewayRunStatus`. */
export type RuntimeRunStatus = {
    run_id: string;
    status: RuntimeRunState;
    model?: string;
    output?: string;
    response?: string;
    error?: string;
    /**
     * @deprecated Raw provider-native token counts. Use `tokens` for portable,
     * normalized usage. Still populated for backward compatibility.
     */
    usage?: Record<string, number>;
    /** Provider-agnostic normalized token usage. */
    tokens?: RuntimeUsage;
};
```

<a id="symbol-core-runtime-runtimesessionstate"></a>

## RuntimeSessionState

Kind: type

```ts
export type RuntimeSessionState = "pending" | "active" | "completed" | "cancelled" | "failed" | "unknown";
```

<a id="symbol-core-runtime-runtimesessionsummary"></a>

## RuntimeSessionSummary

Kind: interface

```ts
export interface RuntimeSessionSummary {
    id: string;
    providerId: string;
    title?: string;
    state: RuntimeSessionState;
    createdAt?: string;
    updatedAt?: string;
    providerKind: string;
    model?: string;
    workspaceId?: string;
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-runtimesupports"></a>

## runtimeSupports

Kind: function

```ts
export declare function runtimeSupports(capabilities: RuntimeCapabilities, surface: RuntimeSurface): boolean;
```

<a id="symbol-core-runtime-runtimesurface"></a>

## RuntimeSurface

Kind: type

```ts
export type RuntimeSurface = (typeof RUNTIME_SURFACES)[number];
```

<a id="symbol-core-runtime-runtimetaskstate"></a>

## RuntimeTaskState

Kind: type

```ts
export type RuntimeTaskState = "pending" | "running" | "completed" | "cancelled" | "failed" | "unknown";
```

<a id="symbol-core-runtime-runtimetasksummary"></a>

## RuntimeTaskSummary

Kind: interface

```ts
export interface RuntimeTaskSummary {
    id: string;
    state: RuntimeTaskState;
    createdAt?: string;
    updatedAt?: string;
    runId?: string;
    sessionId?: string;
    threadId?: string;
    cancellable?: boolean;
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-runtimetransportcapabilities"></a>

## RuntimeTransportCapabilities

Kind: type

```ts
export type RuntimeTransportCapabilities = Partial<Record<RuntimeTransportKind, RuntimeTransportCapability>>;
```

<a id="symbol-core-runtime-runtimetransportcapability"></a>

## RuntimeTransportCapability

Kind: type

```ts
export type RuntimeTransportCapability = {
    kind: RuntimeTransportKind;
    stability: RuntimeProviderStability;
    authenticated: boolean;
    reconnect?: boolean;
    replay?: boolean;
    cancellation?: boolean;
};
```

<a id="symbol-core-runtime-runtimetransportkind"></a>

## RuntimeTransportKind

Kind: type

```ts
export type RuntimeTransportKind = (typeof RUNTIME_TRANSPORT_KINDS)[number];
```

<a id="symbol-core-runtime-runtimetransportsupports"></a>

## runtimeTransportSupports

Kind: function

```ts
export declare function runtimeTransportSupports(capabilities: RuntimeTransportCapabilities, kind: RuntimeTransportKind): boolean;
```

<a id="symbol-core-runtime-runtimeusage"></a>

## RuntimeUsage

Kind: type

```ts
/** Canonical, provider-agnostic token usage for a single run. */
export type RuntimeUsage = {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    /** Tokens served from prompt cache. */
    cacheReadTokens?: number;
    /** Tokens written to prompt cache (Anthropic "cache_creation"). */
    cacheWriteTokens?: number;
    /** Lossless provider-native numeric fields, flattened. */
    raw?: Record<string, number>;
};
```

<a id="symbol-core-runtime-runtimeusagecost"></a>

## RuntimeUsageCost

Kind: interface

```ts
export interface RuntimeUsageCost {
    availability: "available" | "estimated" | "unavailable";
    amount?: number;
    currency?: string;
    calculationSource?: string;
}
```

<a id="symbol-core-runtime-runtimeusagequery"></a>

## RuntimeUsageQuery

Kind: interface

```ts
export interface RuntimeUsageQuery {
    startTime?: string;
    endTime?: string;
    providerId?: string;
    model?: string;
    sessionId?: string;
    agentId?: string;
}
```

<a id="symbol-core-runtime-runtimeusagesummary"></a>

## RuntimeUsageSummary

Kind: interface

```ts
export interface RuntimeUsageSummary {
    tokens: RuntimeUsage;
    cost: RuntimeUsageCost;
    aggregation?: string;
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-runtimeworkspacedescriptor"></a>

## RuntimeWorkspaceDescriptor

Kind: interface

```ts
export interface RuntimeWorkspaceDescriptor {
    id: string;
    providerId: string;
    displayName?: string;
    root?: string;
    accessMode: "read-only" | "read-write" | "unknown";
    metadata: RuntimeControlPlaneMetadata;
}
```

<a id="symbol-core-runtime-sessionclient"></a>

## SessionClient

Kind: interface

```ts
export interface SessionClient {
    listSessions(query?: ListSessionsOptions): Promise<RuntimePage<RuntimeSessionSummary>>;
    getSession(id: string, options?: SessionRequestOptions): Promise<RuntimeSessionSummary>;
    cancelSession?(id: string, options?: SessionRequestOptions): Promise<RuntimeSessionSummary>;
}
```

<a id="symbol-core-runtime-sessionrequestoptions"></a>

## SessionRequestOptions

Kind: type

```ts
export type SessionRequestOptions = {
    signal?: AbortSignal;
};
```

<a id="symbol-core-runtime-taskclient"></a>

## TaskClient

Kind: interface

```ts
export interface TaskClient {
    listTasks(query?: {
        cursor?: string;
        limit?: number;
    }): Promise<RuntimePage<RuntimeTaskSummary>>;
    getTask(id: string): Promise<RuntimeTaskSummary>;
    cancelTask?(id: string): Promise<RuntimeTaskSummary>;
}
```

<a id="symbol-core-runtime-tokenprices"></a>

## TokenPrices

Kind: type

```ts
/** Per-million-token prices supplied by the consumer. No defaults ship. */
export type TokenPrices = {
    inputPerMTok?: number;
    outputPerMTok?: number;
    cacheReadPerMTok?: number;
    cacheWritePerMTok?: number;
};
```

<a id="symbol-core-runtime-unsupportedruntimesurface"></a>

## unsupportedRuntimeSurface

Kind: function

```ts
/** Throw a typed EndpointNotFound for a surface this provider does not serve. */
export declare function unsupportedRuntimeSurface(providerKind: string, surface: RuntimeSurface): never;
```

<a id="symbol-core-runtime-usageclient"></a>

## UsageClient

Kind: interface

```ts
export interface UsageClient {
    getUsage(query?: RuntimeUsageQuery): Promise<RuntimeUsageSummary>;
}
```

<a id="symbol-core-runtime-withruntimebasepath"></a>

## withRuntimeBasePath

Kind: function

```ts
export declare function withRuntimeBasePath(pathname: string, rawBasePath: string | null | undefined): string;
```

<a id="symbol-core-runtime-withruntimecontrolextensions"></a>

## withRuntimeControlExtensions

Kind: function

```ts
export declare function withRuntimeControlExtensions(client: RuntimeControlClient, entries: Iterable<RuntimeControlExtensionEntry>): RuntimeControlClient;
```

<a id="symbol-core-runtime-workspaceclient"></a>

## WorkspaceClient

Kind: interface

```ts
export interface WorkspaceClient {
    listWorkspaces(): Promise<readonly RuntimeWorkspaceDescriptor[]>;
    getWorkspace(id: string): Promise<RuntimeWorkspaceDescriptor>;
}
```
