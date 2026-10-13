# @cavi-ai/api-client/extensions/cavi

Package subpath: ./extensions/cavi

<a id="symbol-extensions-cavi-agentmemoryfile"></a>

## AgentMemoryFile

Kind: type

```ts
export type AgentMemoryFile = {
    filename: string;
    content: string;
    lastModified: number;
};
```

<a id="symbol-extensions-cavi-agentmemorysnapshot"></a>

## AgentMemorySnapshot

Kind: type

```ts
export type AgentMemorySnapshot = {
    agentId: string;
    activeFiles: AgentMemoryFile[];
    journalCount: number;
    lastJournalDate: string | null;
};
```

<a id="symbol-extensions-cavi-appendcaviapipath"></a>

## appendCaviApiPath

Kind: function

```ts
export declare function appendCaviApiPath(basePath: string, relativePath?: string | null, options?: CaviApiPathAppendOptions): string;
```

<a id="symbol-extensions-cavi-appendhttpquery"></a>

## appendHttpQuery

Kind: function

```ts
export declare function appendHttpQuery(path: string, query?: Record<string, string | number | boolean | undefined>): string;
```

<a id="symbol-extensions-cavi-backfillcanonicalteam"></a>

## backfillCanonicalTeam

Kind: function

```ts
export declare function backfillCanonicalTeam(team: TeamRegistryTeamConfig): OperatorRegistryTeam;
```

<a id="symbol-extensions-cavi-buildagentmainsessionkey"></a>

## buildAgentMainSessionKey

Kind: function

```ts
export declare function buildAgentMainSessionKey(params: {
    agentId: string | null | undefined;
    mainKey?: string | null | undefined;
}): string;
```

<a id="symbol-extensions-cavi-buildlibraryclippayload"></a>

## buildLibraryClipPayload

Kind: function

```ts
export declare function buildLibraryClipPayload(input: LibraryClipInput): LibraryClipRequest;
```

<a id="symbol-extensions-cavi-buildlibraryclipschemasnapshot"></a>

## buildLibraryClipSchemaSnapshot

Kind: function

```ts
export declare function buildLibraryClipSchemaSnapshot(): LibraryClipSchemaSnapshot;
```

<a id="symbol-extensions-cavi-buildlibrarymanualfileclipinput"></a>

## buildLibraryManualFileClipInput

Kind: function

```ts
export declare function buildLibraryManualFileClipInput(input: LibraryManualFileClipInput): LibraryClipInput;
```

<a id="symbol-extensions-cavi-buildportalapierrorenvelope"></a>

## buildPortalApiErrorEnvelope

Kind: function

```ts
export declare function buildPortalApiErrorEnvelope<TContract extends string, TData>(params: PortalApiEnvelopeBase & {
    contract: TContract;
    data: TData;
    error: PortalApiError;
    generatedAt?: number;
}): PortalApiResponseEnvelope<TContract, TData>;
```

<a id="symbol-extensions-cavi-buildportalapirequestenvelope"></a>

## buildPortalApiRequestEnvelope

Kind: function

```ts
export declare function buildPortalApiRequestEnvelope<TContract extends string, TPayload>(params: PortalApiEnvelopeBase & {
    contract: TContract;
    payload: TPayload;
    requestedAt?: number;
}): PortalApiRequestEnvelope<TContract, TPayload>;
```

<a id="symbol-extensions-cavi-buildportalapisuccessenvelope"></a>

## buildPortalApiSuccessEnvelope

Kind: function

```ts
export declare function buildPortalApiSuccessEnvelope<TContract extends string, TData>(params: PortalApiEnvelopeBase & {
    contract: TContract;
    data: TData;
    generatedAt?: number;
}): PortalApiResponseEnvelope<TContract, TData>;
```

<a id="symbol-extensions-cavi-buildportalmemoryenvelope"></a>

## buildPortalMemoryEnvelope

Kind: function

```ts
export declare function buildPortalMemoryEnvelope<TSchemaContract extends string, TPayload>(params: {
    clientId: string;
    teamSlug: string;
    memberId: string;
    memoryKey: string;
    schemaContract: TSchemaContract;
    payload: TPayload;
    updatedAt?: number;
    portalId?: string;
    feature?: string;
    library?: PortalLibraryRef;
}): PortalMemoryEnvelope<TSchemaContract, TPayload>;
```

<a id="symbol-extensions-cavi-buildportalttsvoiceoptions"></a>

## buildPortalTtsVoiceOptions

Kind: function

```ts
export declare function buildPortalTtsVoiceOptions(params: {
    providers?: readonly PortalTtsProviderLike[];
    activeProviderId?: string;
    dashboardVoices?: Record<string, PortalTtsDashboardVoiceLike>;
}): PortalTtsVoiceOption[];
```

<a id="symbol-extensions-cavi-cavi-control-api-endpoints"></a>

## CAVI_CONTROL_API_ENDPOINTS

Kind: variable

```ts
export declare const CAVI_CONTROL_API_ENDPOINTS: {
    readonly costHistory: "/api/plugins/cavi-control/cost/history";
    readonly scoringModel: "/api/plugins/cavi-control/scoring/model";
    readonly operator: {
        readonly root: "/cavi-control/api/operator";
        readonly snapshot: "/cavi-control/api/operator/snapshot";
        readonly status: "/cavi-control/api/operator/status";
        readonly registry: "/cavi-control/api/operator/registry";
        readonly tasks: "/cavi-control/api/operator/tasks";
        readonly taskDiscourse: (taskId: string) => string;
        readonly memory: "/cavi-control/api/operator/memory";
    };
    readonly portalMemorySnapshot: (teamSlug: string, memberId: string, memoryKey: string) => string;
};
```

<a id="symbol-extensions-cavi-cavi-control-base-path"></a>

## CAVI_CONTROL_BASE_PATH

Kind: variable

```ts
export declare const CAVI_CONTROL_BASE_PATH: "/cavi-control";
```

<a id="symbol-extensions-cavi-cavi-control-extension"></a>

## CAVI_CONTROL_EXTENSION

Kind: variable

```ts
export declare const CAVI_CONTROL_EXTENSION: RuntimeControlExtensionDescriptor<CaviControlAdapters>;
```

<a id="symbol-extensions-cavi-cavi-control-operator-api"></a>

## CAVI_CONTROL_OPERATOR_API

Kind: variable

```ts
export declare const CAVI_CONTROL_OPERATOR_API: {
    readonly root: "/cavi-control/api/operator";
    readonly snapshot: "/cavi-control/api/operator/snapshot";
    readonly status: "/cavi-control/api/operator/status";
    readonly registry: "/cavi-control/api/operator/registry";
    readonly tasks: "/cavi-control/api/operator/tasks";
    readonly taskDiscourse: (taskId: string) => string;
    readonly memory: "/cavi-control/api/operator/memory";
};
```

<a id="symbol-extensions-cavi-cavi-control-operator-api-base"></a>

## CAVI_CONTROL_OPERATOR_API_BASE

Kind: variable

```ts
export declare const CAVI_CONTROL_OPERATOR_API_BASE: "/cavi-control/api/operator";
```

<a id="symbol-extensions-cavi-cavi-control-operator-api-plugin-alias"></a>

## CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS

Kind: variable

```ts
/**
 * The gateway mounts the operator API at two paths: the canonical
 * `/cavi-control/api/operator` and a generic plugin route
 * `/api/plugins/cavi-control/operator`. `operator-control-live` issues each
 * request against the canonical path with this plugin-alias path as a fallback,
 * so both tables are kept key-for-key identical.
 */
export declare const CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS: {
    readonly root: "/api/plugins/cavi-control/operator";
    readonly snapshot: "/api/plugins/cavi-control/operator/snapshot";
    readonly status: "/api/plugins/cavi-control/operator/status";
    readonly registry: "/api/plugins/cavi-control/operator/registry";
    readonly tasks: "/api/plugins/cavi-control/operator/tasks";
    readonly taskDiscourse: (taskId: string) => string;
    readonly memory: "/api/plugins/cavi-control/operator/memory";
};
```

<a id="symbol-extensions-cavi-cavi-control-operator-api-plugin-alias-base"></a>

## CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE

Kind: variable

```ts
export declare const CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE: "/api/plugins/cavi-control/operator";
```

<a id="symbol-extensions-cavi-cavi-control-operator-rpc-method-list"></a>

## CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST

Kind: variable

```ts
export declare const CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST: ("operator.status" | "operator.registry.get" | "operator.snapshot" | "operator.memory.list" | "operator.tasks.list" | "discourse.tree")[];
```

<a id="symbol-extensions-cavi-cavi-control-operator-rpc-methods"></a>

## CAVI_CONTROL_OPERATOR_RPC_METHODS

Kind: variable

```ts
export declare const CAVI_CONTROL_OPERATOR_RPC_METHODS: {
    readonly status: "operator.status";
    readonly registry: "operator.registry.get";
    readonly snapshot: "operator.snapshot";
    readonly memoryList: "operator.memory.list";
    readonly tasksList: "operator.tasks.list";
    readonly discourseTree: "discourse.tree";
};
```

<a id="symbol-extensions-cavi-cavi-cost-history-api-paths"></a>

## CAVI_COST_HISTORY_API_PATHS

Kind: variable

```ts
/** Ordered cost-history routes: released plugin route first, current CAVI route second. */
export declare const CAVI_COST_HISTORY_API_PATHS: readonly [
    "/api/plugins/cavi-control/cost/history",
    "/cavi-control/api/cost/history"
];
```

<a id="symbol-extensions-cavi-cavi-surface-contracts"></a>

## CAVI_SURFACE_CONTRACTS

Kind: variable

```ts
export declare const CAVI_SURFACE_CONTRACTS: Record<string, SurfaceContract>;
```

<a id="symbol-extensions-cavi-caviapipathappendoptions"></a>

## CaviApiPathAppendOptions

Kind: type

```ts
export type CaviApiPathAppendOptions = {
    boundaryLabel?: string;
    errorPrefix?: string;
};
```

<a id="symbol-extensions-cavi-cavicontroladapterfallbackprovider"></a>

## CaviControlAdapterFallbackProvider

Kind: type

```ts
export type CaviControlAdapterFallbackProvider = GatewaySnapshotFallbackProvider & {
    cavi?: CaviControlAdapterFallbacks;
};
```

<a id="symbol-extensions-cavi-cavicontroladapterfallbacks"></a>

## CaviControlAdapterFallbacks

Kind: type

```ts
export type CaviControlAdapterFallbacks = {
    operatorControl?: OperatorControlSnapshot | (() => OperatorControlSnapshot);
    taskDiscourse?: TaskDiscourseSnapshot | ((taskId: string) => TaskDiscourseSnapshot);
};
```

<a id="symbol-extensions-cavi-cavicontroladapteroptions"></a>

## CaviControlAdapterOptions

Kind: type

```ts
export type CaviControlAdapterOptions = Parameters<typeof createCaviControlAdapters>[0];
```

<a id="symbol-extensions-cavi-cavicontroladapters"></a>

## CaviControlAdapters

Kind: type

```ts
export type CaviControlAdapters = {
    loadSessionsListRaw: (params: {
        includeGlobal?: boolean;
        includeUnknown?: boolean;
        includeDerivedTitles?: boolean;
        limit?: number;
        activeMinutes?: number;
        search?: string;
        label?: string;
        spawnedBy?: string;
        agentId?: string;
    }) => Promise<SessionsListPayload & {
        hash?: string;
        count?: number;
        ts?: number;
        path?: string;
    }>;
    loadSessionsUsageRaw: (params: {
        key?: string;
        limit?: number;
        includeContextWeight?: boolean;
        startDate?: string;
        endDate?: string;
    }) => Promise<SessionsUsagePayload>;
    loadSessionsPreviewRaw: (params: {
        keys: string[];
        limit?: number;
        maxChars?: number;
    }) => Promise<SessionsPreviewPayload>;
    loadSessionDetailRaw: (params: {
        key: string;
        previewLimit?: number;
        maxChars?: number;
    }) => Promise<{
        key?: string;
        row?: unknown | null;
        usageSession?: unknown | null;
        preview?: unknown | null;
        errors?: {
            usage?: string | null;
        };
    }>;
    patchSessionRaw: (params: {
        key: string;
        label?: string | null;
        thinkingLevel?: string | null;
        fastMode?: boolean | null;
        verboseLevel?: string | null;
        reasoningLevel?: string | null;
    }) => Promise<void>;
    loadOverview: () => Promise<DataEnvelope<OverviewSnapshot>>;
    loadAgentRuns: (filters: AgentRunsFilters) => Promise<DataEnvelope<GatewaySessionRunsSnapshot>>;
    loadRunDetail: (key: string) => Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>>;
    loadRoutingMatrix: (windowDays: number) => Promise<DataEnvelope<RoutingMatrixSnapshot>>;
    loadIncidents: () => Promise<DataEnvelope<IncidentsSnapshot>>;
    loadOperatorControl: () => Promise<DataEnvelope<OperatorControlSnapshot> & {
        transports: {
            tasks: "websocket" | "http" | "fallback";
            registryDetail: "websocket" | "http" | "fallback";
        };
    }>;
    loadTaskDiscourse: (taskId: string) => Promise<DataEnvelope<TaskDiscourseSnapshot>>;
    loadFleetLibrary: () => Promise<FleetLibrarySnapshot>;
    loadCostHistory: (range: CostHistoryRange) => Promise<DataEnvelope<CostHistorySnapshot>>;
};
```

