# @cavi-ai/api-client/core/runtime

Package subpath: ./core/runtime

<a id="symbol-core-runtime-assertprotocolversion"></a>

## assertProtocolVersion

Kind: function

```ts
/** Throw a typed ProtocolMismatch error when the reported version is not `expected`. */
export declare function assertProtocolVersion(carrier: ProtocolVersionCarrier, expected: string): void;
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

<a id="symbol-core-runtime-getbrowserwindoworigin"></a>

## getBrowserWindowOrigin

Kind: function

```ts
export declare function getBrowserWindowOrigin(): string | null;
```

<a id="symbol-core-runtime-isruntimerunstartbody"></a>

## isRuntimeRunStartBody

Kind: function

```ts
export declare function isRuntimeRunStartBody(value: unknown): value is RuntimeRunStartBody;
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

<a id="symbol-core-runtime-runtimeprovidermodule"></a>

## RuntimeProviderModule

Kind: interface

```ts
export interface RuntimeProviderModule {
    kind: string;
    aliases?: readonly string[];
    capabilities?: Partial<Record<RuntimeSurface, boolean>>;
    createClient?: (clientOptions: RuntimeClientOptions) => RuntimeClient;
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

<a id="symbol-core-runtime-withruntimebasepath"></a>

## withRuntimeBasePath

Kind: function

```ts
export declare function withRuntimeBasePath(pathname: string, rawBasePath: string | null | undefined): string;
```