<a id="symbol-extensions-cavi-cavicontrolapiclient"></a>

## CaviControlApiClient

Kind: class

```ts
export declare class CaviControlApiClient extends BaseHttpApiClient {
    readonly endpoints: {
        readonly costHistory: "/api/plugins/cavi-control/cost/history";
        readonly scoringModel: "/api/plugins/cavi-control/scoring/model";
        readonly operator: {
            readonly root: "/cavi-control/api/operator";
            readonly snapshot: "/cavi-control/api/operator/snapshot";
            readonly status: "/cavi-control/api/operator/status";
            readonly registry: "/cavi-control/api/operator/registry";
            readonly tasks: "/cavi-control/api/operator/tasks";
            readonly taskDiscourse: (taskId: string) => string;
            readonly memory: "/cavi-control/api/operator/memory";
        };
        readonly portalMemorySnapshot: (teamSlug: string, memberId: string, memoryKey: string) => string;
    };
    readonly request: HttpApiTransport;
    constructor(options: HttpApiClientOptions);
    getOperatorSnapshot<T = unknown>(): Promise<T>;
    getPortalDashboard<T = unknown>(path: string): Promise<T>;
    postJson<T = unknown>(path: string, body: unknown, idempotencyKey?: string): Promise<T>;
}
```

<a id="symbol-extensions-cavi-caviruntimecontrolprovideroptions"></a>

## CaviRuntimeControlProviderOptions

Kind: interface

```ts
export interface CaviRuntimeControlProviderOptions {
    openclaw?: Readonly<{
        cavi?: CaviControlAdapterOptions;
    }>;
    hermes?: HermesCaviRuntimeControlOptions;
}
```

<a id="symbol-extensions-cavi-caviteamportalid"></a>

## CaviTeamPortalId

Kind: type

```ts
export type CaviTeamPortalId = string;
```

<a id="symbol-extensions-cavi-configurecanonicaloperatorregistry"></a>

## configureCanonicalOperatorRegistry

Kind: function

```ts
export declare function configureCanonicalOperatorRegistry(snapshot: OperatorRegistrySnapshot | null | undefined): void;
```

<a id="symbol-extensions-cavi-configurecanonicalteamregistry"></a>

## configureCanonicalTeamRegistry

Kind: function

```ts
export declare function configureCanonicalTeamRegistry(config: TeamRegistryConfig | null | undefined): void;
```

<a id="symbol-extensions-cavi-configureteamregistryconfig"></a>

## configureTeamRegistryConfig

Kind: function

```ts
export declare function configureTeamRegistryConfig(config: TeamRegistryConfig | null | undefined): void;
```

<a id="symbol-extensions-cavi-createcavicontroladapterfallbackprovider"></a>

## createCaviControlAdapterFallbackProvider

Kind: function

```ts
export declare function createCaviControlAdapterFallbackProvider(): CaviControlAdapterFallbackProvider;
```

<a id="symbol-extensions-cavi-createcavicontroladapters"></a>

## createCaviControlAdapters

Kind: function

```ts
export declare function createCaviControlAdapters(opts: {
    gatewayBaseUrl: string;
    authToken: string | null;
    apiBaseUrl?: string | null;
    client?: GatewayWebSocketClient | null;
    defaultHeaders?: Record<string, string>;
    fallbackMode?: CaviSnapshotFallbackMode;
    fallbackProvider?: CaviControlAdapterFallbackProvider | null;
    snapshotFallbacks?: CreateGatewayWsSnapshotLoadersOptions["snapshotFallbacks"];
    costHistoryFallback?: CreateGatewayWsSnapshotLoadersOptions["costHistoryFallback"];
    caviFallbacks?: CaviControlAdapterFallbackProvider["cavi"];
    resolveSnapshotBinding?: CreateGatewayWsSnapshotLoadersOptions["resolveBinding"];
}): CaviControlAdapters;
```

<a id="symbol-extensions-cavi-createcavisnapshotfallbackprovider"></a>

## createCaviSnapshotFallbackProvider

Kind: function

```ts
export declare function createCaviSnapshotFallbackProvider(): GatewaySnapshotFallbackProvider;
```

<a id="symbol-extensions-cavi-createcontractgap"></a>

## createContractGap

Kind: function

```ts
export declare function createContractGap(key: MobileGatewaySurfaceKey, note?: string): MobileGatewayContractGap;
```

<a id="symbol-extensions-cavi-createemptydelegatedtransport"></a>

## createEmptyDelegatedTransport

Kind: function

```ts
export declare function createEmptyDelegatedTransport(): OperatorControlSnapshot["status"]["delegatedFirstClassAgents"];
```

<a id="symbol-extensions-cavi-createemptyoperatormemory"></a>

## createEmptyOperatorMemory

Kind: function

```ts
export declare function createEmptyOperatorMemory(): OperatorControlSnapshot["memory"];
```

<a id="symbol-extensions-cavi-createemptyoperatorregistry"></a>

## createEmptyOperatorRegistry

Kind: function

```ts
export declare function createEmptyOperatorRegistry(): OperatorControlSnapshot["registryDetail"];
```

<a id="symbol-extensions-cavi-createemptyoperatorsectionstatus"></a>

## createEmptyOperatorSectionStatus

Kind: function

```ts
export declare function createEmptyOperatorSectionStatus(): OperatorControlSnapshot["sectionStatus"];
```

<a id="symbol-extensions-cavi-createemptyoperatorstatus"></a>

## createEmptyOperatorStatus

Kind: function

```ts
export declare function createEmptyOperatorStatus(): OperatorControlSnapshot["status"];
```

<a id="symbol-extensions-cavi-createemptyoperatortasks"></a>

## createEmptyOperatorTasks

Kind: function

```ts
export declare function createEmptyOperatorTasks(): OperatorControlSnapshot["tasks"];
```

<a id="symbol-extensions-cavi-createemptyworkertransport"></a>

## createEmptyWorkerTransport

Kind: function

```ts
export declare function createEmptyWorkerTransport(): OperatorControlSnapshot["status"]["worker"];
```

<a id="symbol-extensions-cavi-createhermesruntimecontrolclient"></a>

## createHermesRuntimeControlClient

Kind: function

```ts
/**
 * Hermes runtime-control client with the CAVI Control plane layered on.
 *
 * Everything here is the provider's own factory; this only supplies the
 * modules CAVI serves differently. Without `cavi`, the native factory already
 * returns a full client — `tasks` comes from the kanban plugin Hermes ships.
 */
export declare function createHermesRuntimeControlClient(options: RuntimeControlClientOptions & HermesCaviRuntimeControlOptions): Promise<RuntimeControlClient>;
```

<a id="symbol-extensions-cavi-createhermesteamregistry"></a>

## createHermesTeamRegistry

Kind: function

```ts
export declare function createHermesTeamRegistry(config?: TeamRegistryConfig): TeamRegistry;
```

<a id="symbol-extensions-cavi-createopenclawteamregistry"></a>

## createOpenClawTeamRegistry

Kind: function

```ts
export declare function createOpenClawTeamRegistry(config?: TeamRegistryConfig): TeamRegistry;
```

<a id="symbol-extensions-cavi-createoperatorsectionstatus"></a>

## createOperatorSectionStatus

Kind: function

```ts
export declare function createOperatorSectionStatus<TKey extends OperatorControlSectionKey>(params: {
    available: boolean;
    authoritative: boolean;
    error: string | null;
    sampleLimit: number | null;
}): OperatorControlSnapshot["sectionStatus"][TKey];
```

<a id="symbol-extensions-cavi-createportalttsagentvoiceassignment"></a>

## createPortalTtsAgentVoiceAssignment

Kind: function

```ts
export declare function createPortalTtsAgentVoiceAssignment(params: {
    agentKey: string;
    voice: PortalTtsVoiceOption;
    assignedAt?: string;
}): PortalTtsAgentVoiceAssignment;
```

<a id="symbol-extensions-cavi-createteamregistry"></a>

## createTeamRegistry

Kind: function

```ts
export declare function createTeamRegistry(config?: TeamRegistryConfig, options?: CreateTeamRegistryOptions): TeamRegistry;
```

<a id="symbol-extensions-cavi-createteamregistryfromsnapshot"></a>

## createTeamRegistryFromSnapshot

Kind: function

```ts
export declare function createTeamRegistryFromSnapshot(snapshot: OperatorRegistrySnapshot | null | undefined, options?: CreateTeamRegistryOptions): TeamRegistry;
```

<a id="symbol-extensions-cavi-createteamregistryoptions"></a>

## CreateTeamRegistryOptions

Kind: type

```ts
export type CreateTeamRegistryOptions = {
    provider?: TeamRegistryProviderKind | null;
};
```

<a id="symbol-extensions-cavi-default-project-board-asset-dir"></a>

## DEFAULT_PROJECT_BOARD_ASSET_DIR

Kind: variable

```ts
/** Default project-board asset directory — neutral, not a fleet-agent slug. */
export declare const DEFAULT_PROJECT_BOARD_ASSET_DIR = "project-board";
```

<a id="symbol-extensions-cavi-delegationnode"></a>

## DelegationNode

Kind: type

```ts
export type DelegationNode = {
    taskId: string;
    agentId: string;
    objective: string;
    status: string;
    children: DelegationNode[];
    events: DiscourseEvent[];
    cost: {
        tokens: number;
        costUsd: number;
        durationMs: number | null;
    };
};
```

<a id="symbol-extensions-cavi-discourseblockerdata"></a>

## DiscourseBlockerData

Kind: type

```ts
export type DiscourseBlockerData = {
    blockerCode: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    retryable: boolean;
};
```

<a id="symbol-extensions-cavi-discourseblockerevent"></a>

## DiscourseBlockerEvent

Kind: type

```ts
export type DiscourseBlockerEvent = DiscourseEventBase & {
    type: "discourse.blocker";
    data: DiscourseBlockerData;
};
```

<a id="symbol-extensions-cavi-discoursecompletiondata"></a>

## DiscourseCompletionData

Kind: type

```ts
export type DiscourseCompletionData = {
    outcome: "ok" | "error" | "timeout" | "partial";
    resultSummary: string;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
};
```

<a id="symbol-extensions-cavi-discoursecompletionevent"></a>

## DiscourseCompletionEvent

Kind: type

```ts
export type DiscourseCompletionEvent = DiscourseEventBase & {
    type: "discourse.completion";
    data: DiscourseCompletionData;
};
```

<a id="symbol-extensions-cavi-discoursedecisiondata"></a>

## DiscourseDecisionData

Kind: type

```ts
export type DiscourseDecisionData = {
    question: string;
    chosenApproach: string;
    rationale: string;
    alternatives: Array<{
        approach: string;
        reasonRejected: string;
    }>;
};
```

<a id="symbol-extensions-cavi-discoursedecisionevent"></a>

## DiscourseDecisionEvent

Kind: type

```ts
export type DiscourseDecisionEvent = DiscourseEventBase & {
    type: "discourse.decision";
    data: DiscourseDecisionData;
};
```

<a id="symbol-extensions-cavi-discoursedelegationdata"></a>

## DiscourseDelegationData

Kind: type

```ts
export type DiscourseDelegationData = {
    targetAgentId: string;
    objective: string;
    teamId?: string;
    rationale?: string;
};
```

<a id="symbol-extensions-cavi-discoursedelegationevent"></a>

## DiscourseDelegationEvent

Kind: type

```ts
export type DiscourseDelegationEvent = DiscourseEventBase & {
    type: "discourse.delegation";
    data: DiscourseDelegationData;
};
```

<a id="symbol-extensions-cavi-discoursedispatchdata"></a>

## DiscourseDispatchData

Kind: type

```ts
export type DiscourseDispatchData = {
    targetAgentId: string;
    objective: string;
    tier: string;
    packetType: string;
    approachRationale?: string;
    alternativesConsidered?: string[];
};
```

<a id="symbol-extensions-cavi-discoursedispatchevent"></a>

## DiscourseDispatchEvent

Kind: type

```ts
export type DiscourseDispatchEvent = DiscourseEventBase & {
    type: "discourse.dispatch";
    data: DiscourseDispatchData;
};
```

<a id="symbol-extensions-cavi-discourseescalationdata"></a>

## DiscourseEscalationData

Kind: type

```ts
export type DiscourseEscalationData = {
    reason: string;
    target: string;
    severity?: "low" | "medium" | "high" | "critical";
};
```

<a id="symbol-extensions-cavi-discourseescalationevent"></a>

## DiscourseEscalationEvent

Kind: type

```ts
export type DiscourseEscalationEvent = DiscourseEventBase & {
    type: "discourse.escalation";
    data: DiscourseEscalationData;
};
```

<a id="symbol-extensions-cavi-discourseevent"></a>

## DiscourseEvent

Kind: type

```ts
export type DiscourseEvent = DiscourseDispatchEvent | DiscourseDelegationEvent | DiscourseDecisionEvent | DiscourseBlockerEvent | DiscourseResolutionEvent | DiscourseStatusEvent | DiscourseEscalationEvent | DiscourseCompletionEvent | DiscourseSpawnDedupEvent | DiscourseSpawnGuardEvent | DiscourseSpawnBudgetEvent;
```

<a id="symbol-extensions-cavi-discourseeventtype"></a>

## DiscourseEventType

Kind: type

```ts
export type DiscourseEventType = "discourse.dispatch" | "discourse.delegation" | "discourse.decision" | "discourse.blocker" | "discourse.resolution" | "discourse.status" | "discourse.escalation" | "discourse.completion" | "discourse.spawn.dedup" | "discourse.spawn.guard" | "discourse.spawn.budget";
```

<a id="symbol-extensions-cavi-discourseresolutiondata"></a>

## DiscourseResolutionData

Kind: type

```ts
export type DiscourseResolutionData = {
    originalBlockerEventId: string;
    resolution: string;
    method: "retry" | "workaround" | "escalate" | "skip";
};
```

<a id="symbol-extensions-cavi-discourseresolutionevent"></a>

## DiscourseResolutionEvent

Kind: type

```ts
export type DiscourseResolutionEvent = DiscourseEventBase & {
    type: "discourse.resolution";
    data: DiscourseResolutionData;
};
```

<a id="symbol-extensions-cavi-discoursespawnbudgetdata"></a>

## DiscourseSpawnBudgetData

Kind: type

```ts
export type DiscourseSpawnBudgetData = {
    recentFailureCount: number;
    blockStrikeCount: number;
    retryAfterMs: number;
};
```

<a id="symbol-extensions-cavi-discoursespawnbudgetevent"></a>

## DiscourseSpawnBudgetEvent

Kind: type

```ts
export type DiscourseSpawnBudgetEvent = DiscourseEventBase & {
    type: "discourse.spawn.budget";
    data: DiscourseSpawnBudgetData;
};
```

<a id="symbol-extensions-cavi-discoursespawndedupdata"></a>

## DiscourseSpawnDedupData

Kind: type

```ts
export type DiscourseSpawnDedupData = {
    targetAgentId: string;
    existingChildSessionKey: string;
    ttlMs: number;
};
```

<a id="symbol-extensions-cavi-discoursespawndedupevent"></a>

## DiscourseSpawnDedupEvent

Kind: type

```ts
export type DiscourseSpawnDedupEvent = DiscourseEventBase & {
    type: "discourse.spawn.dedup";
    data: DiscourseSpawnDedupData;
};
```

<a id="symbol-extensions-cavi-discoursespawnguarddata"></a>

## DiscourseSpawnGuardData

Kind: type

```ts
export type DiscourseSpawnGuardData = {
    targetAgentId: string;
    failureCode: string;
    strikeCount: number;
    ttlMs: number;
};
```

<a id="symbol-extensions-cavi-discoursespawnguardevent"></a>

## DiscourseSpawnGuardEvent

Kind: type

```ts
export type DiscourseSpawnGuardEvent = DiscourseEventBase & {
    type: "discourse.spawn.guard";
    data: DiscourseSpawnGuardData;
};
```

<a id="symbol-extensions-cavi-discoursestatusdata"></a>

## DiscourseStatusData

Kind: type

```ts
export type DiscourseStatusData = {
    prevState: string;
    nextState: string;
    note?: string;
};
```

<a id="symbol-extensions-cavi-discoursestatusevent"></a>

## DiscourseStatusEvent

Kind: type

```ts
export type DiscourseStatusEvent = DiscourseEventBase & {
    type: "discourse.status";
    data: DiscourseStatusData;
};
```

<a id="symbol-extensions-cavi-enrichedagentrun"></a>

## EnrichedAgentRun

Kind: type

```ts
export type EnrichedAgentRun = AgentRun & {
    taskId: string | null;
    taskState: OperatorTaskState | null;
    taskObjective: string | null;
    taskOwner: string | null;
    teamId: string | null;
    verification: string | null;
    discourseTaskId: string | null;
};
```

<a id="symbol-extensions-cavi-fleetlibrarysnapshot"></a>

## FleetLibrarySnapshot

Kind: type

```ts
export type FleetLibrarySnapshot = {
    generatedAt: number;
    teams: TeamLibraryStatus[];
    sigmund: {
        status: "online" | "offline" | "unknown";
        lastIngestAt: number | null;
        totalProcessed: number;
    };
};
```

<a id="symbol-extensions-cavi-gateway-kanban-board-path"></a>

## GATEWAY_KANBAN_BOARD_PATH

Kind: variable

```ts
export declare const GATEWAY_KANBAN_BOARD_PATH: string;
```

<a id="symbol-extensions-cavi-gateway-kanban-tasks-path"></a>

## GATEWAY_KANBAN_TASKS_PATH

Kind: variable

```ts
export declare const GATEWAY_KANBAN_TASKS_PATH: string;
```

<a id="symbol-extensions-cavi-gateway-rpc-methods"></a>

## GATEWAY_RPC_METHODS

Kind: variable

```ts
export declare const GATEWAY_RPC_METHODS: {
    readonly discourseTree: "discourse.tree";
};
```

<a id="symbol-extensions-cavi-gateway-ws-path"></a>

## GATEWAY_WS_PATH

Kind: variable

```ts
export declare const GATEWAY_WS_PATH: string;
```

<a id="symbol-extensions-cavi-gatewaytargets"></a>

## GatewayTargets

Kind: type

```ts
export type GatewayTargets = {
    rawBase: string;
    httpBase: string;
    wsBase: string;
    authToken: string | null;
    wsPath: string;
};
```

<a id="symbol-extensions-cavi-getconfiguredgatewaybaseurl"></a>

## getConfiguredGatewayBaseUrl

Kind: function

```ts
export declare function getConfiguredGatewayBaseUrl(): string | null;
```

<a id="symbol-extensions-cavi-getconfiguredteamregistry"></a>

## getConfiguredTeamRegistry

Kind: function

```ts
export declare function getConfiguredTeamRegistry(options?: CreateTeamRegistryOptions): TeamRegistry;
```

<a id="symbol-extensions-cavi-getfleetlibraryref"></a>

## getFleetLibraryRef

Kind: function

```ts
export declare function getFleetLibraryRef(): PortalLibraryRef;
```

<a id="symbol-extensions-cavi-getmobilegatewayendpointcontract"></a>

## getMobileGatewayEndpointContract

Kind: function

```ts
export declare function getMobileGatewayEndpointContract(key: MobileGatewaySurfaceKey): MobileGatewayEndpointContract;
```

<a id="symbol-extensions-cavi-getmobilegatewayendpointpath"></a>

## getMobileGatewayEndpointPath

Kind: function

```ts
export declare function getMobileGatewayEndpointPath(key: MobileGatewaySurfaceKey): string;
```

<a id="symbol-extensions-cavi-getoperatorteamlookupkeys"></a>

## getOperatorTeamLookupKeys

Kind: function

```ts
export declare function getOperatorTeamLookupKeys(team: OperatorRegistryTeam): string[];
```

<a id="symbol-extensions-cavi-getportalteamcode"></a>

## getPortalTeamCode

Kind: function

```ts
export declare function getPortalTeamCode(portalId: CaviTeamPortalId): string;
```

<a id="symbol-extensions-cavi-getportalteamidentity"></a>

## getPortalTeamIdentity

Kind: function

```ts
export declare function getPortalTeamIdentity(portalId: CaviTeamPortalId): OperatorRegistryTeam;
```

<a id="symbol-extensions-cavi-getportalteamsectorslug"></a>

## getPortalTeamSectorSlug

Kind: function

```ts
export declare function getPortalTeamSectorSlug(portalId: CaviTeamPortalId): string;
```

<a id="symbol-extensions-cavi-getportalteamslug"></a>

## getPortalTeamSlug

Kind: function

```ts
export declare function getPortalTeamSlug(portalId: CaviTeamPortalId): string;
```

<a id="symbol-extensions-cavi-getportalttsproviderlabel"></a>

## getPortalTtsProviderLabel

Kind: function

```ts
export declare function getPortalTtsProviderLabel(provider: PortalTtsProviderLike): string;
```

<a id="symbol-extensions-cavi-getprojectboardassetdir"></a>

## getProjectBoardAssetDir

Kind: function

```ts
/**
 * Project-board asset directory. Defaults to a neutral folder; a host can point
 * it at its own deployment's directory by setting `__CAVI_PROJECT_BOARD_ASSET_DIR__`.
 */
export declare function getProjectBoardAssetDir(): string;
```

<a id="symbol-extensions-cavi-getruntimebasepath"></a>

## getRuntimeBasePath

Kind: function

```ts
export declare function getRuntimeBasePath(): string;
```

<a id="symbol-extensions-cavi-getteamlookupkeys"></a>

## getTeamLookupKeys

Kind: function

```ts
export declare function getTeamLookupKeys(team: OperatorRegistryTeam): string[];
```

<a id="symbol-extensions-cavi-hermes-kanban-board-path"></a>

## HERMES_KANBAN_BOARD_PATH

Kind: variable

```ts
export declare const HERMES_KANBAN_BOARD_PATH: string;
```

<a id="symbol-extensions-cavi-hermes-kanban-tasks-path"></a>

## HERMES_KANBAN_TASKS_PATH

Kind: variable

```ts
export declare const HERMES_KANBAN_TASKS_PATH: string;
```

<a id="symbol-extensions-cavi-hermes-ws-path"></a>

## HERMES_WS_PATH

Kind: variable

```ts
export declare const HERMES_WS_PATH: string;
```

<a id="symbol-extensions-cavi-hermescaviruntimecontroloptions"></a>

## HermesCaviRuntimeControlOptions

Kind: interface

```ts
export interface HermesCaviRuntimeControlOptions extends Omit<HermesRuntimeControlOptions, "overrides"> {
    /**
     * CAVI Control adapter options. When supplied, the CAVI operator plane backs
     * `workspace` (agent workspace identities from the operator registry, which
     * Hermes has no native equivalent for) and `tasks`.
     */
    cavi?: CaviControlAdapterOptions;
}
```

<a id="symbol-extensions-cavi-hermesgatewaytargets"></a>

## HermesGatewayTargets

Kind: type

```ts
export type HermesGatewayTargets = GatewayTargets;
```

<a id="symbol-extensions-cavi-http-api-client-env-aliases"></a>

## HTTP_API_CLIENT_ENV_ALIASES

Kind: variable

```ts
export declare const HTTP_API_CLIENT_ENV_ALIASES: {
    readonly caviBaseUrl: readonly [
        "EXPO_PUBLIC_CAVI_API_BASE_URL",
        "EXPO_PUBLIC_CAVI_CONTROL_COMPAT_BASE_URL",
        "VITE_CAVI_API_BASE_URL"
    ];
    readonly caviAuthToken: readonly [
        "EXPO_PUBLIC_CAVI_API_AUTH_TOKEN",
        "EXPO_PUBLIC_GATEWAY_TOKEN",
        "VITE_CAVI_API_AUTH_TOKEN"
    ];
    readonly caviClientId: readonly [
        "EXPO_PUBLIC_CAVI_API_CLIENT_ID",
        "EXPO_PUBLIC_GATEWAY_CLIENT_ID",
        "VITE_CAVI_API_CLIENT_ID"
    ];
    readonly gatewayBaseUrl: readonly [
        "EXPO_PUBLIC_GATEWAY_API_BASE_URL",
        "VITE_GATEWAY_API_BASE_URL"
    ];
    readonly gatewayAuthToken: readonly [
        "EXPO_PUBLIC_GATEWAY_TOKEN",
        "EXPO_PUBLIC_GATEWAY_API_AUTH_TOKEN",
        "VITE_GATEWAY_API_AUTH_TOKEN"
    ];
    readonly gatewayClientId: readonly [
        "EXPO_PUBLIC_GATEWAY_CLIENT_ID",
        "EXPO_PUBLIC_GATEWAY_API_CLIENT_ID",
        "VITE_GATEWAY_API_CLIENT_ID"
    ];
    readonly libraryBaseUrl: readonly [
        "EXPO_PUBLIC_LIBRARY_API_BASE_URL",
        "EXPO_PUBLIC_CAVI_LIBRARY_API_BASE_URL",
        "VITE_LIBRARY_API_BASE_URL"
    ];
    readonly libraryAuthToken: readonly [
        "EXPO_PUBLIC_LIBRARY_API_AUTH_TOKEN",
        "EXPO_PUBLIC_GATEWAY_TOKEN",
        "VITE_LIBRARY_API_AUTH_TOKEN"
    ];
    readonly libraryClientId: readonly [
        "EXPO_PUBLIC_LIBRARY_API_CLIENT_ID",
        "EXPO_PUBLIC_GATEWAY_CLIENT_ID",
        "VITE_LIBRARY_API_CLIENT_ID"
    ];
};
```

<a id="symbol-extensions-cavi-http-api-client-env-keys"></a>

## HTTP_API_CLIENT_ENV_KEYS

Kind: variable

```ts
export declare const HTTP_API_CLIENT_ENV_KEYS: {
    readonly caviBaseUrl: "CAVI_API_BASE_URL";
    readonly caviAuthToken: "CAVI_API_AUTH_TOKEN";
    readonly caviClientId: "CAVI_API_CLIENT_ID";
    readonly gatewayBaseUrl: "GATEWAY_API_BASE_URL";
    readonly gatewayAuthToken: "GATEWAY_API_AUTH_TOKEN";
    readonly gatewayClientId: "GATEWAY_API_CLIENT_ID";
    readonly libraryBaseUrl: "LIBRARY_API_BASE_URL";
    readonly libraryAuthToken: "LIBRARY_API_AUTH_TOKEN";
    readonly libraryClientId: "LIBRARY_API_CLIENT_ID";
};
```

<a id="symbol-extensions-cavi-httpapiresolvedconfig"></a>

## HttpApiResolvedConfig

Kind: type

```ts
export type HttpApiResolvedConfig = {
    cavi: HttpApiSurfaceConfig;
    gateway: HttpApiSurfaceConfig;
    library: HttpApiSurfaceConfig;
};
```

<a id="symbol-extensions-cavi-library-api-base-path"></a>

## LIBRARY_API_BASE_PATH

Kind: variable

```ts
export declare const LIBRARY_API_BASE_PATH: "/api/plugins/library";
```

<a id="symbol-extensions-cavi-library-api-endpoints"></a>

## LIBRARY_API_ENDPOINTS

Kind: variable

```ts
export declare const LIBRARY_API_ENDPOINTS: {
    readonly root: "/api/plugins/library";
    readonly search: "/api/plugins/library/search";
    readonly ingest: "/api/plugins/library/ingest";
    readonly documents: "/api/plugins/library/documents";
    readonly fleetStatus: "/api/plugins/library/fleet-status";
    readonly status: "/api/plugins/library/status";
    readonly inbox: "/api/plugins/library/inbox";
    readonly promotable: "/api/plugins/library/promotable";
    readonly reviewRequests: "/api/plugins/library/review-requests";
    readonly clip: "/api/plugins/library/clip";
    readonly clipHealth: "/api/plugins/library/clip/health";
    readonly clipSchema: "/api/plugins/library/clip/schema";
    readonly clipLogs: "/api/plugins/library/clip/logs";
    readonly document: (id: string) => string;
};
```

<a id="symbol-extensions-cavi-library-clip-default-team"></a>

## LIBRARY_CLIP_DEFAULT_TEAM

Kind: variable

```ts
export declare const LIBRARY_CLIP_DEFAULT_TEAM = "library";
```

<a id="symbol-extensions-cavi-library-clip-endpoint"></a>

## LIBRARY_CLIP_ENDPOINT

Kind: variable

```ts
export declare const LIBRARY_CLIP_ENDPOINT: "/api/plugins/library/clip";
```

<a id="symbol-extensions-cavi-library-clip-health-endpoint"></a>

## LIBRARY_CLIP_HEALTH_ENDPOINT

Kind: variable

```ts
export declare const LIBRARY_CLIP_HEALTH_ENDPOINT: "/api/plugins/library/clip/health";
```

<a id="symbol-extensions-cavi-library-clip-logs-endpoint"></a>

## LIBRARY_CLIP_LOGS_ENDPOINT

Kind: variable

```ts
export declare const LIBRARY_CLIP_LOGS_ENDPOINT: "/api/plugins/library/clip/logs";
```

<a id="symbol-extensions-cavi-library-clip-schema-endpoint"></a>

## LIBRARY_CLIP_SCHEMA_ENDPOINT

Kind: variable

```ts
export declare const LIBRARY_CLIP_SCHEMA_ENDPOINT: "/api/plugins/library/clip/schema";
```

<a id="symbol-extensions-cavi-library-clip-source-tag"></a>

## LIBRARY_CLIP_SOURCE_TAG

Kind: variable

```ts
export declare const LIBRARY_CLIP_SOURCE_TAG = "caviclip";
```

<a id="symbol-extensions-cavi-libraryapiclient"></a>

## LibraryApiClient

Kind: class

```ts
export declare class LibraryApiClient extends BaseHttpApiClient {
    readonly endpoints: {
        readonly root: "/api/plugins/library";
        readonly search: "/api/plugins/library/search";
        readonly ingest: "/api/plugins/library/ingest";
        readonly documents: "/api/plugins/library/documents";
        readonly fleetStatus: "/api/plugins/library/fleet-status";
        readonly status: "/api/plugins/library/status";
        readonly inbox: "/api/plugins/library/inbox";
        readonly promotable: "/api/plugins/library/promotable";
        readonly reviewRequests: "/api/plugins/library/review-requests";
        readonly clip: "/api/plugins/library/clip";
        readonly clipHealth: "/api/plugins/library/clip/health";
        readonly clipSchema: "/api/plugins/library/clip/schema";
        readonly clipLogs: "/api/plugins/library/clip/logs";
        readonly document: (id: string) => string;
    };
    readonly request: HttpApiTransport;
    constructor(options: HttpApiClientOptions);
    ingest(body: LibraryIngestRequest, idempotencyKey?: string): Promise<LibraryIngestResult>;
    search<T = unknown>(query: Record<string, string | number | boolean | undefined>): Promise<T>;
    getDocument<T = unknown>(id: string): Promise<T>;
}
```

<a id="symbol-extensions-cavi-libraryclipdiagnosticscheck"></a>

## LibraryClipDiagnosticsCheck

Kind: type

```ts
export type LibraryClipDiagnosticsCheck = {
    id: "clip-endpoint" | "pipeline-status" | "clip-health" | "clip-schema" | "clip-logs";
    label: string;
    path: string;
    ok: boolean;
    status?: number;
    message: string;
    source: "local-contract" | "gateway";
};
```

<a id="symbol-extensions-cavi-libraryclipdiagnosticslog"></a>

## LibraryClipDiagnosticsLog

Kind: type

```ts
export type LibraryClipDiagnosticsLog = {
    at?: string;
    level?: string;
    message: string;
    path?: string;
};
```

<a id="symbol-extensions-cavi-libraryclipdiagnosticssnapshot"></a>

## LibraryClipDiagnosticsSnapshot

Kind: type

```ts
export type LibraryClipDiagnosticsSnapshot = {
    fetchedAt: number;
    endpoint: typeof LIBRARY_CLIP_ENDPOINT;
    schema: LibraryClipSchemaSnapshot | Record<string, unknown>;
    schemaSource: "local-contract" | "gateway";
    checks: LibraryClipDiagnosticsCheck[];
    logs: LibraryClipDiagnosticsLog[];
};
```

<a id="symbol-extensions-cavi-libraryclipinput"></a>

## LibraryClipInput

Kind: type

```ts
export type LibraryClipInput = {
    title?: string | null;
    sourceUrl?: string | null;
    text?: string | null;
    team?: string | null;
    tags?: readonly string[] | null;
    note?: string | null;
    metadata?: Record<string, unknown> | null;
    capturedAt?: string | null;
};
```

<a id="symbol-extensions-cavi-librarycliprequest"></a>

## LibraryClipRequest

Kind: type

```ts
export type LibraryClipRequest = {
    title: string;
    team: string;
    tags: string[];
    note: string;
    source_url?: string;
    text?: string;
    metadata: Record<string, unknown>;
};
```

<a id="symbol-extensions-cavi-libraryclipresult"></a>

## LibraryClipResult

Kind: type

```ts
export type LibraryClipResult = {
    accepted?: boolean;
    id?: string;
    clip_id?: string;
    jobId?: string;
    message?: string;
    errors?: Array<{
        field?: string;
        message: string;
    }>;
    [key: string]: unknown;
};
```

<a id="symbol-extensions-cavi-libraryclipschemafield"></a>

## LibraryClipSchemaField

Kind: type

```ts
export type LibraryClipSchemaField = {
    type: string;
    required: boolean;
    description: string;
};
```

<a id="symbol-extensions-cavi-libraryclipschemasnapshot"></a>

## LibraryClipSchemaSnapshot

Kind: type

```ts
export type LibraryClipSchemaSnapshot = {
    contract: "LIBRARY_CLIP_V1";
    endpoint: typeof LIBRARY_CLIP_ENDPOINT;
    method: "POST";
    fields: Record<keyof LibraryClipRequest, LibraryClipSchemaField>;
    example: LibraryClipRequest;
};
```

<a id="symbol-extensions-cavi-librarycliptransport"></a>

## LibraryClipTransport

Kind: type

```ts
export type LibraryClipTransport = <T>(path: string, init?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
}) => Promise<T>;
```

<a id="symbol-extensions-cavi-libraryingestrequest"></a>

## LibraryIngestRequest

Kind: type

```ts
export type LibraryIngestRequest = {
    source: LibraryIngestSource;
    workspaceId?: string;
    channelId?: string;
    threadId?: string;
    requestedBy?: string;
};
```

<a id="symbol-extensions-cavi-libraryingestresult"></a>

## LibraryIngestResult

Kind: type

```ts
export type LibraryIngestResult = {
    accepted: boolean;
    id?: string;
    jobId?: string;
    message?: string;
    errors?: Array<{
        field?: string;
        message: string;
    }>;
};
```

<a id="symbol-extensions-cavi-libraryingestsource"></a>

## LibraryIngestSource

Kind: type

```ts
export type LibraryIngestSource = {
    kind: "url" | "text" | "file" | "note";
    uri?: string;
    title?: string;
    text?: string;
    mimeType?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-extensions-cavi-librarymanualfileclipinput"></a>

## LibraryManualFileClipInput

Kind: type

```ts
export type LibraryManualFileClipInput = {
    name: string;
    uri?: string | null;
    mimeType?: string | null;
    size?: number | null;
    text?: string | null;
    capturedAt?: string | null;
};
```

<a id="symbol-extensions-cavi-librarynote"></a>

## LibraryNote

Kind: type

```ts
export type LibraryNote = {
    schema_version: number;
    id: string;
    note_type: LibraryNoteType;
    title: string;
    aliases: string[];
    tags: string[];
    domains: string[];
    summary: string;
    status: LibraryStatus;
    verification: LibraryVerification;
    language: string;
    sensitivity: LibrarySensitivity;
    compiled_at: string;
    compiled_by: string;
    content_hash: string;
    reviewed_at: string | null;
    reviewed_by: string | null;
    sources: LibrarySourceEntry[];
};
```

<a id="symbol-extensions-cavi-librarynotetype"></a>

## LibraryNoteType

Kind: type

```ts
/** Fleet Library Schema v1 — team library status and candidate data for Cavi Control. */
export type LibraryNoteType = "concept" | "source" | "meeting" | "decision" | "transcript" | "synthesis" | "person" | "org" | "project";
```

<a id="symbol-extensions-cavi-librarysensitivity"></a>

## LibrarySensitivity

Kind: type

```ts
export type LibrarySensitivity = "public" | "internal" | "confidential";
```

<a id="symbol-extensions-cavi-librarysourceentry"></a>

## LibrarySourceEntry

Kind: type

```ts
export type LibrarySourceEntry = {
    uri: string;
    title?: string;
    kind: "web" | "file" | "repo" | "meeting" | "chat" | "manual";
    format: "html" | "pdf" | "md" | "txt" | "audio" | "video" | "email" | "json";
    capture_method: "clip" | "upload" | "transcription" | "manual" | "agent";
    captured_at: string;
    author?: string;
    site?: string;
    published_at?: string;
};
```

<a id="symbol-extensions-cavi-librarystatus"></a>

## LibraryStatus

Kind: type

```ts
export type LibraryStatus = "draft" | "active" | "archived";
```

<a id="symbol-extensions-cavi-libraryverification"></a>

## LibraryVerification

Kind: type

```ts
export type LibraryVerification = "unreviewed" | "reviewed" | "disputed";
```

<a id="symbol-extensions-cavi-listcaviteamportalids"></a>

## listCaviTeamPortalIds

Kind: function

```ts
export declare function listCaviTeamPortalIds(): string[];
```

<a id="symbol-extensions-cavi-listcompiledcanonicalteams"></a>

## listCompiledCanonicalTeams

Kind: function

```ts
export declare function listCompiledCanonicalTeams(): OperatorRegistryTeam[];
```

<a id="symbol-extensions-cavi-listportallibraryrefs"></a>

## listPortalLibraryRefs

Kind: function

```ts
export declare function listPortalLibraryRefs(): PortalLibraryRef[];
```

<a id="symbol-extensions-cavi-loadoperatorcontrolsection"></a>

## loadOperatorControlSection

Kind: function

```ts
export declare function loadOperatorControlSection<TKey extends OperatorControlSectionKey, TData>(params: {
    key: TKey;
    run: () => Promise<TData>;
    fallback: () => TData;
    authoritative: boolean;
    sampleLimit: number | null;
    expectedContract: string;
    note: string;
}): Promise<OperatorSectionLoadResult<TKey, TData>>;
```

<a id="symbol-extensions-cavi-matchesoperatorteamidentifier"></a>

## matchesOperatorTeamIdentifier

Kind: function

```ts
export declare function matchesOperatorTeamIdentifier(team: OperatorRegistryTeam, identifier: string | null | undefined): boolean;
```

<a id="symbol-extensions-cavi-matchestasktargettoteam"></a>

## matchesTaskTargetToTeam

Kind: function

```ts
export declare function matchesTaskTargetToTeam(target: {
    team_id?: string | null;
    team_slug?: string | null;
}, team: OperatorRegistryTeam): boolean;
```

<a id="symbol-extensions-cavi-matchesteamidentifier"></a>

## matchesTeamIdentifier

Kind: function

```ts
export declare function matchesTeamIdentifier(team: OperatorRegistryTeam, identifier: string | null | undefined): boolean;
```

<a id="symbol-extensions-cavi-mobile-gateway-endpoint-contracts"></a>

## MOBILE_GATEWAY_ENDPOINT_CONTRACTS

Kind: variable

```ts
export declare const MOBILE_GATEWAY_ENDPOINT_CONTRACTS: {
    readonly providerConfig: {
        readonly surface: "provider-config";
        readonly path: "http-base + /v1/*, /health*; ws-base + /api/ws";
        readonly owner: "mobile gateway owner";
        readonly note: "Resolve explicit HTTP and WS targets from the saved gateway URL; preserve bearer auth.";
    };
    readonly preflightHealth: {
        readonly surface: "preflight-health";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "mobile gateway owner";
        readonly note: "Primary reachability check for the selected gateway API server.";
    };
    readonly preflightHealthDetailed: {
        readonly surface: "preflight-health-detailed";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "mobile gateway owner";
        readonly note: "Detailed health check; failures should be reported without hiding the basic health result.";
    };
    readonly preflightCapabilities: {
        readonly surface: "preflight-capabilities";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "mobile gateway owner";
        readonly note: "Authenticated API-server capability proof for saved bearer tokens.";
    };
    readonly websocketSession: {
        readonly surface: "websocket-session";
        readonly path: string;
        readonly owner: "mobile gateway owner";
        readonly note: "Dashboard/TUI JSON-RPC for chat, sessions, logs, and health/status.";
    };
    readonly gatewayMediaProviders: {
        readonly surface: "gateway-media-providers";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Shared media provider inventory for audio, image, video, and music generation across gateways.";
    };
    readonly gatewayMediaAudio: {
        readonly surface: "gateway-media-audio";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core audio generation route exposed through the provider-neutral media client.";
    };
    readonly gatewayMediaImage: {
        readonly surface: "gateway-media-image";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core image generation route exposed through the provider-neutral media client.";
    };
    readonly gatewayMediaVideo: {
        readonly surface: "gateway-media-video";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core video generation route exposed through the provider-neutral media client.";
    };
    readonly gatewayMediaMusic: {
        readonly surface: "gateway-media-music";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core music generation route exposed through the provider-neutral media client.";
    };
    readonly gatewayMediaJob: {
        readonly surface: "gateway-media-job";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core media job status route used by audio, image, video, and music generation.";
    };
    readonly gatewayMediaAssets: {
        readonly surface: "gateway-media-assets";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core media asset inventory route.";
    };
    readonly gatewayMediaAsset: {
        readonly surface: "gateway-media-asset";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/media contract";
        readonly note: "Core media asset bytes and metadata route.";
    };
    readonly gatewayWikiVaults: {
        readonly surface: "gateway-wiki-vaults";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core wiki vault inventory for external Obsidian/QMD plugin vaults.";
    };
    readonly gatewayWikiTree: {
        readonly surface: "gateway-wiki-tree";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core wiki tree route.";
    };
    readonly gatewayWikiRead: {
        readonly surface: "gateway-wiki-read";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core wiki read route for QMD/Markdown pages.";
    };
    readonly gatewayWikiIngest: {
        readonly surface: "gateway-wiki-ingest";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core wiki ingest route used by external wiki plugins.";
    };
    readonly gatewayWikiCompile: {
        readonly surface: "gateway-wiki-compile";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core QMD compile route for wiki pages and collections.";
    };
    readonly gatewayWikiPromote: {
        readonly surface: "gateway-wiki-promote";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/wiki contract";
        readonly note: "Core wiki promotion route for durable vault publishing.";
    };
    readonly costHistory: {
        readonly surface: "cost-history";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/cavi owner";
        readonly note: "CAVI cost history endpoint.";
    };
    readonly operatorStatus: {
        readonly surface: "operator-status";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/cavi owner";
        readonly note: "Operator-status endpoint used as an HTTP preflight fallback.";
    };
    readonly operatorSnapshot: {
        readonly surface: "operator-snapshot";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/cavi owner";
        readonly note: "CAVI Control operator aggregate snapshot for mobile and portal fallbacks.";
    };
    readonly operatorTaskDispatch: {
        readonly surface: "operator-task-dispatch";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "ODB + gateway owner";
        readonly note: "OperatorTaskCreateRequest is accepted by the unified CAVI Control operator task endpoint.";
    };
    readonly kanbanTasks: {
        readonly surface: "kanban-tasks";
        readonly method: "POST";
        readonly path: string;
        readonly owner: "gateway/kanban owner";
        readonly note: "Kanban-native task creation remains a separate gateway surface from the CAVI Control operator task endpoint.";
    };
    readonly kanbanBoard: {
        readonly surface: "kanban-board";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/kanban owner";
        readonly note: "Unified Kanban board through bearer-authenticated /api/plugins/kanban/board for Project Board and Operator visibility.";
    };
    readonly teamWorkspace: {
        readonly surface: "team-workspace";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/team contract";
        readonly note: "Agnostic team-owned folder route; resolve the concrete path through the team manifest whitelist.";
    };
    readonly teamAgentWorkspace: {
        readonly surface: "team-agent-workspace";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "gateway/team contract";
        readonly note: "Agnostic agent-owned media/research folder route; resolve concrete paths through the team manifest whitelist.";
    };
    readonly fleetLibrary: {
        readonly surface: "fleet-library";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "library gateway owner";
        readonly note: "Base fleet snapshot; mobile enriches it with library status, inbox, promotable, and review-request paths when available.";
    };
    readonly libraryPipelineStatus: {
        readonly surface: "library-pipeline-status";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "library gateway owner";
        readonly note: "Library ingest pipeline counters used by the mobile forge and fleet summaries.";
    };
    readonly libraryPipelineInbox: {
        readonly surface: "library-pipeline-inbox";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "library gateway owner";
        readonly note: "Optional inbox item detail for assigning arrival pressure to library lanes.";
    };
    readonly libraryPromotable: {
        readonly surface: "library-promotable";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "library gateway owner";
        readonly note: "Promotable note rows used to hydrate the library board, promotions, and graph surfaces.";
    };
    readonly libraryReviewRequests: {
        readonly surface: "library-review-requests";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "library gateway owner";
        readonly note: "Review-request state joined onto promotable notes before mobile renders library operation rows.";
    };
    readonly vaultTree: {
        readonly surface: "vault-tree";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "vault/gateway owner";
        readonly note: "Obsidian vault tree route.";
    };
    readonly vaultRead: {
        readonly surface: "vault-read";
        readonly method: "GET";
        readonly path: string;
        readonly owner: "vault/gateway owner";
        readonly note: "Obsidian file read route.";
    };
};
```

<a id="symbol-extensions-cavi-mobilegatewaycontractgap"></a>

## MobileGatewayContractGap

Kind: type

```ts
export type MobileGatewayContractGap = {
    area: string;
    expectedContract: string;
    note: string;
    reason: "backend-not-configured" | "unknown";
};
```

<a id="symbol-extensions-cavi-mobilegatewayendpointcontract"></a>

## MobileGatewayEndpointContract

Kind: type

```ts
export type MobileGatewayEndpointContract = {
    surface: string;
    method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
    path: string;
    owner: string;
    note: string;
};
```

<a id="symbol-extensions-cavi-mobilegatewaysurfacekey"></a>

## MobileGatewaySurfaceKey

Kind: type

```ts
export type MobileGatewaySurfaceKey = keyof typeof MOBILE_GATEWAY_ENDPOINT_CONTRACTS;
```

<a id="symbol-extensions-cavi-normalizediscourseevent"></a>

## normalizeDiscourseEvent

Kind: function

```ts
export declare function normalizeDiscourseEvent(raw: unknown, fallbackTaskId: string): DiscourseEvent | null;
```

<a id="symbol-extensions-cavi-normalizesessionagentid"></a>

## normalizeSessionAgentId

Kind: function

```ts
export declare function normalizeSessionAgentId(value: string | null | undefined): string | null;
```

<a id="symbol-extensions-cavi-normalizesessionkey"></a>

## normalizeSessionKey

Kind: function

```ts
export declare function normalizeSessionKey(value: string | null | undefined): string | null;
```

<a id="symbol-extensions-cavi-normalizetaskdiscoursesnapshot"></a>

## normalizeTaskDiscourseSnapshot

Kind: function

```ts
export declare function normalizeTaskDiscourseSnapshot(raw: unknown, fallbackTaskId: string): TaskDiscourseSnapshot;
```

<a id="symbol-extensions-cavi-normalizeteamlookupvalue"></a>

## normalizeTeamLookupValue

Kind: function

```ts
/** Canonical identifier normalization. Verbatim copy of the CAVI registry rule. */
export declare function normalizeTeamLookupValue(value: string): string;
```

<a id="symbol-extensions-cavi-normalizeteamregistryteam"></a>

## normalizeTeamRegistryTeam

Kind: function

```ts
export declare function normalizeTeamRegistryTeam(team: TeamRegistryTeamConfig, fallback?: OperatorRegistryTeam | null): OperatorRegistryTeam;
```

<a id="symbol-extensions-cavi-operator-dispatch-endpoints"></a>

## OPERATOR_DISPATCH_ENDPOINTS

Kind: variable

```ts
export declare const OPERATOR_DISPATCH_ENDPOINTS: {
    readonly message: "/api/message";
    readonly operatorEvents: "/operator/events";
    readonly taskReceiptsTemplate: "/cavi-control/api/tasks/{taskId}/receipts";
};
```

<a id="symbol-extensions-cavi-operator-memory-sample-limit"></a>

## OPERATOR_MEMORY_SAMPLE_LIMIT

Kind: variable

```ts
export declare const OPERATOR_MEMORY_SAMPLE_LIMIT = 20;
```

<a id="symbol-extensions-cavi-operator-task-sample-limit"></a>

## OPERATOR_TASK_SAMPLE_LIMIT

Kind: variable

```ts
export declare const OPERATOR_TASK_SAMPLE_LIMIT = 20;
```

<a id="symbol-extensions-cavi-operatorcontrolexpectedcontractsummary"></a>

## operatorControlExpectedContractSummary

Kind: function

```ts
export declare function operatorControlExpectedContractSummary(): string;
```

<a id="symbol-extensions-cavi-operatorcontrolsectionkey"></a>

## OperatorControlSectionKey

Kind: type

```ts
export type OperatorControlSectionKey = "status" | "registryDetail" | "tasks" | "memory";
```

<a id="symbol-extensions-cavi-operatorcontrolsectionstatus"></a>

## OperatorControlSectionStatus

Kind: type

```ts
export type OperatorControlSectionStatus = {
    available: boolean;
    authoritative: boolean;
    error: string | null;
    sampleLimit: number | null;
};
```

<a id="symbol-extensions-cavi-operatorcontrolsnapshot"></a>

## OperatorControlSnapshot

Kind: type

```ts
export type OperatorControlSnapshot = {
    status: OperatorControlStatusSnapshot;
    registryDetail: OperatorRegistrySnapshot;
    tasks: OperatorTaskListSnapshot;
    memory: OperatorSharedMemorySnapshot;
    sectionStatus: Record<OperatorControlSectionKey, OperatorControlSectionStatus>;
};
```

<a id="symbol-extensions-cavi-operatorcontrolstatussnapshot"></a>

## OperatorControlStatusSnapshot

Kind: type

```ts
export type OperatorControlStatusSnapshot = {
    primaryOperator: string;
    fallbackOperator: string;
    authorityMode: "authoritative-failover";
    taskStorePath: string;
    registry: {
        agentCount: number;
        teamCount: number;
        sourcePath: string;
        sourceHash: string;
        generatedAt: number;
    };
    taskSummary: {
        primaryOperator: string;
        fallbackOperator: string;
        authorityMode?: "authoritative-failover";
        tasks: Record<OperatorTaskState, number>;
        totals: {
            total: number;
            terminal: number;
            active: number;
        };
    };
    runtimes: {
        acpBackendId: string | null;
        acpBackendHealthy: boolean;
        sharedMemoryAuthority: OperatorSharedMemoryAuthority;
    };
    sharedMemory: {
        storePath: string;
        collections: Record<OperatorSharedMemoryCollection, OperatorMemoryCollectionSummary>;
    };
    legacyWorkerFleet: OperatorWorkerTransportSnapshot;
    delegatedFirstClassAgents: OperatorDelegatedTransportSnapshot;
    worker: OperatorWorkerTransportSnapshot;
    mesh: {
        legacyExecutionFleet: OperatorWorkerTransportSnapshot;
        delegatedFirstClassAgents: OperatorDelegatedTransportSnapshot;
        executionFleet: OperatorWorkerTransportSnapshot;
        projectOps: {
            mode: "task-lifecycle";
            configured: boolean;
            baseUrl: string | null;
            eventEndpoint: string | null;
            authScheme: "bearer" | null;
            authEnv: string | null;
            authConfigured: boolean;
        };
        domainOrchestrators: OperatorDelegatedTransportSnapshot;
        marketing: OperatorDelegatedTransportSnapshot;
        research: OperatorDelegatedTransportSnapshot;
    };
};
```

<a id="symbol-extensions-cavi-operatordelegatedtransportsnapshot"></a>

## OperatorDelegatedTransportSnapshot

Kind: type

```ts
export type OperatorDelegatedTransportSnapshot = {
    dispatchTransport: "delegated-http";
    transportAliases: string[];
    role: "delegated-first-class-agent-boundary";
    configured: boolean;
    baseUrl: string | null;
    authScheme: "bearer" | null;
    authEnv: string | null;
    authConfigured: boolean;
    globalDefaultAlias: string | null;
    servedTeams: string[];
    leadAliases: string[];
    defaultAliasByTeam: Record<string, string>;
    teamTopology: Array<{
        teamId: string;
        declaredTransport: string | null;
        resolvedTransport: "delegated-http";
        leadAlias: string | null;
        defaultAlias: string | null;
        dispatchEndpointEnv: string | null;
        dispatchPath: string | null;
        dispatchAuthEnv: string | null;
        resolvedBaseUrl: string | null;
        resolvedEndpoint: string | null;
        authConfigured: boolean;
        /** When resolvedBaseUrl is null: which env vars to set on the gateway (no secret values). */
        urlResolutionHint?: string | null;
    }>;
    legacyTeams: string[];
};
```

<a id="symbol-extensions-cavi-operatormemorycollectionsummary"></a>

## OperatorMemoryCollectionSummary

Kind: type

```ts
export type OperatorMemoryCollectionSummary = {
    count: number;
    lastVerifiedAt: number | null;
    writeMode: "append-only" | "upsert";
};
```

<a id="symbol-extensions-cavi-operatormemoryrecord"></a>

## OperatorMemoryRecord

Kind: type

```ts
export type OperatorMemoryRecord = {
    collection: OperatorSharedMemoryCollection;
    recordId: string;
    scopeKey: string;
    summary: string | null;
    content: Record<string, unknown>;
    metadata: {
        source: string;
        writer: string;
        evidence_ref: string;
        verified_at: number;
        ttl_policy?: string;
    };
    promotedAt: number;
};
```

<a id="symbol-extensions-cavi-operatorregistryagent"></a>

## OperatorRegistryAgent

Kind: type

```ts
export type OperatorRegistryAgent = {
    id: string;
    name: string;
    role: string | null;
    specialty: string | null;
    model: string | null;
    skill: string | null;
    spawnTemplate: string | null;
    repos: string[];
    repoConfig: OperatorRegistryAgentRepoConfig | null;
    triggers: string[];
    notes: string | null;
    teams: string[];
    maxConcurrentSessions: number;
    capabilities: string[];
    mcpAccess: string[];
    reviewHandles: string[];
    executionMode: string | null;
    identity: OperatorRegistryAgentIdentity | null;
    ownership: OperatorRegistryAgentOwnership | null;
    roleBoundary: OperatorRegistryAgentRoleBoundary | null;
    tokenEnv: string | null;
    boardUrl: string | null;
    k8sService: string | null;
    delegatesTo: string[];
};
```

<a id="symbol-extensions-cavi-operatorregistryagentidentity"></a>

## OperatorRegistryAgentIdentity

Kind: type

```ts
export type OperatorRegistryAgentIdentity = {
    theme: string | null;
    avatar: string | null;
    rosterImage: string | null;
    cardImage: string | null;
    alt: string | null;
};
```

<a id="symbol-extensions-cavi-operatorregistryagentownership"></a>

## OperatorRegistryAgentOwnership

Kind: type

```ts
export type OperatorRegistryAgentOwnership = {
    parentOrchestrator: string | null;
    ownsDomains: string[];
    delegatesTo: string[];
    ownsOutputs: string[];
    runtimeSpecialists: string[];
};
```

<a id="symbol-extensions-cavi-operatorregistryagentrepoconfig"></a>

## OperatorRegistryAgentRepoConfig

Kind: type

```ts
export type OperatorRegistryAgentRepoConfig = {
    mode: "auto" | "manual" | "all";
    include: string[];
    exclude: string[];
    patterns: string[];
};
```

<a id="symbol-extensions-cavi-operatorregistryagentroleboundary"></a>

## OperatorRegistryAgentRoleBoundary

Kind: type

```ts
export type OperatorRegistryAgentRoleBoundary = {
    allowed: string[];
    forbidden: string[];
    enforcement: string | null;
};
```

<a id="symbol-extensions-cavi-operatorregistrydelegatedtransportconfig"></a>

## OperatorRegistryDelegatedTransportConfig

Kind: type

```ts
export type OperatorRegistryDelegatedTransportConfig = {
    globalDefaultAlias: string | null;
};
```

<a id="symbol-extensions-cavi-operatorregistryidentity"></a>

## OperatorRegistryIdentity

Kind: type

```ts
export type OperatorRegistryIdentity = {
    id: string;
    kind: "agent" | "runtime";
    name: string;
    role: string | null;
    capabilities: string[];
    teamIds: string[];
    leadTeamIds: string[];
    maxConcurrentSessions: number;
};
```

<a id="symbol-extensions-cavi-operatorregistryruntime"></a>

## OperatorRegistryRuntime

Kind: type

```ts
export type OperatorRegistryRuntime = {
    id: string;
    name: string | null;
    role: string | null;
    namespace: string | null;
    status: string | null;
    triggers: string[];
    maxConcurrentSessions: number;
    port: number | null;
    replicas: number | null;
    endpoints: string[];
    discordBotId: string | null;
};
```

<a id="symbol-extensions-cavi-operatorregistryruntimeconfig"></a>

## OperatorRegistryRuntimeConfig

Kind: type

```ts
export type OperatorRegistryRuntimeConfig = {
    transports: {
        delegatedHttp: OperatorRegistryDelegatedTransportConfig;
    };
};
```

<a id="symbol-extensions-cavi-operatorregistryskillownership"></a>

## OperatorRegistrySkillOwnership

Kind: type

```ts
export type OperatorRegistrySkillOwnership = {
    skill: string;
    owner: string;
    status: string | null;
};
```

<a id="symbol-extensions-cavi-operatorregistrysnapshot"></a>

## OperatorRegistrySnapshot

Kind: type

```ts
export type OperatorRegistrySnapshot = {
    schema: "OperatorAgentRegistryV1" | "OperatorAgentRegistryV2";
    generatedAt: number;
    sourcePath: string;
    sourceHash: string;
    agentCount: number;
    teamCount: number;
    operatorRuntime: OperatorRegistryRuntimeConfig;
    agents: OperatorRegistryAgent[];
    teams: OperatorRegistryTeam[];
    k8sCluster: OperatorRegistryRuntime[];
    identities: OperatorRegistryIdentity[];
    skillOwnership: OperatorRegistrySkillOwnership[];
};
```

<a id="symbol-extensions-cavi-operatorregistryteam"></a>

## OperatorRegistryTeam

Kind: type

```ts
export type OperatorRegistryTeam = {
    id: string;
    name: string;
    teamSlug: string;
    teamCode: string;
    sectorSlug: string;
    sectorCode: string;
    portalId: string | null;
    displayName: string;
    legacyAliases: string[];
    department: string | null;
    /** Deprecated; retained for compatibility while gateway transitions to `department`. */
    kind: string | null;
    parentTeamId: string | null;
    lead: string | null;
    leadKind: "agent" | "runtime" | "external" | null;
    routeViaLead: boolean;
    mission: string | null;
    members: string[];
    runtimeIds: string[];
    memberIdentityIds: string[];
    ownsCapabilities: string[];
    maxParallel: number | null;
    dispatchTransport: string | null;
    dispatchEndpointEnv: string | null;
    dispatchPath: string | null;
    dispatchAuthScheme: string | null;
    dispatchAuthEnv: string | null;
    dispatchDefaultAlias: string | null;
    routingPolicy: string | null;
    notes: string | null;
    ancestorTeamIds: string[];
    descendantTeamIds: string[];
    teamManifest: string | null;
    headOwnedAliases: string[];
    runtimeMembers: string[];
};
```

<a id="symbol-extensions-cavi-operatorsectionloadresult"></a>

## OperatorSectionLoadResult

Kind: type

```ts
export type OperatorSectionLoadResult<TKey extends OperatorControlSectionKey, TData> = {
    key: TKey;
    data: TData;
    status: OperatorControlSnapshot["sectionStatus"][TKey];
    contractGap: ContractGap | null;
};
```

<a id="symbol-extensions-cavi-operatorsharedmemoryauthority"></a>

## OperatorSharedMemoryAuthority

Kind: type

```ts
export type OperatorSharedMemoryAuthority = "qdrant" | "vector-memory" | "local-json-shim";
```

<a id="symbol-extensions-cavi-operatorsharedmemorycollection"></a>

## OperatorSharedMemoryCollection

Kind: type

```ts
export type OperatorSharedMemoryCollection = "service-context" | "task-outcomes" | "contract-registry" | "channel-events";
```

<a id="symbol-extensions-cavi-operatorsharedmemorysnapshot"></a>

## OperatorSharedMemorySnapshot

Kind: type

```ts
export type OperatorSharedMemorySnapshot = {
    authority: OperatorSharedMemoryAuthority;
    storePath: string;
    generatedAt: number;
    collections: Record<OperatorSharedMemoryCollection, OperatorMemoryCollectionSummary>;
    records: OperatorMemoryRecord[];
};
```

<a id="symbol-extensions-cavi-operatortaskdiscoursepath"></a>

## operatorTaskDiscoursePath

Kind: function

```ts
export declare function operatorTaskDiscoursePath(taskId: string): string;
```

<a id="symbol-extensions-cavi-operatortaskdiscoursepluginaliaspath"></a>

## operatorTaskDiscoursePluginAliasPath

Kind: function

```ts
export declare function operatorTaskDiscoursePluginAliasPath(taskId: string): string;
```

<a id="symbol-extensions-cavi-operatortaskdispatchmode"></a>

## OperatorTaskDispatchMode

Kind: type

```ts
export type OperatorTaskDispatchMode = "operator-task" | "kanban-native";
```

<a id="symbol-extensions-cavi-operatortasklistsnapshot"></a>

## OperatorTaskListSnapshot

Kind: type

```ts
export type OperatorTaskListSnapshot = {
    tasks: OperatorTaskRecord[];
    summary: Record<OperatorTaskState, number>;
};
```

<a id="symbol-extensions-cavi-operatortaskrecord"></a>

## OperatorTaskRecord

Kind: type

```ts
export type OperatorTaskRecord = {
    envelope: {
        task_id: string;
        parent_task_id?: string | null;
        requester: {
            id: string;
            kind: string;
        };
        target: {
            capability: string;
            team_id?: string | null;
            team_slug?: string | null;
            alias?: string | null;
        };
        objective: string;
        tier: OperatorTaskTier;
        acceptance_criteria: string[];
        timeout_s: number;
    };
    receipt: {
        task_id: string;
        run_id: string;
        state: OperatorTaskState;
        owner?: string | null;
        attempt: number;
        created_at: number;
        updated_at: number;
        queue_latency_ms?: number | null;
        artifacts: string[];
        failure_code?: string | null;
    };
    events: Array<{
        id: string;
        at: number;
        state: OperatorTaskState;
        note?: string | null;
        owner?: string | null;
        failureCode?: string | null;
    }>;
    validation: {
        validation_id: string;
        validator: string;
        result: "passed" | "failed" | "waived" | "pending";
    } | null;
    outcome: {
        outcome: "success" | "partial" | "fail" | "blocked";
        verification_status: "passed" | "failed" | "waived" | "pending";
        rework_needed: boolean;
        recorded_at: number;
    } | null;
};
```

<a id="symbol-extensions-cavi-operatortaskstate"></a>

## OperatorTaskState

Kind: type

```ts
export type OperatorTaskState = "accepted" | "queued" | "started" | "retrying" | "blocked" | "completed" | "dead-letter";
```

<a id="symbol-extensions-cavi-operatortasktier"></a>

## OperatorTaskTier

Kind: type

```ts
export type OperatorTaskTier = "LITE" | "STANDARD" | "HEAVY";
```

<a id="symbol-extensions-cavi-operatorworkertransportsnapshot"></a>

## OperatorWorkerTransportSnapshot

Kind: type

```ts
export type OperatorWorkerTransportSnapshot = {
    dispatchTransport: string;
    role: "legacy-worker-fleet";
    configured: boolean;
    baseUrl: string | null;
    receiptTemplate: string | null;
    authScheme: "bearer" | null;
    authEnv: string | null;
    authConfigured: boolean;
};
```

<a id="symbol-extensions-cavi-operatorworkflowlane"></a>

## OperatorWorkflowLane

Kind: type

```ts
export type OperatorWorkflowLane = {
    teamId: string;
    teamName: string;
    department: string | null;
    /** Deprecated; retained for compatibility while gateway transitions to `department`. */
    teamKind: string | null;
    runtimeIds: string[];
    runtimeName: string | null;
    runtimeRole: string | null;
    leadName: string | null;
    leadRole: string | null;
    transport: string;
    endpoint: string | null;
    authScheme: string | null;
    authEnv: string | null;
    configured: boolean;
    authConfigured: boolean;
    dispatchReady: boolean;
    status: OperatorWorkflowLaneStatus;
    /** Human-readable reason for degraded/unconfigured, or operational note for ready manual/local lanes */
    statusDetail: string | null;
    routingPolicy: string | null;
    tasksTotal: number;
    tasksCompleted: number;
    tasksBlocked: number;
    tasksFailed: number;
    tasksDeadLetter: number;
    tasksTimeout: number;
    successRate: number;
    failureRate: number;
    avgTimeToCompleteMs: number | null;
    runsTotal: number;
    totalTokens: number;
    totalCostUsd: number;
    primaryModel?: string;
    lastActivityAt: number | null;
    queue: {
        pending: number;
        active: number;
        recovered: number;
        backendMode: "memory" | "filesystem" | "redis";
    } | null;
};
```

<a id="symbol-extensions-cavi-operatorworkflowlanestatus"></a>

## OperatorWorkflowLaneStatus

Kind: type

```ts
export type OperatorWorkflowLaneStatus = "ready" | "degraded" | "unconfigured";
```

<a id="symbol-extensions-cavi-parseagentsessionkey"></a>

## parseAgentSessionKey

Kind: function

```ts
export declare function parseAgentSessionKey(sessionKey: string | null | undefined): ParsedAgentSessionKey | null;
```

<a id="symbol-extensions-cavi-parsedagentsessionkey"></a>

## ParsedAgentSessionKey

Kind: type

```ts
export type ParsedAgentSessionKey = {
    agentId: string;
    rest: string;
};
```

<a id="symbol-extensions-cavi-portal-client-id-header"></a>

## PORTAL_CLIENT_ID_HEADER

Kind: variable

```ts
export declare const PORTAL_CLIENT_ID_HEADER: "X-Portal-Client-Id";
```

<a id="symbol-extensions-cavi-portal-memory-snapshot-contract"></a>

## PORTAL_MEMORY_SNAPSHOT_CONTRACT

Kind: variable

```ts
export declare const PORTAL_MEMORY_SNAPSHOT_CONTRACT: "PORTAL_MEMORY_SNAPSHOT_V1";
```

<a id="symbol-extensions-cavi-portalapiclient"></a>

## PortalApiClient

Kind: class

```ts
export declare class PortalApiClient extends BaseHttpApiClient {
    readonly portalId: string;
    readonly request: HttpApiTransport;
    constructor(options: PortalApiClientOptions);
    protected portalPath(path: string): string;
    getDashboard<T = unknown>(): Promise<T>;
    getFromPortal<T = unknown>(relativePath: string): Promise<T>;
    postToPortal<T = unknown>(relativePath: string, body: unknown, idempotencyKey?: string): Promise<T>;
    getPortalMemorySnapshot<T = unknown>(teamSlug: string, memberId: string, memoryKey: string): Promise<T>;
}
```

<a id="symbol-extensions-cavi-portalapiclientoptions"></a>

## PortalApiClientOptions

Kind: type

```ts
export type PortalApiClientOptions = HttpApiClientOptions & {
    portalId: string;
};
```

<a id="symbol-extensions-cavi-portalapienvelopebase"></a>

## PortalApiEnvelopeBase

Kind: type

```ts
export type PortalApiEnvelopeBase = {
    clientId: string;
    portalId: string;
    teamSlug: string;
    memberId?: string;
    feature: string;
    library?: PortalLibraryRef;
};
```

<a id="symbol-extensions-cavi-portalapierror"></a>

## PortalApiError

Kind: type

```ts
export type PortalApiError = {
    code: string;
    message: string;
    details?: Record<string, unknown>;
};
```

<a id="symbol-extensions-cavi-portalapirequestenvelope"></a>

## PortalApiRequestEnvelope

Kind: type

```ts
export type PortalApiRequestEnvelope<TContract extends string, TPayload> = PortalApiEnvelopeBase & {
    contract: TContract;
    requestedAt: number;
    payload: TPayload;
};
```

<a id="symbol-extensions-cavi-portalapiresponseenvelope"></a>

## PortalApiResponseEnvelope

Kind: type

```ts
export type PortalApiResponseEnvelope<TContract extends string, TData> = PortalApiEnvelopeBase & {
    contract: TContract;
    generatedAt: number;
    ok: boolean;
    data: TData;
    error?: PortalApiError;
};
```

<a id="symbol-extensions-cavi-portaldashboardpath"></a>

## portalDashboardPath

Kind: function

```ts
/**
 * Generic portal dashboard route for any portal slug. The slug is supplied at
 * runtime (from the team manifest) — the package bakes in no portal/agent roster.
 */
export declare function portalDashboardPath(portalId: string): string;
```

<a id="symbol-extensions-cavi-portallibraryref"></a>

## PortalLibraryRef

Kind: type

```ts
export type PortalLibraryRef = {
    scope: "team" | "fleet";
    libraryTeamId: string;
    ownerPortalId?: string;
};
```

<a id="symbol-extensions-cavi-portalmemoryenvelope"></a>

## PortalMemoryEnvelope

Kind: type

```ts
export type PortalMemoryEnvelope<TSchemaContract extends string, TPayload> = {
    contract: typeof PORTAL_MEMORY_SNAPSHOT_CONTRACT;
    clientId: string;
    teamSlug: string;
    memberId: string;
    memoryKey: string;
    schemaContract: TSchemaContract;
    updatedAt: number;
    payload: TPayload;
    portalId?: string;
    feature?: string;
    library?: PortalLibraryRef;
};
```

<a id="symbol-extensions-cavi-portalttsagentvoiceassignment"></a>

## PortalTtsAgentVoiceAssignment

Kind: type

```ts
export type PortalTtsAgentVoiceAssignment = {
    agentKey: string;
    voiceValue: string;
    voiceId: string;
    voiceLabel: string;
    providerId?: string;
    providerLabel?: string;
    assignedAt: string;
};
```

<a id="symbol-extensions-cavi-portalttsaudiorequest"></a>

## PortalTtsAudioRequest

Kind: type

```ts
export type PortalTtsAudioRequest = {
    text: string;
    voiceId?: string | null;
    providerId?: string | null;
    format?: string | null;
    accept?: string | null;
    options?: Record<string, GatewayMediaJsonValue>;
};
```

<a id="symbol-extensions-cavi-portalttsaudiotransport"></a>

## PortalTtsAudioTransport

Kind: type

```ts
export type PortalTtsAudioTransport = {
    requestBlob: PortalTtsBlobRequester;
};
```

<a id="symbol-extensions-cavi-portalttsblobrequester"></a>

## PortalTtsBlobRequester

Kind: type

```ts
export type PortalTtsBlobRequester = (path: string, init?: Pick<HttpApiRequestInit, "body" | "headers" | "method">) => Promise<Blob>;
```

<a id="symbol-extensions-cavi-portalttsdashboardvoicelike"></a>

## PortalTtsDashboardVoiceLike

Kind: type

```ts
export type PortalTtsDashboardVoiceLike = {
    current_voice_id?: string;
    currentVoiceId?: string;
    current_voice_name?: string;
    currentVoiceName?: string;
    target_voice?: string;
    targetVoice?: string;
};
```

<a id="symbol-extensions-cavi-portalttsjsonrequester"></a>

## PortalTtsJsonRequester

Kind: type

```ts
export type PortalTtsJsonRequester = <T>(path: string) => Promise<T>;
```

<a id="symbol-extensions-cavi-portalttsproviderlike"></a>

## PortalTtsProviderLike

Kind: type

```ts
export type PortalTtsProviderLike = {
    id: string;
    label?: string;
    name?: string;
    configured?: boolean;
    voices?: readonly (PortalTtsProviderVoiceLike | string)[];
};
```

<a id="symbol-extensions-cavi-portalttsprovidervoicelike"></a>

## PortalTtsProviderVoiceLike

Kind: type

```ts
export type PortalTtsProviderVoiceLike = {
    id: string;
    name?: string;
};
```

<a id="symbol-extensions-cavi-portalttsvoiceoption"></a>

## PortalTtsVoiceOption

Kind: type

```ts
export type PortalTtsVoiceOption = {
    value: string;
    label: string;
    detail?: string;
    source: "gateway" | "dashboard";
    voiceId: string;
    providerId?: string;
    providerLabel?: string;
    agentKey?: string;
};
```

<a id="symbol-extensions-cavi-postlibraryclip"></a>

## postLibraryClip

Kind: function

```ts
export declare function postLibraryClip<T extends LibraryClipResult = LibraryClipResult>(requestJson: LibraryClipTransport, input: LibraryClipInput, opts?: {
    timeoutMs?: number;
}): Promise<T>;
```

<a id="symbol-extensions-cavi-requestlibraryclipdiagnostics"></a>

## requestLibraryClipDiagnostics

Kind: function

```ts
export declare function requestLibraryClipDiagnostics(requestJson: LibraryClipTransport): Promise<LibraryClipDiagnosticsSnapshot>;
```

<a id="symbol-extensions-cavi-requestportalttsaudio"></a>

## requestPortalTtsAudio

Kind: function

```ts
export declare function requestPortalTtsAudio(transport: PortalTtsAudioTransport, ttsPath: string, body: PortalTtsAudioRequest): Promise<Blob>;
```

<a id="symbol-extensions-cavi-requestportalttsproviders"></a>

## requestPortalTtsProviders

Kind: function

```ts
export declare function requestPortalTtsProviders(requestJson: PortalTtsJsonRequester, providersPath: string): Promise<unknown>;
```

<a id="symbol-extensions-cavi-resetcanonicaloperatorregistry"></a>

## resetCanonicalOperatorRegistry

Kind: function

```ts
export declare function resetCanonicalOperatorRegistry(): void;
```

<a id="symbol-extensions-cavi-resetteamregistryconfig"></a>

## resetTeamRegistryConfig

Kind: function

```ts
export declare function resetTeamRegistryConfig(): void;
```

<a id="symbol-extensions-cavi-resolvecavipath"></a>

## resolveCaviPath

Kind: variable

```ts
export declare const resolveCaviPath: import("../../../index.js").SurfacePathResolver;
```

<a id="symbol-extensions-cavi-resolvecompiledcanonicalteam"></a>

## resolveCompiledCanonicalTeam

Kind: function

```ts
export declare function resolveCompiledCanonicalTeam(identifier: string | null | undefined): OperatorRegistryTeam | null;
```

<a id="symbol-extensions-cavi-resolvegatewayhttpbase"></a>

## resolveGatewayHttpBase

Kind: function

```ts
export declare function resolveGatewayHttpBase(gatewayBaseUrl: string): string;
```

<a id="symbol-extensions-cavi-resolvegatewayhttpurl"></a>

## resolveGatewayHttpUrl

Kind: function

```ts
export declare function resolveGatewayHttpUrl(gatewayBaseUrl: string, pathname: string): string;
```

<a id="symbol-extensions-cavi-resolvegatewaywsurl"></a>

## resolveGatewayWsUrl

Kind: function

```ts
export declare function resolveGatewayWsUrl(gatewayBaseUrl: string): string;
```

<a id="symbol-extensions-cavi-resolvehttpapiconfigfromenv"></a>

## resolveHttpApiConfigFromEnv

Kind: function

```ts
export declare function resolveHttpApiConfigFromEnv(env: HttpApiEnvSource, options?: ResolveHttpApiConfigOptions): HttpApiResolvedConfig;
```

<a id="symbol-extensions-cavi-resolvehttpapiconfigoptions"></a>

## ResolveHttpApiConfigOptions

Kind: type

```ts
export type ResolveHttpApiConfigOptions = {
    defaults?: Partial<HttpApiResolvedConfig>;
    trimValues?: boolean;
    includeAliases?: boolean;
};
```

<a id="symbol-extensions-cavi-resolvelibraryapipath"></a>

## resolveLibraryApiPath

Kind: function

```ts
export declare function resolveLibraryApiPath(path: string): string;
```

<a id="symbol-extensions-cavi-resolvelibraryrefbyteamidentity"></a>

## resolveLibraryRefByTeamIdentity

Kind: function

```ts
export declare function resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null;
```

<a id="symbol-extensions-cavi-resolvememoryscope"></a>

## resolveMemoryScope

Kind: function

```ts
/**
 * Resolve a harness-native agent/team name to its canonical memory scope:
 *   - matches a member → `{ domain: team.id, member: member.id }`
 *   - matches a team   → `{ domain: team.id }`
 *   - no match         → `undefined` (caller skips that name)
 *
 * Member matches win over team matches (more specific). Matching is case-insensitive across
 * the canonical id plus the identity's slug/name/displayName/code/aliases.
 */
export declare function resolveMemoryScope(manifest: TeamManifest, name: string): MemoryScope | undefined;
```

<a id="symbol-extensions-cavi-resolveoperatortaskdispatchcontract"></a>

## resolveOperatorTaskDispatchContract

Kind: function

```ts
export declare function resolveOperatorTaskDispatchContract(mode: OperatorTaskDispatchMode): MobileGatewayEndpointContract;
```

<a id="symbol-extensions-cavi-resolveoperatortaskdispatchpath"></a>

## resolveOperatorTaskDispatchPath

Kind: function

```ts
export declare function resolveOperatorTaskDispatchPath(mode?: OperatorTaskDispatchMode): string;
```

<a id="symbol-extensions-cavi-resolvepath"></a>

## resolvePath

Kind: variable

```ts
export declare const resolvePath: import("../../../index.js").SurfacePathResolver;
```

<a id="symbol-extensions-cavi-resolvepluginapipath"></a>

## resolvePluginApiPath

Kind: function

```ts
export declare function resolvePluginApiPath(pluginId: string, ...segments: string[]): string;
```

<a id="symbol-extensions-cavi-resolveportalapipath"></a>

## resolvePortalApiPath

Kind: function

```ts
export declare function resolvePortalApiPath(portalId: string, relativePath: string): string;
```

<a id="symbol-extensions-cavi-resolveportallibraryref"></a>

## resolvePortalLibraryRef

Kind: function

```ts
export declare function resolvePortalLibraryRef(portalId: string): PortalLibraryRef | null;
```

<a id="symbol-extensions-cavi-resolveportalprimarysessionkey"></a>

## resolvePortalPrimarySessionKey

Kind: function

```ts
export declare function resolvePortalPrimarySessionKey(params: {
    portalId: CaviTeamPortalId;
    suffix?: string | null;
}): string | null;
```

<a id="symbol-extensions-cavi-resolveprojectboardassetpath"></a>

## resolveProjectBoardAssetPath

Kind: function

```ts
export declare function resolveProjectBoardAssetPath(fileName: string): string;
```

<a id="symbol-extensions-cavi-resolvepublicasset"></a>

## resolvePublicAsset

Kind: function

```ts
/** Static files under `public/` (`/agents`, `/angels`, …) for Vite `base` deployments. */
export declare function resolvePublicAsset(pathname: string): string;
```

<a id="symbol-extensions-cavi-resolvesessionapipath"></a>

## resolveSessionApiPath

Kind: function

```ts
export declare function resolveSessionApiPath(pathname: string): string;
```

<a id="symbol-extensions-cavi-resolveteamfromcollection"></a>

## resolveTeamFromCollection

Kind: function

```ts
export declare function resolveTeamFromCollection(teams: readonly OperatorRegistryTeam[], identifier: string | null | undefined): OperatorRegistryTeam | null;
```

<a id="symbol-extensions-cavi-resolveteamsessionagentid"></a>

## resolveTeamSessionAgentId

Kind: function

```ts
export declare function resolveTeamSessionAgentId(params: {
    teamId?: string | null;
    operatorTeamId?: string | null;
    operatorTeamSlug?: string | null;
    agentAlias?: string | null;
}): string | null;
```

<a id="symbol-extensions-cavi-resolveteamsessionkey"></a>

## resolveTeamSessionKey

Kind: function

```ts
export declare function resolveTeamSessionKey(params: {
    teamId?: string | null;
    operatorTeamId?: string | null;
    operatorTeamSlug?: string | null;
    agentAlias?: string | null;
    suffix?: string | null;
}): string | null;
```

<a id="symbol-extensions-cavi-runtasklinkcandidate"></a>

## RunTaskLinkCandidate

Kind: type

```ts
export type RunTaskLinkCandidate = {
    runKey: string;
    taskId: string | null;
};
```

<a id="symbol-extensions-cavi-sessionkeysequal"></a>

## sessionKeysEqual

Kind: function

```ts
export declare function sessionKeysEqual(left: string | null | undefined, right: string | null | undefined): boolean;
```

<a id="symbol-extensions-cavi-surface-contracts"></a>

## SURFACE_CONTRACTS

Kind: variable

```ts
export declare const SURFACE_CONTRACTS: Record<string, SurfaceContract>;
```

<a id="symbol-extensions-cavi-surfacecontract"></a>

## SurfaceContract

Kind: type

```ts
export type SurfaceContract = {
    key: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    path: (params?: Record<string, string>) => string;
    degradation: "hard" | "gap" | "silent";
    owner: string;
    note: string;
};
```

<a id="symbol-extensions-cavi-taskdiscourseagent"></a>

## TaskDiscourseAgent

Kind: type

```ts
export type TaskDiscourseAgent = {
    agentId: string;
    role: string;
    eventCount: number;
    tokensUsed: number;
    costUsd: number;
};
```

<a id="symbol-extensions-cavi-taskdiscourseexpectedcontractsummary"></a>

## taskDiscourseExpectedContractSummary

Kind: function

```ts
export declare function taskDiscourseExpectedContractSummary(): string;
```

<a id="symbol-extensions-cavi-taskdiscoursesnapshot"></a>

## TaskDiscourseSnapshot

Kind: type

```ts
export type TaskDiscourseSnapshot = {
    rootTaskId: string;
    agents: TaskDiscourseAgent[];
    events: DiscourseEvent[];
    delegationTree: DelegationNode[];
    summary: TaskDiscourseSummary;
};
```

<a id="symbol-extensions-cavi-taskdiscoursesummary"></a>

## TaskDiscourseSummary

Kind: type

```ts
export type TaskDiscourseSummary = {
    totalAgents: number;
    totalEvents: number;
    totalTokens: number;
    totalCostUsd: number;
    durationMs: number | null;
    blockerCount: number;
    decisionCount: number;
    outcome: "success" | "partial" | "fail" | "blocked" | "pending";
};
```

<a id="symbol-extensions-cavi-taskobservabilitysummary"></a>

## TaskObservabilitySummary

Kind: type

```ts
export type TaskObservabilitySummary = {
    taskId: string;
    taskState: OperatorTaskState | null;
    taskObjective: string | null;
    taskOwner: string | null;
    teamId: string | null;
    verification: string | null;
    primaryRunKey: string | null;
    runStatus: AgentRunStatus | null;
    runUpdatedAt: number | null;
    totalTokens: number | null;
    totalCostUsd: number | null;
    errorCount: number;
    model: string | null;
    provider: string | null;
    degraded: boolean;
    discourseTaskId: string;
};
```

<a id="symbol-extensions-cavi-team-registry-config"></a>

## TEAM_REGISTRY_CONFIG

Kind: variable

```ts
export declare const TEAM_REGISTRY_CONFIG: TeamRegistryConfig;
```

<a id="symbol-extensions-cavi-teamlibrarystatus"></a>

## TeamLibraryStatus

Kind: type

```ts
export type TeamLibraryStatus = {
    teamId: string;
    teamName: string;
    lead: string;
    inboxCount: number;
    candidatesCount: number;
    promotedCount: number;
    rejectedCount: number;
    recentPromotions: Array<{
        id: string;
        title: string;
        note_type: LibraryNoteType;
        promoted_at: string;
        promoted_by: string;
        /** When set, mobile/web can open this path in the gateway wiki vault reader. */
        wiki_path?: string;
    }>;
    qmdHealth: {
        lastIndexedAt: number | null;
        collectionSize: number;
        healthy: boolean;
    };
};
```

<a id="symbol-extensions-cavi-teamregistry"></a>

## TeamRegistry

Kind: interface

```ts
export interface TeamRegistry {
    readonly provider: TeamRegistryProviderKind;
    listTeams(): OperatorRegistryTeam[];
    listPortalIds(): string[];
    getTeamLookupKeys(team: OperatorRegistryTeam): string[];
    resolveTeam(identifier: string | null | undefined): OperatorRegistryTeam | null;
    requireTeam(identifier: string | null | undefined): OperatorRegistryTeam;
    getPortalTeam(portalId: string | null | undefined): OperatorRegistryTeam;
    getPortalTeamCode(portalId: string | null | undefined): string;
    getPortalTeamSlug(portalId: string | null | undefined): string;
    getPortalTeamSectorSlug(portalId: string | null | undefined): string;
    getFleetLibraryRef(): PortalLibraryRef | null;
    resolvePortalLibraryRef(portalId: string | null | undefined): PortalLibraryRef | null;
    resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null;
    listLibraryRefs(): PortalLibraryRef[];
}
```

<a id="symbol-extensions-cavi-teamregistryconfig"></a>

## TeamRegistryConfig

Kind: type

```ts
export type TeamRegistryConfig = {
    provider?: TeamRegistryProviderKind | null;
    manifest?: Partial<TeamManifest> | null;
    teams?: readonly TeamRegistryTeamConfig[] | null;
    libraries?: TeamRegistryLibraryConfig | null;
    snapshot?: Pick<OperatorRegistrySnapshot, "teams"> | null;
};
```

<a id="symbol-extensions-cavi-teamregistrylibraryconfig"></a>

## TeamRegistryLibraryConfig

Kind: type

```ts
export type TeamRegistryLibraryConfig = {
    fleet?: TeamRegistryLibraryRefConfig | null;
    teams?: readonly TeamRegistryLibraryRefConfig[] | null;
};
```

<a id="symbol-extensions-cavi-teamregistrylibraryrefconfig"></a>

## TeamRegistryLibraryRefConfig

Kind: type

```ts
export type TeamRegistryLibraryRefConfig = PortalLibraryRef & {
    lookupKeys?: readonly string[];
};
```

<a id="symbol-extensions-cavi-teamregistryproviderkind"></a>

## TeamRegistryProviderKind

Kind: type

```ts
export type TeamRegistryProviderKind = "gateway" | "hermes" | "openclaw" | (string & {});
```

<a id="symbol-extensions-cavi-teamregistryteamconfig"></a>

## TeamRegistryTeamConfig

Kind: type

```ts
export type TeamRegistryTeamConfig = Partial<OperatorRegistryTeam> & {
    id: string;
    name?: string | null;
};
```

<a id="symbol-extensions-cavi-withcavicontroloperatorcapabilities"></a>

## withCaviControlOperatorCapabilities

Kind: function

```ts
/**
 * Augment a base provider/gateway capabilities object with the CAVI Control
 * operator plane (status / snapshot / tasks endpoints + operator RPC methods).
 *
 * This is **plugin-gated**: the operator plane only exists when the cavi-control
 * plugin is installed on the target harness (the same cavi-control plugin runs on
 * OpenClaw and Hermes). It deliberately lives in `extensions/cavi`, not
 * in any provider, so the base OpenClaw/Hermes clients never assume a CAVI plugin
 * is present. A consumer that runs the plugin composes the operator surface on
 * top of the harness-native capabilities here.
 *
 * Provider-agnostic by design — pass any `GatewayCapabilities` (OpenClaw, Hermes,
 * or another harness) and get the same operator augmentation.
 */
export declare function withCaviControlOperatorCapabilities<T extends GatewayCapabilities & {
    rpcMethods?: readonly string[];
}>(base: T): T;
```

<a id="symbol-extensions-cavi-withcaviruntimecontrolproviders"></a>

## withCaviRuntimeControlProviders

Kind: function

```ts
export declare function withCaviRuntimeControlProviders<M extends RuntimeProviderModule>(base: RuntimeProviderRegistry<M>, options?: CaviRuntimeControlProviderOptions): RuntimeProviderRegistry<M>;
```

<a id="symbol-extensions-cavi-withruntimebasepath"></a>

## withRuntimeBasePath

Kind: function

```ts
export declare function withRuntimeBasePath(pathname: string): string;
```
