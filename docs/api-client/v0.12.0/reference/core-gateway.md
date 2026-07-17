# @cavi-ai/api-client/core/gateway

Package subpath: ./core/gateway

<a id="symbol-core-gateway-activityevent"></a>

## ActivityEvent

Kind: type

```ts
export type ActivityEvent = GatewayActivityEvent;
```

<a id="symbol-core-gateway-activityfilters"></a>

## ActivityFilters

Kind: type

```ts
export type ActivityFilters = GatewayActivityFilters;
```

<a id="symbol-core-gateway-agent-profile-config-contract"></a>

## AGENT_PROFILE_CONFIG_CONTRACT

Kind: variable

```ts
export declare const AGENT_PROFILE_CONFIG_CONTRACT = "AGENT_PROFILE_CONFIG_V1";
```

<a id="symbol-core-gateway-agent-profile-config-patch-contract"></a>

## AGENT_PROFILE_CONFIG_PATCH_CONTRACT

Kind: variable

```ts
export declare const AGENT_PROFILE_CONFIG_PATCH_CONTRACT = "AGENT_PROFILE_CONFIG_PATCH_V1";
```

<a id="symbol-core-gateway-agentcommandshortcut"></a>

## AgentCommandShortcut

Kind: type

```ts
/**
 * Gateway-agnostic chat slash-command + mention parsing.
 *
 * The authoritative command catalog is owned by the gateway and surfaced on the
 * capabilities snapshot (`capabilities.commands`). Use {@link extractGatewayCommandCatalog}
 * to read it and pass the result as the `coreCommands` option so built-ins stay
 * dynamic rather than manually maintained. {@link FALLBACK_CORE_SLASH_COMMANDS}
 * is an offline-only safety net used when the gateway snapshot is unavailable.
 */
export type AgentCommandShortcut = {
    id: string;
    label: string;
    insert: string;
    description?: string;
};
```

<a id="symbol-core-gateway-agentcommandsource"></a>

## AgentCommandSource

Kind: type

```ts
export type AgentCommandSource = {
    id?: string | null;
    name?: string | null;
    commands?: unknown;
    slashCommands?: unknown;
    slash_commands?: unknown;
    commandRegistry?: unknown;
    command_registry?: unknown;
    routing?: unknown;
    config?: unknown;
    snapshot?: unknown;
    orchestration?: unknown;
    triggers?: readonly unknown[] | null;
};
```

<a id="symbol-core-gateway-agentcommandsurface"></a>

## AgentCommandSurface

Kind: type

```ts
export type AgentCommandSurface = {
    slashShortcuts: AgentCommandShortcut[];
    mentionChips: AgentMentionSuggestion[];
};
```

<a id="symbol-core-gateway-agentconfig"></a>

## AgentConfig

Kind: type

```ts
export type AgentConfig = {
    agentId: string;
    agentName: string;
    sourcePath?: string;
    etag?: string;
    sections: readonly AgentConfigSection[];
    voice?: AgentVoiceConfig;
    fetchedAt: number;
};
```

<a id="symbol-core-gateway-agentconfigdraftdiff"></a>

## AgentConfigDraftDiff

Kind: type

```ts
export type AgentConfigDraftDiff = Record<string, AgentConfigFieldValue>;
```

<a id="symbol-core-gateway-agentconfigfield"></a>

## AgentConfigField

Kind: type

```ts
export type AgentConfigField = {
    key: string;
    label: string;
    description?: string;
    kind: AgentConfigFieldKind;
    value: AgentConfigFieldValue;
    editable?: boolean;
    sourcePath?: readonly string[];
};
```

<a id="symbol-core-gateway-agentconfigfieldkind"></a>

## AgentConfigFieldKind

Kind: type

```ts
export type AgentConfigFieldKind = {
    type: "text";
    placeholder?: string;
} | {
    type: "multiline";
    placeholder?: string;
    minRows?: number;
} | {
    type: "number";
    min?: number;
    max?: number;
    step?: number;
} | {
    type: "toggle";
} | {
    type: "select";
    options: readonly {
        value: string;
        label: string;
    }[];
} | {
    type: "chips";
    suggestions?: readonly string[];
} | {
    type: "list";
    placeholder?: string;
    suggestions?: readonly string[];
} | {
    type: "json";
    minRows?: number;
};
```

<a id="symbol-core-gateway-agentconfigfieldvalue"></a>

## AgentConfigFieldValue

Kind: type

```ts
export type AgentConfigFieldValue = string | number | boolean | null | readonly unknown[] | Record<string, unknown>;
```

<a id="symbol-core-gateway-agentconfigsection"></a>

## AgentConfigSection

Kind: type

```ts
export type AgentConfigSection = {
    id: AgentConfigSectionId;
    label: string;
    fields: readonly AgentConfigField[];
};
```

<a id="symbol-core-gateway-agentconfigsectionid"></a>

## AgentConfigSectionId

Kind: type

```ts
export type AgentConfigSectionId = string;
```

<a id="symbol-core-gateway-agentmentionsuggestion"></a>

## AgentMentionSuggestion

Kind: type

```ts
export type AgentMentionSuggestion = {
    id: string;
    label: string;
    insert: string;
};
```

<a id="symbol-core-gateway-agentprofileconfigpatchbody"></a>

## AgentProfileConfigPatchBody

Kind: type

```ts
export type AgentProfileConfigPatchBody = {
    contract: typeof AGENT_PROFILE_CONFIG_PATCH_CONTRACT;
    version: 1;
    agentId: string;
    profile: string;
    source: "profile-config-yaml";
    sourcePath: string;
    patch: AgentConfigDraftDiff;
    baseEtag?: string;
};
```

<a id="symbol-core-gateway-agentprofileconfigpath"></a>

## agentProfileConfigPath

Kind: function

```ts
export declare function agentProfileConfigPath(agentId: string): string;
```

<a id="symbol-core-gateway-agentprofileconfigsourcepath"></a>

## agentProfileConfigSourcePath

Kind: function

```ts
export declare function agentProfileConfigSourcePath(agentId: string): string;
```

<a id="symbol-core-gateway-agentprofilesourcepathresolver"></a>

## AgentProfileSourcePathResolver

Kind: type

```ts
export type AgentProfileSourcePathResolver = (agentId: string) => string;
```

<a id="symbol-core-gateway-agentprofilesummary"></a>

## AgentProfileSummary

Kind: type

```ts
export type AgentProfileSummary = {
    agentId: string;
    agentName: string;
    sourcePath?: string;
    isActive?: boolean;
    isDefault?: boolean;
    model?: string | null;
    provider?: string | null;
};
```

<a id="symbol-core-gateway-agentrun"></a>

## AgentRun

Kind: type

```ts
export type AgentRun = {
    key: string;
    title: string;
    agentId: string;
    channel: string;
    updatedAt: number | null;
    status: AgentRunStatus;
    totalTokens: number;
    errors: number;
    /** Model used for this run (e.g. claude-sonnet-4, gpt-4). From backend when available. */
    model?: string;
    /** Cost in USD for this run. From backend when available. */
    totalCostUsd?: number;
    /** Optional manifest-derived binding for source/channel/team routing diagnostics. */
    binding?: GatewayResolvedRouteBinding | null;
};
```

<a id="symbol-core-gateway-agentrundetailsnapshot"></a>

## AgentRunDetailSnapshot

Kind: type

```ts
export type AgentRunDetailSnapshot = {
    run: AgentRun | null;
    preview: {
        status: string;
        items: AgentRunPreviewItem[];
    };
    usage: {
        totalTokens: number;
        totalCostUsd: number;
        messages: number;
        toolCalls: number;
        errors: number;
    };
};
```

<a id="symbol-core-gateway-agentrunpreviewitem"></a>

## AgentRunPreviewItem

Kind: type

```ts
export type AgentRunPreviewItem = {
    role: string;
    text: string;
    at: number | null;
    eventType?: string;
    toolName?: string;
    durationMs?: number | null;
    error?: string | null;
};
```

<a id="symbol-core-gateway-agentrunsfilters"></a>

## AgentRunsFilters

Kind: type

```ts
export type AgentRunsFilters = {
    search: string;
    activeMinutes: number;
    limit: number;
};
```

<a id="symbol-core-gateway-agentrunstatus"></a>

## AgentRunStatus

Kind: type

```ts
export type AgentRunStatus = "active" | "idle" | "stalled" | "error";
```

<a id="symbol-core-gateway-agentttsprovidervoice"></a>

## AgentTtsProviderVoice

Kind: type

```ts
/**
 * Pure parsing for the `tts` block inside a raw agent config payload. Tolerates
 * both snake_case (native YAML) and camelCase (gateway serialisation); every
 * field is optional and the parser is fully defensive against missing data.
 */
/** Voice capabilities for a single TTS provider as configured for this agent. */
export type AgentTtsProviderVoice = {
    provider: string;
    isActive: boolean;
    voiceId: string | null;
    model: string | null;
    extras?: Record<string, string | number>;
};
```

<a id="symbol-core-gateway-agentvoiceconfig"></a>

## AgentVoiceConfig

Kind: type

```ts
/** Aggregated voice configuration for an agent, parsed from its raw config payload. */
export type AgentVoiceConfig = {
    activeProvider: string | null;
    voices: AgentTtsProviderVoice[];
};
```

<a id="symbol-core-gateway-asnumber"></a>

## asNumber

Kind: function

```ts
export declare function asNumber(value: unknown): number | null;
```

<a id="symbol-core-gateway-assertagentprofileid"></a>

## assertAgentProfileId

Kind: function

```ts
export declare function assertAgentProfileId(agentId: string): string;
```

<a id="symbol-core-gateway-asstring"></a>

## asString

Kind: function

```ts
export declare function asString(value: unknown): string | null;
```

<a id="symbol-core-gateway-base64urldecode"></a>

## base64UrlDecode

Kind: function

```ts
export declare function base64UrlDecode(input: string): Uint8Array;
```

<a id="symbol-core-gateway-base64urlencode"></a>

## base64UrlEncode

Kind: function

```ts
export declare function base64UrlEncode(buf: Uint8Array): string;
```

<a id="symbol-core-gateway-baseline-sessions-list-params"></a>

## BASELINE_SESSIONS_LIST_PARAMS

Kind: variable

```ts
export declare const BASELINE_SESSIONS_LIST_PARAMS: SessionsListRequestParams;
```

<a id="symbol-core-gateway-buildagentcommandsurface"></a>

## buildAgentCommandSurface

Kind: function

```ts
export declare function buildAgentCommandSurface(agent: AgentCommandSource | null | undefined, options?: BuildAgentSlashShortcutsOptions): AgentCommandSurface;
```

<a id="symbol-core-gateway-buildagentconfigfromconfigsnapshot"></a>

## buildAgentConfigFromConfigSnapshot

Kind: function

```ts
export declare function buildAgentConfigFromConfigSnapshot(input: {
    agentId: string;
    config: unknown;
    schema?: unknown;
    defaults?: unknown;
    profile?: AgentProfileSummary | null;
    defaultSourcePath?: AgentProfileSourcePathResolver;
    fetchedAt?: number;
    etag?: string;
}): AgentConfig;
```

<a id="symbol-core-gateway-buildagentmentionchips"></a>

## buildAgentMentionChips

Kind: function

```ts
export declare function buildAgentMentionChips(agent: AgentCommandSource | null | undefined): AgentMentionSuggestion[];
```

<a id="symbol-core-gateway-buildagentprofileconfigpatchbody"></a>

## buildAgentProfileConfigPatchBody

Kind: function

```ts
export declare function buildAgentProfileConfigPatchBody(params: {
    agentId: string;
    diff: AgentConfigDraftDiff;
    baseEtag?: string;
    sourcePath?: string;
    defaultSourcePath?: AgentProfileSourcePathResolver;
}): AgentProfileConfigPatchBody;
```

<a id="symbol-core-gateway-buildagentslashshortcuts"></a>

## buildAgentSlashShortcuts

Kind: function

```ts
export declare function buildAgentSlashShortcuts(agent: AgentCommandSource | null | undefined, options?: BuildAgentSlashShortcutsOptions): AgentCommandShortcut[];
```

<a id="symbol-core-gateway-buildagentslashshortcutsoptions"></a>

## BuildAgentSlashShortcutsOptions

Kind: type

```ts
export type BuildAgentSlashShortcutsOptions = {
    /** Gateway built-ins (from {@link extractGatewayCommandCatalog}); defaults to the offline fallback. */
    coreCommands?: readonly AgentCommandShortcut[];
};
```

<a id="symbol-core-gateway-builddeviceauthpayloadv3"></a>

## buildDeviceAuthPayloadV3

Kind: function

```ts
export declare function buildDeviceAuthPayloadV3(params: {
    deviceId: string;
    clientId: string;
    clientMode: string;
    role: string;
    scopes: string[];
    signedAtMs: number;
    token: string;
    nonce: string;
    platform?: string | null;
    deviceFamily?: string | null;
}): string;
```

<a id="symbol-core-gateway-buildgatewayauthheaders"></a>

## buildGatewayAuthHeaders

Kind: function

```ts
export declare function buildGatewayAuthHeaders(clientId: string, authToken: string | null, options?: {
    includeBearerToken?: boolean;
}): Record<string, string>;
```

<a id="symbol-core-gateway-buildincidentssnapshot"></a>

## buildIncidentsSnapshot

Kind: function

```ts
export declare function buildIncidentsSnapshot(logs: LogsTailPayload, sessions: RawSessionRow[]): GatewayIncidentsSnapshot;
```

<a id="symbol-core-gateway-buildoverviewsnapshot"></a>

## buildOverviewSnapshot

Kind: function

```ts
export declare function buildOverviewSnapshot(sessions: RawSessionRow[], usage: SessionsUsagePayload, readiness: ReadinessInput, options?: BuildOverviewSnapshotOptions): GatewayOverviewSnapshot;
```

<a id="symbol-core-gateway-buildoverviewsnapshotoptions"></a>

## BuildOverviewSnapshotOptions

Kind: type

```ts
export type BuildOverviewSnapshotOptions = {
    totalSessions?: number;
};
```

<a id="symbol-core-gateway-buildroutingmatrix"></a>

## buildRoutingMatrix

Kind: function

```ts
export declare function buildRoutingMatrix(usage: SessionsUsagePayload): GatewayRoutingMatrixSnapshot;
```

<a id="symbol-core-gateway-buildrundetailsnapshot"></a>

## buildRunDetailSnapshot

Kind: function

```ts
export declare function buildRunDetailSnapshot(run: GatewaySessionRun | null, usageSession: RawUsageSession | null, preview: PreviewItem | null | undefined): GatewaySessionRunDetailSnapshot;
```

<a id="symbol-core-gateway-buildrunssnapshot"></a>

## buildRunsSnapshot

Kind: function

```ts
export declare function buildRunsSnapshot(rows: RawSessionRow[], usage: SessionsUsagePayload): GatewaySessionRunsSnapshot;
```

<a id="symbol-core-gateway-canonicalizesessiondetailparams"></a>

## canonicalizeSessionDetailParams

Kind: function

```ts
export declare function canonicalizeSessionDetailParams(params: {
    key?: unknown;
    previewLimit?: unknown;
    maxChars?: unknown;
}): string;
```

<a id="symbol-core-gateway-canonicalizesessionslistparams"></a>

## canonicalizeSessionsListParams

Kind: function

```ts
export declare function canonicalizeSessionsListParams(params: SessionsListRequestParams): string;
```

<a id="symbol-core-gateway-canonicalizesessionspreviewparams"></a>

## canonicalizeSessionsPreviewParams

Kind: function

```ts
export declare function canonicalizeSessionsPreviewParams(params: {
    keys?: unknown;
    limit?: unknown;
    maxChars?: unknown;
}): string;
```

<a id="symbol-core-gateway-canonicalizesessionsusageparams"></a>

## canonicalizeSessionsUsageParams

Kind: function

```ts
export declare function canonicalizeSessionsUsageParams(params: Record<string, unknown>): string;
```

<a id="symbol-core-gateway-classifyfallbackerror"></a>

## classifyFallbackError

Kind: function

```ts
export declare function classifyFallbackError(error: unknown): {
    message: string;
    reason: ContractGapReason;
    httpStatus?: number;
};
```

<a id="symbol-core-gateway-cleangatewayerrortext"></a>

## cleanGatewayErrorText

Kind: function

```ts
export declare function cleanGatewayErrorText(value: unknown): string | null;
```

<a id="symbol-core-gateway-composeruneventproviders"></a>

## composeRunEventProviders

Kind: function

```ts
/**
 * Fan a single subscription out to multiple providers. Events from each
 * provider are forwarded to the shared handler in arrival order; disposing the
 * composite disposes every child subscription. Errors from any child are
 * surfaced via {@link RunEventStreamHandlers.onError}; the others keep running
 * unless the consumer disposes.
 */
export declare function composeRunEventProviders(...providers: RunEventStreamProvider[]): RunEventStreamProvider;
```

<a id="symbol-core-gateway-connectivitydomain"></a>

## ConnectivityDomain

Kind: type

```ts
export type ConnectivityDomain = {
    domain: string;
    label: string;
    transport: "ws" | "http" | "mixed";
    source: DataSourceMode | "not-loaded";
    status: ConnectivityStatus;
    contractGaps: readonly ContractGap[];
    fetchedAt: number | null;
};
```

<a id="symbol-core-gateway-connectivitystatus"></a>

## ConnectivityStatus

Kind: type

```ts
export type ConnectivityStatus = "live" | "empty-but-valid" | "mock-fallback" | "conditional-unavailable" | "not-loaded";
```

<a id="symbol-core-gateway-contractgap"></a>

## ContractGap

Kind: type

```ts
export type ContractGap = {
    area: string;
    expectedContract: string;
    note: string;
    reason?: ContractGapReason;
    httpStatus?: number;
};
```

<a id="symbol-core-gateway-contractgapreason"></a>

## ContractGapReason

Kind: type

```ts
export type ContractGapReason = "backend-unavailable" | "backend-not-configured" | "endpoint-not-found" | "auth-insufficient" | "transport-disconnected" | "unknown";
```

<a id="symbol-core-gateway-costbucket"></a>

## CostBucket

Kind: type

```ts
export type CostBucket = GatewayCostBucket;
```

<a id="symbol-core-gateway-costhistoryfilters"></a>

## CostHistoryFilters

Kind: type

```ts
export type CostHistoryFilters = GatewayCostHistoryFilters;
```

<a id="symbol-core-gateway-costhistoryrange"></a>

## CostHistoryRange

Kind: type

```ts
export type CostHistoryRange = GatewayCostHistoryRange;
```

<a id="symbol-core-gateway-costhistorysnapshot"></a>

## CostHistorySnapshot

Kind: type

```ts
export type CostHistorySnapshot = GatewayCostHistorySnapshot;
```

<a id="symbol-core-gateway-createdemogatewaycosthistorysnapshot"></a>

## createDemoGatewayCostHistorySnapshot

Kind: function

```ts
export declare function createDemoGatewayCostHistorySnapshot(range: GatewayCostHistoryRange, now?: number): GatewayCostHistorySnapshot;
```

<a id="symbol-core-gateway-createdemogatewaysnapshotfallbackprovider"></a>

## createDemoGatewaySnapshotFallbackProvider

Kind: function

```ts
export declare function createDemoGatewaySnapshotFallbackProvider(now?: number): GatewaySnapshotFallbackProvider;
```

<a id="symbol-core-gateway-createdemogatewaysnapshotfallbacks"></a>

## createDemoGatewaySnapshotFallbacks

Kind: function

```ts
export declare function createDemoGatewaySnapshotFallbacks(now?: number): GatewaySnapshotFallbacks;
```

<a id="symbol-core-gateway-createemptygatewaycosthistorysnapshot"></a>

## createEmptyGatewayCostHistorySnapshot

Kind: function

```ts
export declare function createEmptyGatewayCostHistorySnapshot(range: GatewayCostHistoryRange): GatewayCostHistorySnapshot;
```

<a id="symbol-core-gateway-createemptygatewayincidentssnapshot"></a>

## createEmptyGatewayIncidentsSnapshot

Kind: function

```ts
export declare function createEmptyGatewayIncidentsSnapshot(): GatewayIncidentsSnapshot;
```

<a id="symbol-core-gateway-createemptygatewayoverviewsnapshot"></a>

## createEmptyGatewayOverviewSnapshot

Kind: function

```ts
export declare function createEmptyGatewayOverviewSnapshot(now?: number): GatewayOverviewSnapshot;
```

<a id="symbol-core-gateway-createemptygatewayroutingmatrixsnapshot"></a>

## createEmptyGatewayRoutingMatrixSnapshot

Kind: function

```ts
export declare function createEmptyGatewayRoutingMatrixSnapshot(): GatewayRoutingMatrixSnapshot;
```

<a id="symbol-core-gateway-createemptygatewayrundetailsnapshot"></a>

## createEmptyGatewayRunDetailSnapshot

Kind: function

```ts
export declare function createEmptyGatewayRunDetailSnapshot(key: string): GatewaySessionRunDetailSnapshot;
```

<a id="symbol-core-gateway-createemptygatewayrunssnapshot"></a>

## createEmptyGatewayRunsSnapshot

Kind: function

```ts
export declare function createEmptyGatewayRunsSnapshot(): GatewaySessionRunsSnapshot;
```

<a id="symbol-core-gateway-createemptygatewaysnapshotfallbackprovider"></a>

## createEmptyGatewaySnapshotFallbackProvider

Kind: function

```ts
export declare function createEmptyGatewaySnapshotFallbackProvider(): GatewaySnapshotFallbackProvider;
```

<a id="symbol-core-gateway-createemptygatewaysnapshotfallbacks"></a>

## createEmptyGatewaySnapshotFallbacks

Kind: function

```ts
export declare function createEmptyGatewaySnapshotFallbacks(): GatewaySnapshotFallbacks;
```

<a id="symbol-core-gateway-creategatewayagentconfigclient"></a>

## createGatewayAgentConfigClient

Kind: function

```ts
export declare function createGatewayAgentConfigClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayAgentConfigApiClient;
```

<a id="symbol-core-gateway-creategatewayapiclient"></a>

## createGatewayApiClient

Kind: function

```ts
export declare function createGatewayApiClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayApiClient;
```

<a id="symbol-core-gateway-creategatewaymediaclient"></a>

## createGatewayMediaClient

Kind: function

```ts
export declare function createGatewayMediaClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayMediaApiClient;
```

<a id="symbol-core-gateway-creategatewayproviderregistry"></a>

## createGatewayProviderRegistry

Kind: function

```ts
export declare function createGatewayProviderRegistry(options?: CreateGatewayProviderRegistryOptions): GatewayProviderRegistry;
```

<a id="symbol-core-gateway-creategatewayproviderregistryoptions"></a>

## CreateGatewayProviderRegistryOptions

Kind: type

```ts
export type CreateGatewayProviderRegistryOptions = CreateProviderRegistryOptions<GatewayProviderModule>;
```

<a id="symbol-core-gateway-creategatewayrpcclient"></a>

## createGatewayRpcClient

Kind: variable

```ts
export declare const createGatewayRpcClient: typeof createGatewayWebSocketClient;
```

<a id="symbol-core-gateway-creategatewayrpcconnectparams"></a>

## createGatewayRpcConnectParams

Kind: function

```ts
export declare function createGatewayRpcConnectParams(params: {
    authToken: string | null;
    userAgent: string;
    locale: string;
    options?: GatewayRpcClientOptions;
    device?: {
        id: string;
        publicKey: string;
        signature: string;
        signedAt: number;
        nonce: string;
    } | null;
}): Record<string, unknown>;
```

<a id="symbol-core-gateway-creategatewaysnapshotloaders"></a>

## createGatewaySnapshotLoaders

Kind: function

```ts
export declare function createGatewaySnapshotLoaders(deps: {
    sessionLoaders: SessionLoaders;
    systemLoaders: GatewaySystemLoaders;
    options?: CreateGatewaySnapshotLoadersOptions;
}): GatewaySnapshotLoaders;
```

<a id="symbol-core-gateway-creategatewaysnapshotloadersoptions"></a>

## CreateGatewaySnapshotLoadersOptions

Kind: type

```ts
export type CreateGatewaySnapshotLoadersOptions = {
    fallbacks?: GatewaySnapshotFallbacks | null;
    fallbackProvider?: GatewaySnapshotFallbackProvider | null;
    resolveBinding?: GatewaySnapshotBindingResolver | null;
};
```

<a id="symbol-core-gateway-creategatewaysseruneventprovider"></a>

## createGatewaySseRunEventProvider

Kind: function

```ts
export declare function createGatewaySseRunEventProvider(options: CreateGatewaySseRunEventProviderOptions, providerOptions?: ResolveGatewayProviderOptions): GatewaySseRunEventProvider;
```

<a id="symbol-core-gateway-creategatewaysseruneventprovideroptions"></a>

## CreateGatewaySseRunEventProviderOptions

Kind: type

```ts
export type CreateGatewaySseRunEventProviderOptions = GatewaySseRunEventProviderOptions & {
    sessionKey?: string;
};
```

<a id="symbol-core-gateway-creategatewaysystemloaders"></a>

## createGatewaySystemLoaders

Kind: function

```ts
export declare function createGatewaySystemLoaders(client: GatewayRpcClient | null | undefined): GatewaySystemLoaders;
```

<a id="symbol-core-gateway-creategatewaywebsocketclient"></a>

## createGatewayWebSocketClient

Kind: function

```ts
export declare function createGatewayWebSocketClient(wsUrl: string, authToken: string | null, clientOptions?: GatewayWebSocketClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayWebSocketClient;
```

<a id="symbol-core-gateway-creategatewaywikiclient"></a>

## createGatewayWikiClient

Kind: function

```ts
export declare function createGatewayWikiClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayWikiApiClient;
```

<a id="symbol-core-gateway-createopenclawsessionoperations"></a>

## createOpenClawSessionOperations

Kind: function

```ts
export declare function createOpenClawSessionOperations(client: GatewayRpcClient | null | undefined, requestJson?: SessionHttpRequestJson | null): GatewaySessionOperations;
```

<a id="symbol-core-gateway-createproviderregistry"></a>

## createProviderRegistry

Kind: function

```ts
export declare function createProviderRegistry<M extends RuntimeProviderModule>(options?: CreateProviderRegistryOptions<M>): ProviderRegistry<M>;
```

<a id="symbol-core-gateway-createproviderregistryoptions"></a>

## CreateProviderRegistryOptions

Kind: type

```ts
export type CreateProviderRegistryOptions<M extends RuntimeProviderModule = GatewayProviderModule> = CreateRuntimeProviderRegistryOptions<M>;
```

<a id="symbol-core-gateway-createrunstreamwithtoolfallback"></a>

## createRunStreamWithToolFallback

Kind: function

```ts
/**
 * Wraps a primary {@link RunEventStreamProvider} with a tool-event fallback
 * that fires only when the primary's run completes without ever emitting tool
 * events. Used to bridge the gap while the Hermes SSE protocol does not yet
 * surface `tool.call.*` events natively: the
 * {@link RunPreviewPollProvider}-backed fallback stitches tool events in from
 * the post-hoc run preview. When the primary starts emitting tool events
 * natively, the fallback becomes a no-op automatically.
 */
export declare function createRunStreamWithToolFallback(options: CreateRunStreamWithToolFallbackOptions): RunEventStreamProvider;
```

<a id="symbol-core-gateway-createrunstreamwithtoolfallbackoptions"></a>

## CreateRunStreamWithToolFallbackOptions

Kind: type

```ts
export type CreateRunStreamWithToolFallbackOptions = {
    /** Authoritative source for lifecycle + (eventually) tool events. */
    primary: RunEventStreamProvider;
    /**
     * One-shot fallback that fires only after the primary emits `run.completed`
     * AND the primary did not emit any tool events during the run. Typically a
     * {@link RunPreviewPollProvider}. Optional — when omitted the composer
     * behaves like `primary` alone.
     */
    toolEventFallback?: RunEventStreamProvider;
};
```

<a id="symbol-core-gateway-createruntimeproviderregistry"></a>

## createRuntimeProviderRegistry

Kind: function

```ts
export declare function createRuntimeProviderRegistry(options?: CreateProviderRegistryOptions<RuntimeProviderModule>): ProviderRegistry<RuntimeProviderModule>;
```

<a id="symbol-core-gateway-createsessionloaders"></a>

## createSessionLoaders

Kind: function

```ts
/**
 * Build the sessions loader bundle. Each call returns a fresh closure with its own caches —
 * intended to be created once per app shell (web adapter, mobile gateway query context) and
 * shared across all queries on that surface.
 */
export declare function createSessionLoaders(client: GatewayRpcClient | null | undefined, options?: CreateSessionLoadersOptions): SessionLoaders;
```

<a id="symbol-core-gateway-createsessionloadersoptions"></a>

## CreateSessionLoadersOptions

Kind: type

```ts
export type CreateSessionLoadersOptions = {
    /** REST fallback used when the dashboard JSON-RPC websocket is unavailable. */
    requestJson?: SessionHttpRequestJson | null;
    /** Provider-neutral operation seam. Defaults to the released OpenClaw RPC/REST mapping. */
    operations?: GatewaySessionOperations;
};
```

<a id="symbol-core-gateway-dataenvelope"></a>

## DataEnvelope

Kind: type

```ts
export type DataEnvelope<TData> = {
    data: TData;
    source: DataSourceMode;
    fetchedAt: number;
    contractGaps: ContractGap[];
};
```

<a id="symbol-core-gateway-datasourcemode"></a>

## DataSourceMode

Kind: type

```ts
export type DataSourceMode = "gateway" | "mock";
```

<a id="symbol-core-gateway-default-gateway-protocol-version"></a>

## DEFAULT_GATEWAY_PROTOCOL_VERSION

Kind: variable

```ts
export declare const DEFAULT_GATEWAY_PROTOCOL_VERSION = 4;
```

<a id="symbol-core-gateway-default-preauth-handshake-timeout-ms"></a>

## DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS

Kind: variable

```ts
/**
 * Keep token-only connect fallback strictly before the gateway pre-auth
 * handshake timeout. Core owns the timing math; providers and host apps own
 * gateway-specific env keys or explicit timeout overrides.
 */
export declare const DEFAULT_PREAUTH_HANDSHAKE_TIMEOUT_MS = 10000;
```

<a id="symbol-core-gateway-derivedeviceid"></a>

## deriveDeviceId

Kind: function

```ts
export declare function deriveDeviceId(publicKeyRaw: Uint8Array): Promise<string>;
```

<a id="symbol-core-gateway-derivedrpcmethodtable"></a>

## DerivedRpcMethodTable

Kind: type

```ts
export type DerivedRpcMethodTable<TManifest extends ProviderManifest> = {
    readonly [K in keyof TManifest["rpc"]]: TManifest["rpc"][K]["method"];
};
```

<a id="symbol-core-gateway-deriverunstatus"></a>

## deriveRunStatus

Kind: function

```ts
export declare function deriveRunStatus(run: GatewaySessionRun): GatewaySessionRunStatus;
```

<a id="symbol-core-gateway-deviceidentity"></a>

## DeviceIdentity

Kind: type

```ts
export type DeviceIdentity = {
    deviceId: string;
    privateKey: CryptoKey;
    publicKeyBase64Url: string;
};
```

<a id="symbol-core-gateway-empty-sessions-usage"></a>

## EMPTY_SESSIONS_USAGE

Kind: variable

```ts
export declare const EMPTY_SESSIONS_USAGE: SessionsUsagePayload;
```

<a id="symbol-core-gateway-exportpublickeyraw"></a>

## exportPublicKeyRaw

Kind: function

```ts
export declare function exportPublicKeyRaw(key: CryptoKey): Promise<Uint8Array>;
```

<a id="symbol-core-gateway-extractgatewaycommandcatalog"></a>

## extractGatewayCommandCatalog

Kind: function

```ts
/**
 * Read the gateway built-in command catalog from a capabilities snapshot
 * (`capabilities.commands`). Returns an empty list when the gateway has not
 * surfaced a catalog yet, so callers can decide whether to fall back.
 */
export declare function extractGatewayCommandCatalog(capabilities: unknown): AgentCommandShortcut[];
```

<a id="symbol-core-gateway-extractgatewayerrordetails"></a>

## extractGatewayErrorDetails

Kind: function

```ts
export declare function extractGatewayErrorDetails(payload: unknown): {
    message: string | null;
    code: string | null;
};
```

<a id="symbol-core-gateway-extractlogincident"></a>

## extractLogIncident

Kind: function

```ts
export declare function extractLogIncident(line: string): {
    severity: GatewayIncidentRecord["severity"];
    title: string;
} | null;
```

<a id="symbol-core-gateway-fallback-core-slash-commands"></a>

## FALLBACK_CORE_SLASH_COMMANDS

Kind: variable

```ts
/**
 * Offline-only fallback for the gateway built-in slash commands. The live
 * catalog comes from {@link extractGatewayCommandCatalog}; this is only used
 * when the capabilities snapshot has not been fetched yet.
 */
export declare const FALLBACK_CORE_SLASH_COMMANDS: readonly AgentCommandShortcut[];
```

<a id="symbol-core-gateway-fallbackgap"></a>

## fallbackGap

Kind: function

```ts
export declare function fallbackGap(area: string, expectedContract: string, note: string, reason?: ContractGapReason, httpStatus?: number): ContractGap;
```

<a id="symbol-core-gateway-fallbackresolveinfo"></a>

## FallbackResolveInfo

Kind: type

```ts
export type FallbackResolveInfo = {
    source: "gateway" | "mock";
    fellBack: boolean;
    area: string;
};
```

<a id="symbol-core-gateway-fetchgatewayblob"></a>

## fetchGatewayBlob

Kind: function

```ts
export declare function fetchGatewayBlob(path: string, options: GatewayHttpFetchOptions): Promise<Blob>;
```

<a id="symbol-core-gateway-fetchgatewayexpectok"></a>

## fetchGatewayExpectOk

Kind: function

```ts
export declare function fetchGatewayExpectOk(path: string, options: GatewayHttpFetchOptions): Promise<void>;
```

<a id="symbol-core-gateway-fetchgatewayformdatajson"></a>

## fetchGatewayFormDataJson

Kind: function

```ts
export declare function fetchGatewayFormDataJson<T>(path: string, options: Omit<GatewayHttpFetchOptions, "body" | "method"> & {
    body: FormData;
}): Promise<T>;
```

<a id="symbol-core-gateway-fetchgatewayjson"></a>

## fetchGatewayJson

Kind: function

```ts
export declare function fetchGatewayJson<T>(path: string, options: GatewayHttpFetchOptions): Promise<T>;
```

<a id="symbol-core-gateway-findagentprofile"></a>

## findAgentProfile

Kind: function

```ts
export declare function findAgentProfile(profiles: readonly AgentProfileSummary[], agentId: string): AgentProfileSummary | null;
```

<a id="symbol-core-gateway-formatgatewayhttperrormessage"></a>

## formatGatewayHttpErrorMessage

Kind: function

```ts
export declare function formatGatewayHttpErrorMessage(params: {
    label: string;
    status: number;
    statusText: string;
    message?: string | null;
    code?: string | null;
}): string;
```

<a id="symbol-core-gateway-gateway-job-success-statuses"></a>

## GATEWAY_JOB_SUCCESS_STATUSES

Kind: variable

```ts
export declare const GATEWAY_JOB_SUCCESS_STATUSES: readonly [
    "completed",
    "succeeded",
    "success"
];
```

<a id="symbol-core-gateway-gateway-job-terminal-statuses"></a>

## GATEWAY_JOB_TERMINAL_STATUSES

Kind: variable

```ts
export declare const GATEWAY_JOB_TERMINAL_STATUSES: readonly [
    "completed",
    "succeeded",
    "success",
    "failed",
    "error",
    "cancelled",
    "canceled",
    "stopped"
];
```

<a id="symbol-core-gateway-gateway-media-accept-headers"></a>

## GATEWAY_MEDIA_ACCEPT_HEADERS

Kind: variable

```ts
export declare const GATEWAY_MEDIA_ACCEPT_HEADERS: {
    readonly audio: "audio/*";
    readonly image: "image/*";
    readonly video: "video/*";
    readonly music: "audio/*";
};
```

<a id="symbol-core-gateway-gateway-media-kinds"></a>

## GATEWAY_MEDIA_KINDS

Kind: variable

```ts
export declare const GATEWAY_MEDIA_KINDS: readonly [
    "audio",
    "image",
    "video",
    "music"
];
```

<a id="symbol-core-gateway-gateway-preauth-handshake-env-keys"></a>

## GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS

Kind: variable

```ts
export declare const GATEWAY_PREAUTH_HANDSHAKE_ENV_KEYS: GatewayPreauthHandshakeEnvKeys;
```

<a id="symbol-core-gateway-gateway-provider-env-keys"></a>

## GATEWAY_PROVIDER_ENV_KEYS

Kind: variable

```ts
export declare const GATEWAY_PROVIDER_ENV_KEYS: readonly [
    "CAVI_GATEWAY_PROVIDER",
    "GATEWAY_PROVIDER"
];
```

<a id="symbol-core-gateway-gateway-wiki-formats"></a>

## GATEWAY_WIKI_FORMATS

Kind: variable

```ts
export declare const GATEWAY_WIKI_FORMATS: readonly [
    "qmd",
    "markdown",
    "html",
    "pdf",
    "text",
    "json"
];
```

<a id="symbol-core-gateway-gatewayactivityevent"></a>

## GatewayActivityEvent

Kind: type

```ts
export type GatewayActivityEvent = {
    id: string;
    receivedAt: number;
    type: string;
    agentId: string | null;
    sessionKey: string | null;
    summary: string;
    raw: unknown;
};
```

<a id="symbol-core-gateway-gatewayactivityfilters"></a>

## GatewayActivityFilters

Kind: type

```ts
export type GatewayActivityFilters = {
    search: string;
    eventTypes: string[];
};
```

<a id="symbol-core-gateway-gatewayagentconfigapiclient"></a>

## GatewayAgentConfigApiClient

Kind: class

```ts
export declare class GatewayAgentConfigApiClient extends BaseHttpApiClient implements GatewayAgentConfigClient {
    readonly endpoints: GatewayAgentConfigEndpointMap;
    protected readonly defaultSourcePath: AgentProfileSourcePathResolver;
    constructor(options: HttpApiClientOptions, configOptions?: GatewayAgentConfigApiClientOptions);
    listProfiles(): Promise<AgentProfileSummary[]>;
    getProfileConfig(agentId: string): Promise<AgentConfig>;
    patchProfileConfig(agentId: string, diff: AgentConfigDraftDiff, options?: PatchProfileConfigOptions): Promise<AgentConfig>;
}
```

<a id="symbol-core-gateway-gatewayagentconfigapiclientoptions"></a>

## GatewayAgentConfigApiClientOptions

Kind: type

```ts
export type GatewayAgentConfigApiClientOptions = {
    endpoints?: GatewayAgentConfigEndpointMap;
    surface?: string;
    defaultSourcePath?: AgentProfileSourcePathResolver;
};
```

<a id="symbol-core-gateway-gatewayagentconfigapierror"></a>

## GatewayAgentConfigApiError

Kind: class

```ts
export declare class GatewayAgentConfigApiError extends Error {
    readonly status?: number;
    readonly path?: string;
    constructor(message: string, options?: {
        status?: number;
        path?: string;
    });
}
```

<a id="symbol-core-gateway-gatewayagentconfigclient"></a>

## GatewayAgentConfigClient

Kind: interface

```ts
export interface GatewayAgentConfigClient {
    listProfiles(): Promise<AgentProfileSummary[]>;
    getProfileConfig(agentId: string): Promise<AgentConfig>;
    patchProfileConfig(agentId: string, diff: AgentConfigDraftDiff, options?: PatchProfileConfigOptions): Promise<AgentConfig>;
}
```

<a id="symbol-core-gateway-gatewayagentconfigendpointmap"></a>

## GatewayAgentConfigEndpointMap

Kind: type

```ts
export type GatewayAgentConfigEndpointMap = {
    profiles: string;
    config: string;
    configDefaults: string;
    configSchema: string;
    agentConfigs: string;
    agentConfig: (agentId: string) => string;
};
```

<a id="symbol-core-gateway-gatewayapiclient"></a>

## GatewayApiClient

Kind: class

```ts
export declare class GatewayApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly endpoints: {
        readonly health: "/health";
        readonly healthDetailed: "/health/detailed";
        readonly models: "/v1/models";
        readonly capabilities: "/v1/capabilities";
        readonly chatCompletions: "/v1/chat/completions";
        readonly responses: "/v1/responses";
        readonly response: (responseId: string) => string;
        readonly runs: "/v1/runs";
        readonly run: (runId: string) => string;
        readonly runEvents: (runId: string) => string;
        readonly runApproval: (runId: string) => string;
        readonly runStop: (runId: string) => string;
        readonly jobs: "/api/jobs";
        readonly job: (jobId: string) => string;
    };
    readonly request: HttpApiTransport;
    constructor(options: HttpApiClientOptions, surface?: string);
    getCapabilities(): Promise<GatewayCapabilities>;
    getFeatureCapabilities(options?: Omit<NormalizeGatewayFeatureCapabilitiesOptions, "capabilities">): Promise<NormalizedGatewayFeatureCapabilities>;
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    startRun(body: GatewayRunStartBody): Promise<GatewayRunStatus>;
    getRun(runId: string): Promise<GatewayRunStatus>;
    private withNormalizedUsage;
    stopRun(runId: string): Promise<{
        status: string;
    }>;
    resolveRunApproval<T = unknown>(runId: string, body: {
        approved: boolean;
        reason?: string;
    }, idempotencyKey?: string): Promise<T>;
}
```

<a id="symbol-core-gateway-gatewaycapabilities"></a>

## GatewayCapabilities

Kind: type

```ts
export type GatewayCapabilities = GatewayCommandCapabilities & {
    object?: string;
    platform?: string;
    model?: string;
    auth?: {
        type?: string;
        required?: boolean;
    };
    features: Record<string, unknown>;
    endpoints?: Record<string, {
        method: string;
        path: string;
    }>;
    runtime?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaycommandcapabilities"></a>

## GatewayCommandCapabilities

Kind: type

```ts
export type GatewayCommandCapabilities = {
    commands?: GatewayCommandCatalog;
    slashCommands?: GatewayCommandCatalog;
    slash_commands?: GatewayCommandCatalog;
    commandCatalog?: GatewayCommandCatalog;
    command_catalog?: GatewayCommandCatalog;
};
```

<a id="symbol-core-gateway-gatewaycommandcatalog"></a>

## GatewayCommandCatalog

Kind: type

```ts
export type GatewayCommandCatalog = readonly (GatewayCommandSpec | string)[] | {
    commands?: unknown;
    slashCommands?: unknown;
    slash_commands?: unknown;
    core?: unknown;
    agent?: unknown;
    teams?: unknown;
};
```

<a id="symbol-core-gateway-gatewaycommandspec"></a>

## GatewayCommandSpec

Kind: type

```ts
/** Shape of a single entry in the gateway capabilities `commands` catalog. */
export type GatewayCommandSpec = {
    command?: string;
    name?: string;
    id?: string;
    insert?: string;
    template?: string;
    description?: string;
    summary?: string;
    help?: string;
    category?: string;
    aliases?: readonly string[];
    params?: readonly Record<string, unknown>[];
    arguments?: readonly Record<string, unknown>[];
    examples?: readonly string[];
    enabled?: boolean;
    source?: string;
    scope?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewayconfigschemafield"></a>

## GatewayConfigSchemaField

Kind: type

```ts
export type GatewayConfigSchemaField = {
    type?: string;
    description?: string;
    category?: string;
    options?: readonly unknown[];
    min?: number;
    max?: number;
    step?: number;
};
```

<a id="symbol-core-gateway-gatewayconfigschemapayload"></a>

## GatewayConfigSchemaPayload

Kind: type

```ts
export type GatewayConfigSchemaPayload = {
    fields?: Record<string, GatewayConfigSchemaField | unknown>;
    category_order?: readonly string[];
};
```

<a id="symbol-core-gateway-gatewayconnectionstate"></a>

## GatewayConnectionState

Kind: type

```ts
export type GatewayConnectionState = "idle" | "connecting" | "reconnecting" | "connected" | "error";
```

<a id="symbol-core-gateway-gatewaycostbucket"></a>

## GatewayCostBucket

Kind: type

```ts
export type GatewayCostBucket = {
    timestamp: number;
    activeSessions: number;
    totalTokens: number;
    estimatedCostUsd: number;
    totalErrors: number;
    providerBreakdown: Array<{
        provider: string;
        tokens: number;
        cost: number;
    }>;
};
```

<a id="symbol-core-gateway-gatewaycosthistoryfallback"></a>

## GatewayCostHistoryFallback

Kind: type

```ts
export type GatewayCostHistoryFallback = GatewayCostHistorySnapshot | ((range: GatewayCostHistoryRange) => GatewayCostHistorySnapshot);
```

<a id="symbol-core-gateway-gatewaycosthistoryfilters"></a>

## GatewayCostHistoryFilters

Kind: type

```ts
export type GatewayCostHistoryFilters = {
    range: GatewayCostHistoryRange;
};
```

<a id="symbol-core-gateway-gatewaycosthistoryrange"></a>

## GatewayCostHistoryRange

Kind: type

```ts
export type GatewayCostHistoryRange = "1h" | "6h" | "24h" | "7d";
```

<a id="symbol-core-gateway-gatewaycosthistorysnapshot"></a>

## GatewayCostHistorySnapshot

Kind: type

```ts
export type GatewayCostHistorySnapshot = {
    range: GatewayCostHistoryRange;
    resolution: string;
    generatedAt: number;
    buckets: GatewayCostBucket[];
    totals: {
        totalTokens: number;
        estimatedCostUsd: number;
        totalErrors: number;
    };
};
```

<a id="symbol-core-gateway-gatewayfeaturecapabilityinput"></a>

## GatewayFeatureCapabilityInput

Kind: type

```ts
export type GatewayFeatureCapabilityInput = GatewayCapabilities | NormalizedGatewayFeatureCapabilities | null | undefined;
```

<a id="symbol-core-gateway-gatewayhealthsnapshot"></a>

## GatewayHealthSnapshot

Kind: type

```ts
export type GatewayHealthSnapshot = {
    live: boolean;
    ready: boolean;
    checkedAt: number;
    probes: {
        healthz: {
            path: typeof GATEWAY_PROBE_ENDPOINTS.healthz;
            ok: boolean;
            statusCode: 200;
        };
        readyz: {
            path: typeof GATEWAY_PROBE_ENDPOINTS.readyz;
            ok: boolean;
            statusCode: 200 | 503;
            failing: string[];
            uptimeMs: number | null;
        };
    };
};
```

<a id="symbol-core-gateway-gatewayhttpfetchoptions"></a>

## GatewayHttpFetchOptions

Kind: type

```ts
export type GatewayHttpFetchOptions = Omit<RequestInit, "headers"> & {
    httpBaseUrl: string;
    clientId: string;
    authToken: string | null;
    /** Shown in thrown errors, e.g. "Gateway API". */
    apiLabel: string;
    headers?: Record<string, string>;
    sessionAuthMode?: boolean;
    surface?: HttpApiTrace["surface"];
    fetchImpl?: typeof fetch;
};
```

<a id="symbol-core-gateway-gatewayincidentrecord"></a>

## GatewayIncidentRecord

Kind: type

```ts
export type GatewayIncidentRecord = {
    id: string;
    title: string;
    summary: string;
    severity: GatewayIncidentSeverity;
    status: GatewayIncidentStatus;
    firstSeenAt: number;
    lastSeenAt: number;
    count: number;
    owner: string;
    repeatedAcrossAgents?: boolean;
    flaggedForImmediateFix?: boolean;
    planningRelated?: boolean;
    workTaskAssigned?: string;
    scope?: string;
    agentIds?: string[];
};
```

<a id="symbol-core-gateway-gatewayincidentseverity"></a>

## GatewayIncidentSeverity

Kind: type

```ts
export type GatewayIncidentSeverity = "critical" | "high" | "medium" | "low";
```

<a id="symbol-core-gateway-gatewayincidentssnapshot"></a>

## GatewayIncidentsSnapshot

Kind: type

```ts
export type GatewayIncidentsSnapshot = {
    incidents: GatewayIncidentRecord[];
    blockers: GatewayIncidentRecord[];
};
```

<a id="symbol-core-gateway-gatewayincidentstatus"></a>

## GatewayIncidentStatus

Kind: type

```ts
export type GatewayIncidentStatus = "open" | "investigating" | "blocked" | "resolved";
```

<a id="symbol-core-gateway-gatewayjobaborterror"></a>

## GatewayJobAbortError

Kind: class

```ts
export declare class GatewayJobAbortError extends Error {
    readonly name = "GatewayJobAbortError";
    readonly reason: unknown;
    constructor(reason?: unknown);
}
```

<a id="symbol-core-gateway-gatewayjoblike"></a>

## GatewayJobLike

Kind: type

```ts
export type GatewayJobLike = {
    status?: GatewayJobStatus | null;
    error?: unknown;
};
```

<a id="symbol-core-gateway-gatewayjobsleep"></a>

## GatewayJobSleep

Kind: type

```ts
export type GatewayJobSleep = (delayMs: number, signal?: AbortSignal) => Promise<void>;
```

<a id="symbol-core-gateway-gatewayjobstatus"></a>

## GatewayJobStatus

Kind: type

```ts
export type GatewayJobStatus = "queued" | "running" | "completed" | "succeeded" | "failed" | "cancelled" | "canceled" | "stopping" | "stopped" | string;
```

<a id="symbol-core-gateway-gatewayjobtimeouterror"></a>

## GatewayJobTimeoutError

Kind: class

```ts
export declare class GatewayJobTimeoutError<TJob extends GatewayJobLike> extends Error {
    readonly name = "GatewayJobTimeoutError";
    readonly attempts: number;
    readonly elapsedMs: number;
    readonly lastJob: TJob | null;
    constructor(params: {
        attempts: number;
        elapsedMs: number;
        lastJob: TJob | null;
    });
}
```

<a id="symbol-core-gateway-gatewayjobwaitoptions"></a>

## GatewayJobWaitOptions

Kind: type

```ts
export type GatewayJobWaitOptions<TJob extends GatewayJobLike> = {
    fetchJob: () => Promise<TJob>;
    intervalMs?: number;
    timeoutMs?: number;
    maxAttempts?: number;
    signal?: AbortSignal;
    onUpdate?: (update: GatewayJobWaitUpdate<TJob>) => void;
    isTerminal?: (job: TJob) => boolean;
    sleep?: GatewayJobSleep;
    now?: () => number;
};
```

<a id="symbol-core-gateway-gatewayjobwaitupdate"></a>

## GatewayJobWaitUpdate

Kind: type

```ts
export type GatewayJobWaitUpdate<TJob extends GatewayJobLike> = {
    attempt: number;
    elapsedMs: number;
    job: TJob;
};
```

<a id="symbol-core-gateway-gatewaymediaapiclient"></a>

## GatewayMediaApiClient

Kind: class

```ts
export declare class GatewayMediaApiClient extends BaseHttpApiClient implements GatewayMediaClient {
    readonly endpoints: GatewayMediaEndpointMap;
    constructor(options: HttpApiClientOptions, mediaOptions?: GatewayMediaApiClientOptions);
    listMediaProviders(kind?: GatewayMediaKind | null): Promise<GatewayMediaProviderList>;
    generateMedia(body: GatewayMediaGenerateRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateAudio(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateImage(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateVideo(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateMusic(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateTextToSpeech(body: GatewayTextToSpeechRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    getMediaJob(kind: GatewayMediaKind, jobId: string): Promise<GatewayMediaGenerationResult>;
    waitForMediaJob(kind: GatewayMediaKind, jobId: string, options?: GatewayMediaJobWaitOptions): Promise<GatewayMediaGenerationResult>;
    listMediaAssets(options?: GatewayMediaAssetListOptions): Promise<GatewayMediaAssetList>;
    getMediaAssetMetadata(assetId: string): Promise<GatewayMediaAsset>;
    createMediaAsset(body: GatewayMediaAssetUploadRequest, idempotencyKey?: string): Promise<GatewayMediaAsset>;
    uploadMediaAsset(body: GatewayMediaAssetUploadRequest, idempotencyKey?: string): Promise<GatewayMediaAsset>;
    deleteMediaAsset(assetId: string): Promise<GatewayMediaAssetDeleteResult>;
    getMediaAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getAudioAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getImageAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getVideoAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getMusicAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
}
```

<a id="symbol-core-gateway-gatewaymediaapiclientoptions"></a>

## GatewayMediaApiClientOptions

Kind: type

```ts
export type GatewayMediaApiClientOptions = {
    endpoints?: GatewayMediaEndpointMap;
    surface?: string;
};
```

<a id="symbol-core-gateway-gatewaymediaasset"></a>

## GatewayMediaAsset

Kind: type

```ts
export type GatewayMediaAsset = {
    id?: string;
    kind?: GatewayMediaKind | string;
    contentType?: string;
    filename?: string;
    path?: string;
    url?: string;
    size?: number;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediaassetdeleteresult"></a>

## GatewayMediaAssetDeleteResult

Kind: type

```ts
export type GatewayMediaAssetDeleteResult = {
    object?: string;
    id?: string;
    assetId?: string;
    deleted?: boolean;
    status: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediaassetlist"></a>

## GatewayMediaAssetList

Kind: type

```ts
export type GatewayMediaAssetList = {
    object?: string;
    kind?: GatewayMediaKind | string;
    assets: readonly GatewayMediaAsset[];
    nextCursor?: string | null;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediaassetlistoptions"></a>

## GatewayMediaAssetListOptions

Kind: type

```ts
export type GatewayMediaAssetListOptions = {
    kind?: GatewayMediaKind | string | null;
    cursor?: string | null;
    limit?: number | null;
};
```

<a id="symbol-core-gateway-gatewaymediaassetrequest"></a>

## GatewayMediaAssetRequest

Kind: type

```ts
export type GatewayMediaAssetRequest = Pick<HttpApiRequestInit, "cache" | "credentials" | "headers" | "signal" | "timeoutMs"> & {
    accept?: string;
};
```

<a id="symbol-core-gateway-gatewaymediaassetuploadrequest"></a>

## GatewayMediaAssetUploadRequest

Kind: type

```ts
export type GatewayMediaAssetUploadRequest = {
    kind: GatewayMediaKind | string;
    input?: string;
    filename?: string;
    contentType?: string;
    dataBase64?: string;
    url?: string;
    size?: number;
    options?: Record<string, GatewayMediaJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediacapabilitymap"></a>

## GatewayMediaCapabilityMap

Kind: type

```ts
export type GatewayMediaCapabilityMap = Record<GatewayMediaKind, boolean>;
```

<a id="symbol-core-gateway-gatewaymediaclient"></a>

## GatewayMediaClient

Kind: interface

```ts
export interface GatewayMediaClient {
    listMediaProviders(kind?: GatewayMediaKind | null): Promise<GatewayMediaProviderList>;
    generateMedia(body: GatewayMediaGenerateRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateAudio(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateImage(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateVideo(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateMusic(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateTextToSpeech(body: GatewayTextToSpeechRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    getMediaJob(kind: GatewayMediaKind, jobId: string): Promise<GatewayMediaGenerationResult>;
    waitForMediaJob(kind: GatewayMediaKind, jobId: string, options?: GatewayMediaJobWaitOptions): Promise<GatewayMediaGenerationResult>;
    listMediaAssets(options?: GatewayMediaAssetListOptions): Promise<GatewayMediaAssetList>;
    getMediaAssetMetadata(assetId: string): Promise<GatewayMediaAsset>;
    createMediaAsset(body: GatewayMediaAssetUploadRequest, idempotencyKey?: string): Promise<GatewayMediaAsset>;
    uploadMediaAsset(body: GatewayMediaAssetUploadRequest, idempotencyKey?: string): Promise<GatewayMediaAsset>;
    deleteMediaAsset(assetId: string): Promise<GatewayMediaAssetDeleteResult>;
    getMediaAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getAudioAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getImageAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getVideoAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getMusicAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
}
```

<a id="symbol-core-gateway-gatewaymediaendpointmap"></a>

## GatewayMediaEndpointMap

Kind: type

```ts
export type GatewayMediaEndpointMap = {
    providers: (kind?: GatewayMediaKind | null) => string;
    generate: (kind: GatewayMediaKind) => string;
    job: (kind: GatewayMediaKind, jobId: string) => string;
    assets: (query?: GatewayMediaAssetListOptions | null) => string;
    asset: (assetId: string) => string;
};
```

<a id="symbol-core-gateway-gatewaymediagenerateinput"></a>

## GatewayMediaGenerateInput

Kind: type

```ts
export type GatewayMediaGenerateInput = Omit<GatewayMediaGenerateRequest, "kind">;
```

<a id="symbol-core-gateway-gatewaymediageneraterequest"></a>

## GatewayMediaGenerateRequest

Kind: type

```ts
export type GatewayMediaGenerateRequest = {
    kind: GatewayMediaKind;
    input: string;
    instructions?: string;
    providerId?: string;
    model?: string;
    voiceId?: string;
    format?: string;
    durationSeconds?: number;
    teamId?: string;
    memberId?: string;
    actionId?: string;
    options?: Record<string, GatewayMediaJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediagenerationresult"></a>

## GatewayMediaGenerationResult

Kind: type

```ts
export type GatewayMediaGenerationResult = {
    object?: string;
    id?: string;
    jobId?: string;
    runId?: string;
    kind?: GatewayMediaKind | string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
    asset?: GatewayMediaAsset;
    artifacts?: readonly GatewayMediaAsset[];
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediajobwaitoptions"></a>

## GatewayMediaJobWaitOptions

Kind: type

```ts
export type GatewayMediaJobWaitOptions = Omit<GatewayJobWaitOptions<GatewayMediaGenerationResult>, "fetchJob">;
```

<a id="symbol-core-gateway-gatewaymediajsonvalue"></a>

## GatewayMediaJsonValue

Kind: type

```ts
export type GatewayMediaJsonValue = string | number | boolean | null | readonly GatewayMediaJsonValue[] | {
    readonly [key: string]: GatewayMediaJsonValue;
};
```

<a id="symbol-core-gateway-gatewaymediakind"></a>

## GatewayMediaKind

Kind: type

```ts
export type GatewayMediaKind = (typeof GATEWAY_MEDIA_KINDS)[number];
```

<a id="symbol-core-gateway-gatewaymediaprovider"></a>

## GatewayMediaProvider

Kind: type

```ts
export type GatewayMediaProvider = {
    id: string;
    kind?: GatewayMediaKind | string;
    label?: string;
    name?: string;
    configured?: boolean;
    models?: readonly string[];
    voices?: readonly (string | {
        id: string;
        name?: string;
    })[];
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaymediaprovidercapabilityinput"></a>

## GatewayMediaProviderCapabilityInput

Kind: type

```ts
export type GatewayMediaProviderCapabilityInput = GatewayMediaProviderList | readonly GatewayMediaProvider[] | readonly GatewayMediaProviderList[];
```

<a id="symbol-core-gateway-gatewaymediaproviderlist"></a>

## GatewayMediaProviderList

Kind: type

```ts
export type GatewayMediaProviderList = {
    object?: string;
    kind?: GatewayMediaKind | string;
    providers: readonly GatewayMediaProvider[];
};
```

<a id="symbol-core-gateway-gatewayoverviewkpis"></a>

## GatewayOverviewKpis

Kind: type

```ts
export type GatewayOverviewKpis = {
    activeSessions: number;
    totalSessions: number;
    totalMessages: number;
    totalToolCalls: number;
    totalErrors: number;
    estimatedCostUsd: number;
};
```

<a id="symbol-core-gateway-gatewayoverviewsnapshot"></a>

## GatewayOverviewSnapshot

Kind: type

```ts
export type GatewayOverviewSnapshot = {
    health: GatewayHealthSnapshot;
    kpis: GatewayOverviewKpis;
    providerBreakdown: Array<{
        provider: string;
        tokens: number;
        cost: number;
    }>;
    topAgents: Array<{
        agentId: string;
        messages: number;
        cost: number;
    }>;
};
```

<a id="symbol-core-gateway-gatewaypreauthhandshakeenv"></a>

## GatewayPreauthHandshakeEnv

Kind: type

```ts
export type GatewayPreauthHandshakeEnv = Readonly<Record<string, string | undefined>>;
```

<a id="symbol-core-gateway-gatewaypreauthhandshakeenvkeys"></a>

## GatewayPreauthHandshakeEnvKeys

Kind: type

```ts
export type GatewayPreauthHandshakeEnvKeys = Readonly<{
    timeoutMs: string;
    testTimeoutMs?: string;
    testFlag?: string;
}>;
```

<a id="symbol-core-gateway-gatewayproviderenv"></a>

## GatewayProviderEnv

Kind: type

```ts
export type GatewayProviderEnv = Record<string, string | undefined>;
```

<a id="symbol-core-gateway-gatewayproviderfactories"></a>

## GatewayProviderFactories

Kind: interface

```ts
export interface GatewayProviderFactories {
    createApiClient?: (clientOptions: HttpApiClientOptions) => GatewayApiClient;
    createWebSocketClient?: (wsUrl: string, authToken: string | null, clientOptions: GatewayWebSocketClientOptions) => GatewayWebSocketClient;
    createSseRunEventProvider?: (options: CreateGatewaySseRunEventProviderOptions) => GatewaySseRunEventProvider;
    createMediaClient?: (clientOptions: HttpApiClientOptions) => GatewayMediaApiClient;
    createWikiClient?: (clientOptions: HttpApiClientOptions) => GatewayWikiApiClient;
    createAgentConfigClient?: (clientOptions: HttpApiClientOptions) => GatewayAgentConfigApiClient;
}
```

<a id="symbol-core-gateway-gatewayproviderkind"></a>

## GatewayProviderKind

Kind: type

```ts
export type GatewayProviderKind = "hermes" | "openclaw" | (string & {});
```

<a id="symbol-core-gateway-gatewayprovidermodule"></a>

## GatewayProviderModule

Kind: interface

```ts
export interface GatewayProviderModule extends RuntimeProviderModule, GatewayProviderFactories {
    /** Gateway providers return the gateway-capable client. */
    createApiClient?: (clientOptions: HttpApiClientOptions) => GatewayApiClient;
}
```

<a id="symbol-core-gateway-gatewayproviderregistry"></a>

## GatewayProviderRegistry

Kind: type

```ts
export type GatewayProviderRegistry = ProviderRegistry<GatewayProviderModule>;
```

<a id="symbol-core-gateway-gatewayroutingmatrixsnapshot"></a>

## GatewayRoutingMatrixSnapshot

Kind: type

```ts
export type GatewayRoutingMatrixSnapshot = {
    rows: Array<{
        channel: string;
        handler: string;
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
        successRate: number;
        messages: number;
        binding?: GatewayResolvedRouteBinding | null;
    }>;
    totals: {
        totalRuns: number;
        successRuns: number;
        failedRuns: number;
    };
};
```

<a id="symbol-core-gateway-gatewayrpcclient"></a>

## GatewayRpcClient

Kind: class

```ts
export declare class GatewayRpcClient {
    private readonly wsUrl;
    private readonly authToken;
    private readonly options;
    private socket;
    private connectPromise;
    private pending;
    private activeRpcRequests;
    private queuedRpcRequests;
    private sequence;
    private connected;
    /** Set when a connect RPC is explicitly rejected (auth failure, etc.) so onClose
     *  does not emit a retryable socket_closed error that triggers an infinite reconnect loop. */
    private connectRejected;
    private eventListeners;
    private stateListeners;
    private state;
    private lastError;
    private intentionalClose;
    private emitRpcTrace;
    private deviceIdentity;
    private deviceIdentityReady;
    /** Incremented on each connect attempt; stale async connect paths must not resolve the outer promise. */
    private connectAttemptSeq;
    constructor(wsUrl: string, authToken: string | null, options?: GatewayRpcClientOptions);
    getConnectionState(): GatewayConnectionState;
    getLastError(): Error | null;
    onEvent(listener: (event: GatewayStreamEvent) => void): () => void;
    onStateChange(listener: (state: GatewayConnectionState, error: Error | null) => void): () => void;
    connect(): Promise<void>;
    request<TPayload>(method: string, params?: Record<string, unknown>): Promise<TPayload>;
    close(): Promise<void>;
    private setState;
    private getConnectClientInfo;
    private ensureConnected;
    private requestRaw;
    private runWithRpcBackpressure;
    private drainQueuedRpcRequests;
    private rejectQueuedRpcRequests;
    private handleMessage;
}
```

<a id="symbol-core-gateway-gatewayrpcclientoptions"></a>

## GatewayRpcClientOptions

Kind: type

```ts
export type GatewayRpcClientOptions = {
    clientId?: string;
    clientVersion?: string;
    clientMode?: string;
    clientPlatform?: string;
    /**
     * Correlation-id strategy for the initial `connect` handshake frame.
     * - `"monotonic"` (default): connect uses the same per-client monotonic id as
     *   every other RPC.
     * - `"client-id"`: connect reuses the advertised `clientId` as its frame id.
     *   Opt into this for gateways that correlate the connect response on the
     *   advertised client id rather than echoing an arbitrary request id.
     * Subsequent (non-connect) RPCs always use monotonic ids regardless.
     */
    connectFrameId?: "monotonic" | "client-id";
    /**
     * Gateway protocol compatibility range to advertise during connect.
     * Defaults to the current generic gateway protocol. Override only when
     * talking to a gateway with a known alternate compatibility contract.
     */
    minProtocol?: number;
    maxProtocol?: number;
    enableDeviceIdentity?: boolean;
    /**
     * Optional platform-specific device identity loader. Browser callers use the
     * built-in IndexedDB/WebCrypto store; React Native callers can provide a
     * SecureStore-backed loader while still using the shared connect signer.
     */
    deviceIdentityLoader?: () => Promise<DeviceIdentity | null>;
    /**
     * Operator scopes to request on connect. Empty/blank entries are ignored.
     * When omitted, defaults to `["operator.read"]` for backwards compatibility;
     * callers needing admin-level methods (e.g. `device.pair.approve`) must opt in
     * explicitly so the gateway does not silently downgrade them to read-only.
     */
    requestedScopes?: readonly string[];
    /**
     * Gateway pre-auth handshake budget (ms). Set this to the same value as server
     * handshake config when it is not the default, especially for browser clients
     * that cannot read gateway env.
     */
    preauthHandshakeTimeoutMs?: number;
    /**
     * Env bag and keys for provider-specific pre-auth handshake config. Core uses
     * GATEWAY_* keys by default; providers can pass their own keys without baking
     * product names into the core client.
     */
    preauthHandshakeEnv?: GatewayPreauthHandshakeEnv;
    preauthHandshakeEnvKeys?: GatewayPreauthHandshakeEnvKeys;
    /** Override the per-RPC response timeout. */
    requestTimeoutMs?: number;
    /** Override client-side RPC concurrency. */
    maxConcurrentRequests?: number;
    /** Override the default requested scopes used when requestedScopes is omitted. */
    defaultRequestedScopes?: readonly string[];
    /**
     * Optional hook for completed RPCs (success, gateway error, timeout, or send failure).
     * Params are redacted; payloads are truncated. Must not throw.
     */
    onRpcTrace?: (entry: GatewayRpcTraceEntry) => void;
};
```

<a id="symbol-core-gateway-gatewayrpcerror"></a>

## GatewayRpcError

Kind: class

```ts
export declare class GatewayRpcError extends Error {
    readonly transport?: TransportErrorMetadata | undefined;
    readonly type = ApiClientErrorType.GatewayRpc;
    readonly code: string;
    constructor(message: string, code?: string, transport?: TransportErrorMetadata | undefined);
}
```

<a id="symbol-core-gateway-gatewayrpctraceentry"></a>

## GatewayRpcTraceEntry

Kind: type

```ts
/** Completed WebSocket RPC (after response or failure). Params are redacted. */
export type GatewayRpcTraceEntry = {
    at: number;
    transport: "websocket";
    correlationId: string;
    method: string;
    durationMs: number;
    ok: boolean;
    params: Record<string, unknown>;
    /** JSON preview of successful payload (bounded). */
    resultPreview?: string;
    /** Populated when `ok` is false. */
    error?: {
        name: string;
        message: string;
        code?: string;
    };
};
```

<a id="symbol-core-gateway-gatewayrunattachment"></a>

## GatewayRunAttachment

Kind: type

```ts
export type GatewayRunAttachment = {
    name: string;
    mimeType?: string;
    mime_type?: string;
    size?: number;
    dataBase64?: string;
    data_base64?: string;
    [key: string]: unknown;
};
```

<a id="symbol-core-gateway-gatewayrunmessage"></a>

## GatewayRunMessage

Kind: type

```ts
export type GatewayRunMessage = RuntimeRunMessage;
```

<a id="symbol-core-gateway-gatewayrunstartbody"></a>

## GatewayRunStartBody

Kind: type

```ts
export type GatewayRunStartBody = RuntimeRunStartBody & {
    session_id?: string;
    sessionKey?: string;
    session_key?: string;
    previous_response_id?: string;
    conversation_history?: GatewayRunMessage[];
    targetProfile?: string;
    target_profile?: string;
    targetAgent?: string;
    target_agent?: string;
    agentId?: string;
    agent_id?: string;
    action?: string;
    source?: Record<string, unknown>;
    attachments?: GatewayRunAttachment[];
    dry_run?: boolean;
};
```

<a id="symbol-core-gateway-gatewayrunstatus"></a>

## GatewayRunStatus

Kind: type

```ts
export type GatewayRunStatus = RuntimeRunStatus & {
    object?: string;
    session_id?: string;
    targetProfile?: string;
    task_id?: string;
    routing?: {
        kind?: string;
        targetProfile?: string | null;
        taskId?: string | null;
        workerEventStream?: boolean;
        decision?: Record<string, unknown>;
    };
    events?: Record<string, unknown>[];
    tool_call_count?: number;
};
```

<a id="symbol-core-gateway-gatewayscope"></a>

## GatewayScope

Kind: type

```ts
export type GatewayScope = "operator.read" | "operator.write" | "operator.admin" | "operator.approvals" | "operator.pairing" | "operator.talk.secrets" | "node" | "dynamic";
```

<a id="symbol-core-gateway-gatewaysessioncancelresult"></a>

## GatewaySessionCancelResult

Kind: type

```ts
export type GatewaySessionCancelResult = {
    id: string;
    status: "cancelled";
    providerData?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaysessionoperations"></a>

## GatewaySessionOperations

Kind: interface

```ts
export interface GatewaySessionOperations {
    list(input: SessionsListRequestParams, options?: GatewaySessionRequestOptions): Promise<SessionsListRpcPayload>;
    usage(input: Record<string, unknown>, options?: GatewaySessionRequestOptions): Promise<SessionsUsagePayload>;
    preview(input: SessionsPreviewRequestParams, options?: GatewaySessionRequestOptions): Promise<SessionsPreviewPayload>;
    detail(input: SessionDetailRequestParams, options?: GatewaySessionRequestOptions): Promise<SessionDetailPayload>;
    patch(input: SessionPatchInput, options?: GatewaySessionRequestOptions): Promise<void>;
    /** Optional provider-neutral cancellation seam. Provider adapters own wire method names. */
    cancel?(id: string, options?: GatewaySessionRequestOptions): Promise<GatewaySessionCancelResult>;
}
```

<a id="symbol-core-gateway-gatewaysessionrequestoptions"></a>

## GatewaySessionRequestOptions

Kind: type

```ts
export type GatewaySessionRequestOptions = {
    /**
     * Prevents dispatch when already aborted. The released legacy RPC and REST
     * transports cannot cancel a request after it has been dispatched.
     */
    signal?: AbortSignal;
};
```

<a id="symbol-core-gateway-gatewaysessionrun"></a>

## GatewaySessionRun

Kind: type

```ts
export type GatewaySessionRun = {
    key: string;
    title: string;
    agentId: string;
    channel: string;
    updatedAt: number | null;
    status: GatewaySessionRunStatus;
    totalTokens: number;
    errors: number;
    model?: string;
    totalCostUsd?: number;
    binding?: GatewayResolvedRouteBinding | null;
};
```

<a id="symbol-core-gateway-gatewaysessionrundetailsnapshot"></a>

## GatewaySessionRunDetailSnapshot

Kind: type

```ts
export type GatewaySessionRunDetailSnapshot = {
    run: GatewaySessionRun | null;
    preview: {
        status: string;
        items: Array<{
            role: string;
            text: string;
            at: number | null;
            eventType?: string;
            toolName?: string;
            durationMs?: number | null;
            error?: string | null;
        }>;
    };
    usage: {
        totalTokens: number;
        totalCostUsd: number;
        messages: number;
        toolCalls: number;
        errors: number;
    };
};
```

<a id="symbol-core-gateway-gatewaysessionrunssnapshot"></a>

## GatewaySessionRunsSnapshot

Kind: type

```ts
export type GatewaySessionRunsSnapshot = {
    live: GatewaySessionRun[];
    history: GatewaySessionRun[];
    summary: {
        active: number;
        idle: number;
        stalled: number;
        error: number;
    };
};
```

<a id="symbol-core-gateway-gatewaysessionrunstatus"></a>

## GatewaySessionRunStatus

Kind: type

```ts
export type GatewaySessionRunStatus = "active" | "idle" | "stalled" | "error";
```

<a id="symbol-core-gateway-gatewaysnapshotbindinginput"></a>

## GatewaySnapshotBindingInput

Kind: type

```ts
export type GatewaySnapshotBindingInput = {
    key?: string | null;
    sessionKey?: string | null;
    source?: string | null;
    channel?: string | null;
    agentId?: string | null;
    actionId?: string | null;
};
```

<a id="symbol-core-gateway-gatewaysnapshotbindingresolver"></a>

## GatewaySnapshotBindingResolver

Kind: type

```ts
export type GatewaySnapshotBindingResolver = (input: GatewaySnapshotBindingInput) => GatewayResolvedRouteBinding | null;
```

<a id="symbol-core-gateway-gatewaysnapshotfallbackmode"></a>

## GatewaySnapshotFallbackMode

Kind: type

```ts
export type GatewaySnapshotFallbackMode = "none" | "empty" | "demo";
```

<a id="symbol-core-gateway-gatewaysnapshotfallbackoverrides"></a>

## GatewaySnapshotFallbackOverrides

Kind: type

```ts
export type GatewaySnapshotFallbackOverrides = Partial<GatewaySnapshotFallbacks> & {
    costHistory?: GatewayCostHistoryFallback | null;
};
```

<a id="symbol-core-gateway-gatewaysnapshotfallbackprovider"></a>

## GatewaySnapshotFallbackProvider

Kind: type

```ts
export type GatewaySnapshotFallbackProvider = {
    snapshots?: GatewaySnapshotFallbacks | (() => GatewaySnapshotFallbacks);
    costHistory?: GatewayCostHistoryFallback;
};
```

<a id="symbol-core-gateway-gatewaysnapshotfallbacks"></a>

## GatewaySnapshotFallbacks

Kind: type

```ts
export type GatewaySnapshotFallbacks = {
    overview: GatewayOverviewSnapshot | (() => GatewayOverviewSnapshot);
    agentRuns: GatewaySessionRunsSnapshot | (() => GatewaySessionRunsSnapshot);
    runDetail: GatewaySessionRunDetailSnapshot | ((key: string) => GatewaySessionRunDetailSnapshot);
    routingMatrix: GatewayRoutingMatrixSnapshot | ((windowDays: number) => GatewayRoutingMatrixSnapshot);
    incidents: GatewayIncidentsSnapshot | (() => GatewayIncidentsSnapshot);
};
```

<a id="symbol-core-gateway-gatewaysnapshotloaders"></a>

## GatewaySnapshotLoaders

Kind: type

```ts
export type GatewaySnapshotLoaders = {
    loadOverview: () => Promise<DataEnvelope<GatewayOverviewSnapshot>>;
    loadAgentRuns: (filters: GatewaySnapshotRunFilters) => Promise<DataEnvelope<GatewaySessionRunsSnapshot>>;
    loadRunDetail: (key: string) => Promise<DataEnvelope<GatewaySessionRunDetailSnapshot>>;
    loadRoutingMatrix: (windowDays: number) => Promise<DataEnvelope<GatewayRoutingMatrixSnapshot>>;
    loadIncidents: () => Promise<DataEnvelope<GatewayIncidentsSnapshot>>;
};
```

<a id="symbol-core-gateway-gatewaysnapshotrunfilters"></a>

## GatewaySnapshotRunFilters

Kind: type

```ts
export type GatewaySnapshotRunFilters = {
    search: string;
    activeMinutes: number;
    limit: number;
};
```

<a id="symbol-core-gateway-gatewaysseruneventendpointmap"></a>

## GatewaySseRunEventEndpointMap

Kind: type

```ts
export type GatewaySseRunEventEndpointMap = {
    run: (runId: string) => string;
    runEvents: (runId: string) => string;
};
```

<a id="symbol-core-gateway-gatewaysseruneventheaderresolver"></a>

## GatewaySseRunEventHeaderResolver

Kind: type

```ts
export type GatewaySseRunEventHeaderResolver = (params: {
    runId: string;
    phase: GatewaySseRunEventPhase;
}) => Record<string, string | null | undefined>;
```

<a id="symbol-core-gateway-gatewaysseruneventphase"></a>

## GatewaySseRunEventPhase

Kind: type

```ts
export type GatewaySseRunEventPhase = "events" | "poll";
```

<a id="symbol-core-gateway-gatewaysseruneventprovider"></a>

## GatewaySseRunEventProvider

Kind: class

```ts
/**
 * Provider-neutral run-event SSE reader. Generic stream mechanics live in
 * core/sse; this class owns gateway request headers, canonical run-event
 * translation, and status polling fallback. Provider adapters should only
 * supply endpoint maps and any gateway-specific session/routing headers.
 */
export declare class GatewaySseRunEventProvider implements RunEventStreamProvider {
    private readonly httpBase;
    private readonly authToken;
    private readonly clientId;
    private readonly endpoints;
    private readonly headers;
    private readonly resolveHeaders?;
    private readonly fallbackToPoll;
    private readonly pollIntervalMs;
    private readonly pollTimeoutMs;
    private readonly fetchImpl;
    constructor(options: GatewaySseRunEventProviderOptions);
    subscribe(params: RunEventStreamSubscribeParams, handlers: RunEventStreamHandlers): Promise<RunEventStreamSubscription>;
    private buildHeaders;
    private streamEvents;
    private pollUntilTerminal;
}
```

<a id="symbol-core-gateway-gatewaysseruneventprovideroptions"></a>

## GatewaySseRunEventProviderOptions

Kind: type

```ts
export type GatewaySseRunEventProviderOptions = {
    httpBase: string;
    authToken: string | null;
    clientId: string;
    endpoints?: GatewaySseRunEventEndpointMap;
    /**
     * Static provider headers. Provider adapters use this for gateway-specific
     * routing/session headers while the base class owns SSE parsing and polling.
     */
    headers?: Record<string, string | null | undefined>;
    /** Dynamic provider headers, resolved separately for the SSE request and poll fallback. */
    resolveHeaders?: GatewaySseRunEventHeaderResolver;
    /**
     * When true (default), falls back to polling the configured run status endpoint on terminal SSE failure modes
     * (404/405/406/501, "stream disabled" 400, non-SSE content-type, missing readable body).
     */
    fallbackToPoll?: boolean;
    pollIntervalMs?: number;
    pollTimeoutMs?: number;
    fetchImpl?: typeof fetch;
};
```

<a id="symbol-core-gateway-gatewaystreamevent"></a>

## GatewayStreamEvent

Kind: type

```ts
export type GatewayStreamEvent = {
    event: string;
    payload: unknown;
};
```

<a id="symbol-core-gateway-gatewaysupportsaction"></a>

## gatewaySupportsAction

Kind: function

```ts
export declare function gatewaySupportsAction(input: GatewayFeatureCapabilityInput, action: string): boolean;
```

<a id="symbol-core-gateway-gatewaysupportsmediakind"></a>

## gatewaySupportsMediaKind

Kind: function

```ts
export declare function gatewaySupportsMediaKind(input: GatewayFeatureCapabilityInput, kind: GatewayMediaKind | string): boolean;
```

<a id="symbol-core-gateway-gatewaysupportsrpcmethod"></a>

## gatewaySupportsRpcMethod

Kind: function

```ts
export declare function gatewaySupportsRpcMethod(input: GatewayFeatureCapabilityInput, method: string): boolean;
```

<a id="symbol-core-gateway-gatewaysupportstexttospeech"></a>

## gatewaySupportsTextToSpeech

Kind: function

```ts
export declare function gatewaySupportsTextToSpeech(input: GatewayFeatureCapabilityInput): boolean;
```

<a id="symbol-core-gateway-gatewaysystemloaders"></a>

## GatewaySystemLoaders

Kind: type

```ts
export type GatewaySystemLoaders = {
    loadHealthSnapshotRaw: () => Promise<HealthSnapshotPayload>;
    loadLogsTailRaw: (params: {
        limit: number;
        maxBytes: number;
    }) => Promise<LogsTailPayload>;
};
```

<a id="symbol-core-gateway-gatewaytexttospeechrequest"></a>

## GatewayTextToSpeechRequest

Kind: type

```ts
export type GatewayTextToSpeechRequest = Omit<GatewayMediaGenerateInput, "input"> & {
    text: string;
};
```

<a id="symbol-core-gateway-gatewaywikiapiclient"></a>

## GatewayWikiApiClient

Kind: class

```ts
export declare class GatewayWikiApiClient extends BaseHttpApiClient implements GatewayWikiClient {
    readonly endpoints: GatewayWikiEndpointMap;
    constructor(options: HttpApiClientOptions, wikiOptions?: GatewayWikiApiClientOptions);
    listWikiVaults(): Promise<GatewayWikiVaultList>;
    getWikiVault(vaultId: string): Promise<GatewayWikiVault>;
    getWikiTree(vaultId: string): Promise<GatewayWikiTree>;
    readWikiPage(vaultId: string, path: string): Promise<GatewayWikiPage>;
    ingestWiki(vaultId: string, body: GatewayWikiIngestRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    compileWiki(vaultId: string, body: GatewayWikiCompileRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    promoteWiki(vaultId: string, body: GatewayWikiPromoteRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    getWikiJob(vaultId: string, jobId: string): Promise<GatewayWikiJobResult>;
    getWikiArtifact(vaultId: string, artifactId: string, init?: GatewayWikiArtifactRequest): Promise<Blob>;
}
```

<a id="symbol-core-gateway-gatewaywikiapiclientoptions"></a>

## GatewayWikiApiClientOptions

Kind: type

```ts
export type GatewayWikiApiClientOptions = {
    endpoints?: GatewayWikiEndpointMap;
    surface?: string;
};
```

<a id="symbol-core-gateway-gatewaywikiartifactrequest"></a>

## GatewayWikiArtifactRequest

Kind: type

```ts
export type GatewayWikiArtifactRequest = Pick<HttpApiRequestInit, "cache" | "credentials" | "headers" | "signal" | "timeoutMs"> & {
    accept?: string;
};
```

<a id="symbol-core-gateway-gatewaywikiclient"></a>

## GatewayWikiClient

Kind: interface

```ts
export interface GatewayWikiClient {
    listWikiVaults(): Promise<GatewayWikiVaultList>;
    getWikiVault(vaultId: string): Promise<GatewayWikiVault>;
    getWikiTree(vaultId: string): Promise<GatewayWikiTree>;
    readWikiPage(vaultId: string, path: string): Promise<GatewayWikiPage>;
    ingestWiki(vaultId: string, body: GatewayWikiIngestRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    compileWiki(vaultId: string, body: GatewayWikiCompileRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    promoteWiki(vaultId: string, body: GatewayWikiPromoteRequest, idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    getWikiJob(vaultId: string, jobId: string): Promise<GatewayWikiJobResult>;
    getWikiArtifact(vaultId: string, artifactId: string, init?: GatewayWikiArtifactRequest): Promise<Blob>;
}
```

<a id="symbol-core-gateway-gatewaywikicompilerequest"></a>

## GatewayWikiCompileRequest

Kind: type

```ts
export type GatewayWikiCompileRequest = {
    path?: string;
    paths?: readonly string[];
    target?: GatewayWikiFormat | string;
    outputPath?: string;
    options?: Record<string, GatewayWikiJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikiendpointmap"></a>

## GatewayWikiEndpointMap

Kind: type

```ts
export type GatewayWikiEndpointMap = {
    vaults: string;
    vault: (vaultId: string) => string;
    tree: (vaultId: string) => string;
    read: (vaultId: string, path: string) => string;
    ingest: (vaultId: string) => string;
    compile: (vaultId: string) => string;
    promote: (vaultId: string) => string;
    job: (vaultId: string, jobId: string) => string;
    artifact: (vaultId: string, artifactId: string) => string;
};
```

<a id="symbol-core-gateway-gatewaywikiformat"></a>

## GatewayWikiFormat

Kind: type

```ts
export type GatewayWikiFormat = (typeof GATEWAY_WIKI_FORMATS)[number];
```

<a id="symbol-core-gateway-gatewaywikiingestrequest"></a>

## GatewayWikiIngestRequest

Kind: type

```ts
export type GatewayWikiIngestRequest = {
    path?: string;
    title?: string;
    content?: string;
    sourceUrl?: string;
    sourcePath?: string;
    artifactId?: string;
    format?: GatewayWikiFormat | string;
    tags?: readonly string[];
    frontmatter?: Record<string, GatewayWikiJsonValue>;
    teamId?: string;
    memberId?: string;
    actionId?: string;
    options?: Record<string, GatewayWikiJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikijobresult"></a>

## GatewayWikiJobResult

Kind: type

```ts
export type GatewayWikiJobResult = {
    object?: string;
    id?: string;
    jobId?: string;
    vaultId?: string;
    path?: string;
    status: "queued" | "running" | "completed" | "failed" | "cancelled" | string;
    artifactId?: string;
    outputPath?: string;
    page?: GatewayWikiPage;
    error?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikijsonvalue"></a>

## GatewayWikiJsonValue

Kind: type

```ts
export type GatewayWikiJsonValue = string | number | boolean | null | readonly GatewayWikiJsonValue[] | {
    readonly [key: string]: GatewayWikiJsonValue;
};
```

<a id="symbol-core-gateway-gatewaywikipage"></a>

## GatewayWikiPage

Kind: type

```ts
export type GatewayWikiPage = {
    object?: string;
    vaultId: string;
    path: string;
    title?: string;
    format?: GatewayWikiFormat | string;
    content: string;
    frontmatter?: Record<string, GatewayWikiJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikipromoterequest"></a>

## GatewayWikiPromoteRequest

Kind: type

```ts
export type GatewayWikiPromoteRequest = {
    sourcePath?: string;
    targetPath?: string;
    artifactId?: string;
    title?: string;
    status?: string;
    tags?: readonly string[];
    frontmatter?: Record<string, GatewayWikiJsonValue>;
    options?: Record<string, GatewayWikiJsonValue>;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikitree"></a>

## GatewayWikiTree

Kind: type

```ts
export type GatewayWikiTree = {
    object?: string;
    vaultId: string;
    entries: readonly GatewayWikiTreeEntry[];
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikitreeentry"></a>

## GatewayWikiTreeEntry

Kind: type

```ts
export type GatewayWikiTreeEntry = {
    path: string;
    kind: "directory" | "file" | string;
    title?: string;
    format?: GatewayWikiFormat | string;
    size?: number;
    updatedAt?: string;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikivault"></a>

## GatewayWikiVault

Kind: type

```ts
export type GatewayWikiVault = {
    id: string;
    label?: string;
    pluginId?: string;
    rootPath?: string;
    defaultFormat?: GatewayWikiFormat | string;
    capabilities?: readonly string[];
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-gatewaywikivaultlist"></a>

## GatewayWikiVaultList

Kind: type

```ts
export type GatewayWikiVaultList = {
    object?: string;
    vaults: readonly GatewayWikiVault[];
};
```

<a id="symbol-core-gateway-generatedevicekeypair"></a>

## generateDeviceKeypair

Kind: function

```ts
export declare function generateDeviceKeypair(): Promise<CryptoKeyPair>;
```

<a id="symbol-core-gateway-getorcreatettlcacheentry"></a>

## getOrCreateTtlCacheEntry

Kind: function

```ts
export declare function getOrCreateTtlCacheEntry<TPayload>(cache: Map<string, TtlCacheEntry<TPayload>>, cacheKey: string): TtlCacheEntry<TPayload>;
```

<a id="symbol-core-gateway-healthsnapshot"></a>

## HealthSnapshot

Kind: type

```ts
export type HealthSnapshot = GatewayHealthSnapshot;
```

<a id="symbol-core-gateway-healthsnapshotpayload"></a>

## HealthSnapshotPayload

Kind: type

```ts
export type HealthSnapshotPayload = {
    ready: boolean;
    failing?: unknown[];
    uptimeMs?: number | null;
};
```

<a id="symbol-core-gateway-incidentrecord"></a>

## IncidentRecord

Kind: type

```ts
export type IncidentRecord = GatewayIncidentRecord;
```

<a id="symbol-core-gateway-incidentseverity"></a>

## IncidentSeverity

Kind: type

```ts
export type IncidentSeverity = GatewayIncidentSeverity;
```

<a id="symbol-core-gateway-incidentssnapshot"></a>

## IncidentsSnapshot

Kind: type

```ts
export type IncidentsSnapshot = GatewayIncidentsSnapshot;
```

<a id="symbol-core-gateway-incidentstatus"></a>

## IncidentStatus

Kind: type

```ts
export type IncidentStatus = GatewayIncidentStatus;
```

<a id="symbol-core-gateway-isdeviceidentitysupported"></a>

## isDeviceIdentitySupported

Kind: function

```ts
export declare function isDeviceIdentitySupported(): boolean;
```

<a id="symbol-core-gateway-isgatewayjobsuccessfulstatus"></a>

## isGatewayJobSuccessfulStatus

Kind: function

```ts
export declare function isGatewayJobSuccessfulStatus(status: GatewayJobStatus | null | undefined): boolean;
```

<a id="symbol-core-gateway-isgatewayjobterminalstatus"></a>

## isGatewayJobTerminalStatus

Kind: function

```ts
export declare function isGatewayJobTerminalStatus(status: GatewayJobStatus | null | undefined): boolean;
```

<a id="symbol-core-gateway-ismissingagentconfigrouteerror"></a>

## isMissingAgentConfigRouteError

Kind: function

```ts
export declare function isMissingAgentConfigRouteError(error: unknown): boolean;
```

<a id="symbol-core-gateway-isunchangedsessionslistpayload"></a>

## isUnchangedSessionsListPayload

Kind: function

```ts
export declare function isUnchangedSessionsListPayload(payload: unknown): payload is SessionsListUnchangedPayload;
```

<a id="symbol-core-gateway-loadorcreatedeviceidentity"></a>

## loadOrCreateDeviceIdentity

Kind: function

```ts
export declare function loadOrCreateDeviceIdentity(): Promise<DeviceIdentity | null>;
```

<a id="symbol-core-gateway-logstailpayload"></a>

## LogsTailPayload

Kind: type

```ts
export type LogsTailPayload = {
    lines?: string[];
};
```

<a id="symbol-core-gateway-mergegatewayrpcclientoptionsforreactnative"></a>

## mergeGatewayRpcClientOptionsForReactNative

Kind: function

```ts
/** Defaults for React Native while preserving caller-provided client identity. */
export declare function mergeGatewayRpcClientOptionsForReactNative(options?: GatewayRpcClientOptions): GatewayRpcClientOptions;
```

<a id="symbol-core-gateway-mergegatewaysnapshotfallbacks"></a>

## mergeGatewaySnapshotFallbacks

Kind: function

```ts
export declare function mergeGatewaySnapshotFallbacks(base: GatewaySnapshotFallbacks, overrides?: Partial<GatewaySnapshotFallbacks> | null): GatewaySnapshotFallbacks;
```

<a id="symbol-core-gateway-mutationresult"></a>

## MutationResult

Kind: type

```ts
export type MutationResult<TData> = {
    data: TData;
    source: DataSourceMode;
    appliedAt: number;
    contractGaps: ContractGap[];
};
```

<a id="symbol-core-gateway-normalizeagentprofiles"></a>

## normalizeAgentProfiles

Kind: function

```ts
export declare function normalizeAgentProfiles(payload: unknown): AgentProfileSummary[];
```

<a id="symbol-core-gateway-normalizedgatewayfeaturecapabilities"></a>

## NormalizedGatewayFeatureCapabilities

Kind: type

```ts
export type NormalizedGatewayFeatureCapabilities = {
    media: boolean;
    mediaKinds: GatewayMediaCapabilityMap;
    textToSpeech: boolean;
    wiki: boolean;
    sse: boolean;
    websocket: boolean;
    rpc: boolean;
    rpcMethods: readonly string[];
    actions: readonly string[];
    commands: readonly string[];
    rawFeatures: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-normalizedgatewaystreamfailure"></a>

## NormalizedGatewayStreamFailure

Kind: type

```ts
export type NormalizedGatewayStreamFailure = {
    state: "idle" | "connecting" | "reconnecting" | "connected" | "error";
    error: string | null;
    retryable: boolean;
};
```

<a id="symbol-core-gateway-normalizegatewaybaseurl"></a>

## normalizeGatewayBaseUrl

Kind: function

```ts
export declare function normalizeGatewayBaseUrl(rawGatewayBaseUrl: string | null | undefined): string | null;
```

<a id="symbol-core-gateway-normalizegatewayfeaturecapabilities"></a>

## normalizeGatewayFeatureCapabilities

Kind: function

```ts
export declare function normalizeGatewayFeatureCapabilities(options?: NormalizeGatewayFeatureCapabilitiesOptions): NormalizedGatewayFeatureCapabilities;
```

<a id="symbol-core-gateway-normalizegatewayfeaturecapabilitiesoptions"></a>

## NormalizeGatewayFeatureCapabilitiesOptions

Kind: type

```ts
export type NormalizeGatewayFeatureCapabilitiesOptions = {
    capabilities?: GatewayCapabilities | null;
    mediaProviders?: GatewayMediaProviderCapabilityInput | null;
};
```

<a id="symbol-core-gateway-normalizegatewayprovidertoken"></a>

## normalizeGatewayProviderToken

Kind: function

```ts
export declare function normalizeGatewayProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-core-gateway-normalizegatewaystreamfailure"></a>

## normalizeGatewayStreamFailure

Kind: function

```ts
/**
 * Classifies stream / RPC failures for reconnect vs hard-error UX.
 * GatewayRpcError codes are checked before substring heuristics on messages.
 */
export declare function normalizeGatewayStreamFailure(error: unknown): NormalizedGatewayStreamFailure;
```

<a id="symbol-core-gateway-normalizerun"></a>

## normalizeRun

Kind: function

```ts
export declare function normalizeRun(row: RawSessionRow, index: number): GatewaySessionRun;
```

<a id="symbol-core-gateway-normalizeruntimeprovidertoken"></a>

## normalizeRuntimeProviderToken

Kind: function

```ts
export declare function normalizeRuntimeProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-core-gateway-normalizesessionslistpayload"></a>

## normalizeSessionsListPayload

Kind: function

```ts
export declare function normalizeSessionsListPayload(payload: SessionsListRpcPayload): SessionsListPayloadWithCache;
```

<a id="symbol-core-gateway-overviewkpis"></a>

## OverviewKpis

Kind: type

```ts
export type OverviewKpis = GatewayOverviewKpis;
```

<a id="symbol-core-gateway-overviewsnapshot"></a>

## OverviewSnapshot

Kind: type

```ts
export type OverviewSnapshot = GatewayOverviewSnapshot;
```

<a id="symbol-core-gateway-paramspec"></a>

## ParamSpec

Kind: type

```ts
export type ParamSpec = {
    type: string;
    required?: boolean;
    note?: string;
};
```

<a id="symbol-core-gateway-parseagentvoiceconfig"></a>

## parseAgentVoiceConfig

Kind: function

```ts
export declare function parseAgentVoiceConfig(rawConfig: unknown): AgentVoiceConfig;
```

<a id="symbol-core-gateway-parsegatewayerrortext"></a>

## parseGatewayErrorText

Kind: function

```ts
export declare function parseGatewayErrorText(text: string, contentType: string): {
    message: string | null;
    code: string | null;
};
```

<a id="symbol-core-gateway-parsegatewayroutingquery"></a>

## parseGatewayRoutingQuery

Kind: function

```ts
export declare function parseGatewayRoutingQuery(searchParams: URLSearchParams): {
    windowDays: number;
};
```

<a id="symbol-core-gateway-parsegatewayrunsquery"></a>

## parseGatewayRunsQuery

Kind: variable

```ts
export declare const parseGatewayRunsQuery: typeof parseGatewaySessionRunsQuery;
```

<a id="symbol-core-gateway-parsegatewaysessionrunsquery"></a>

## parseGatewaySessionRunsQuery

Kind: function

```ts
export declare function parseGatewaySessionRunsQuery(searchParams: URLSearchParams): {
    search: string;
    activeMinutes: number;
    limit: number;
};
```

<a id="symbol-core-gateway-patchprofileconfigoptions"></a>

## PatchProfileConfigOptions

Kind: type

```ts
export type PatchProfileConfigOptions = {
    baseEtag?: string;
    sourcePath?: string;
};
```

<a id="symbol-core-gateway-portal-config-patch-client-id-header"></a>

## PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER

Kind: variable

```ts
/** Optional header some gateways require for audit / routing. */
export declare const PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER: "X-Portal-Client-Id";
```

<a id="symbol-core-gateway-portal-config-patch-contract"></a>

## PORTAL_CONFIG_PATCH_CONTRACT

Kind: variable

```ts
/**
 * Shared HTTP contract for portal dashboard config updates (POST).
 * Any client (mobile, web, scripts) may call {@link postPortalConfigPatch} against
 * the portal config surface once the gateway implements the route.
 */
export declare const PORTAL_CONFIG_PATCH_CONTRACT: "PORTAL_CONFIG_PATCH_V1";
```

<a id="symbol-core-gateway-portal-config-patch-contract-version"></a>

## PORTAL_CONFIG_PATCH_CONTRACT_VERSION

Kind: variable

```ts
export declare const PORTAL_CONFIG_PATCH_CONTRACT_VERSION: 1;
```

<a id="symbol-core-gateway-portalconfigpatcherror"></a>

## PortalConfigPatchError

Kind: class

```ts
export declare class PortalConfigPatchError extends Error {
    readonly status: number;
    readonly responseBody: string | null;
    constructor(status: number, message: string, responseBody: string | null);
}
```

<a id="symbol-core-gateway-portalconfigpatchpath"></a>

## portalConfigPatchPath

Kind: function

```ts
export declare function portalConfigPatchPath(portalSlug: string): string;
```

<a id="symbol-core-gateway-portalconfigpatchrequestbody"></a>

## PortalConfigPatchRequestBody

Kind: type

```ts
export type PortalConfigPatchRequestBody = {
    contract: typeof PORTAL_CONFIG_PATCH_CONTRACT;
    v: typeof PORTAL_CONFIG_PATCH_CONTRACT_VERSION;
    /** Gateway-defined scope (e.g. `readiness`, `snapshot.thresholds`). */
    scope: string;
    /** Nested object; build from flat UI keys with {@link unflattenPortalConfigPatchKeys}. */
    patch: Record<string, unknown>;
};
```

<a id="symbol-core-gateway-postportalconfigpatch"></a>

## postPortalConfigPatch

Kind: function

```ts
export declare function postPortalConfigPatch(params: PostPortalConfigPatchParams): Promise<unknown>;
```

<a id="symbol-core-gateway-postportalconfigpatchparams"></a>

## PostPortalConfigPatchParams

Kind: type

```ts
export type PostPortalConfigPatchParams = {
    httpBase: string;
    /** Bearer secret without the `Bearer ` prefix. */
    authToken: string;
    /** URL segment only, e.g. `portal-a`. */
    portalSlug: string;
    scope: string;
    patch: Record<string, unknown>;
    /** Sent as {@link PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER} when non-empty. */
    clientId?: string;
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
};
```

<a id="symbol-core-gateway-previewitem"></a>

## PreviewItem

Kind: type

```ts
export type PreviewItem = {
    key?: string;
    status?: string;
    items?: Array<{
        role?: string;
        sender?: string;
        text?: string;
        at?: number;
    }>;
};
```

<a id="symbol-core-gateway-providereventspec"></a>

## ProviderEventSpec

Kind: type

```ts
export type ProviderEventSpec = {
    name: string;
    family: string;
    payload?: ResponseSpec;
    note?: string;
};
```

<a id="symbol-core-gateway-providermanifest"></a>

## ProviderManifest

Kind: type

```ts
export type ProviderManifest = {
    /** Provider identifier (`openclaw`, `hermes`, …). */
    provider: string;
    /** Manifest revision; bump when the schema or content shape changes. */
    version: string;
    /** Upstream doc location this manifest mirrors. */
    upstream: {
        repo: string;
        path: string;
        note?: string;
    };
    rpc: Readonly<Record<string, ProviderRpcMethod>>;
    rest: Readonly<Record<string, ProviderRestEndpoint>>;
    events: Readonly<Record<string, ProviderEventSpec>>;
};
```

<a id="symbol-core-gateway-providerregistry"></a>

## ProviderRegistry

Kind: type

```ts
export type ProviderRegistry<M extends RuntimeProviderModule = GatewayProviderModule> = RuntimeProviderRegistry<M>;
```

<a id="symbol-core-gateway-providerrestendpoint"></a>

## ProviderRestEndpoint

Kind: type

```ts
export type ProviderRestEndpoint = {
    /** Surface grouping mirrors the upstream doc's HTTP families. */
    surface: string;
    method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";
    /** Path template, e.g. `/sessions/:sessionKey/kill`. */
    path: string;
    auth: "none" | "bearer" | "bearer-or-header" | "bearer-loopback" | "plugin-defined";
    status: ProviderRestStatus;
    docSection?: string;
    note?: string;
};
```

<a id="symbol-core-gateway-providerreststatus"></a>

## ProviderRestStatus

Kind: type

```ts
export type ProviderRestStatus = "doc-only" | "live-verified";
```

<a id="symbol-core-gateway-providerrpcmethod"></a>

## ProviderRpcMethod

Kind: type

```ts
export type ProviderRpcMethod = {
    /** Wire method name, e.g. `chat.send`. */
    method: string;
    /** Slug grouping the method, mirrors the upstream doc's section. */
    category: string;
    /** Required scope(s) to invoke. `dynamic` is plugin-resolved per call. */
    scope: GatewayScope | readonly GatewayScope[];
    /** Whether the gateway advertises this method in `hello-ok.features.methods`. */
    advertised: boolean;
    status: ProviderRpcStatus;
    params?: Record<string, ParamSpec>;
    response?: ResponseSpec;
    behavior?: RpcBehaviorSpec;
    /** Stable anchor or section label from the upstream doc (drift detection). */
    docSection?: string;
    note?: string;
};
```

<a id="symbol-core-gateway-providerrpcstatus"></a>

## ProviderRpcStatus

Kind: type

```ts
export type ProviderRpcStatus = "doc-only" | "shape-verified" | "live-verified";
```

<a id="symbol-core-gateway-rawsessionrow"></a>

## RawSessionRow

Kind: type

```ts
export type RawSessionRow = {
    key?: string;
    label?: string;
    derivedTitle?: string;
    agentId?: string;
    channel?: string;
    createdAt?: number | null;
    updatedAt?: number | null;
    state?: "pending" | "active" | "completed" | "cancelled" | "failed" | "unknown";
    abortedLastRun?: boolean;
    totalTokens?: number;
    origin?: {
        provider?: string;
        surface?: string;
    };
};
```

<a id="symbol-core-gateway-rawusagesession"></a>

## RawUsageSession

Kind: type

```ts
export type RawUsageSession = {
    key?: string;
    agentId?: string;
    channel?: string;
    modelProvider?: string;
    model?: string;
    modelOverride?: string;
    providerOverride?: string;
    origin?: {
        provider?: string;
        surface?: string;
    };
    usage?: {
        totalTokens?: number;
        totalCost?: number;
        messageCounts?: {
            total?: number;
            toolCalls?: number;
            errors?: number;
        };
    } | null;
};
```

<a id="symbol-core-gateway-readinessinput"></a>

## ReadinessInput

Kind: type

```ts
export type ReadinessInput = {
    ready: boolean;
    failing: string[];
    uptimeMs: number | null;
    statusCode: 200 | 503;
};
```

<a id="symbol-core-gateway-requestedgatewayprovider"></a>

## requestedGatewayProvider

Kind: function

```ts
export declare function requestedGatewayProvider(options: ResolveGatewayProviderOptions): string | null;
```

<a id="symbol-core-gateway-requestgatewayraw"></a>

## requestGatewayRaw

Kind: function

```ts
export declare function requestGatewayRaw(path: string, options: GatewayHttpFetchOptions): Promise<Response>;
```

<a id="symbol-core-gateway-resolvedevicetokenonlyfallbackms"></a>

## resolveDeviceTokenOnlyFallbackMs

Kind: function

```ts
/** Delay before sending `connect` without a nonce when device identity is enabled. */
export declare function resolveDeviceTokenOnlyFallbackMs(params?: ResolveDeviceTokenOnlyFallbackMsParams): number;
```

<a id="symbol-core-gateway-resolvedevicetokenonlyfallbackmsparams"></a>

## ResolveDeviceTokenOnlyFallbackMsParams

Kind: type

```ts
export type ResolveDeviceTokenOnlyFallbackMsParams = {
    env?: GatewayPreauthHandshakeEnv;
    envKeys?: GatewayPreauthHandshakeEnvKeys;
    /** Explicit gateway handshake budget in milliseconds. */
    preauthHandshakeTimeoutMs?: number;
};
```

<a id="symbol-core-gateway-resolvedgatewayrpcclientprofile"></a>

## ResolvedGatewayRpcClientProfile

Kind: type

```ts
/** Resolved client fields for `connect` and device-auth v3 signing (must stay aligned). */
export type ResolvedGatewayRpcClientProfile = {
    clientId: string;
    clientVersion: string;
    clientPlatform: string;
    clientMode: string;
};
```

<a id="symbol-core-gateway-resolvedgatewaysnapshotfallbacks"></a>

## ResolvedGatewaySnapshotFallbacks

Kind: type

```ts
export type ResolvedGatewaySnapshotFallbacks = {
    snapshots: GatewaySnapshotFallbacks | null;
    costHistory: GatewayCostHistoryFallback | null;
};
```

<a id="symbol-core-gateway-resolvegatewayconnectscopes"></a>

## resolveGatewayConnectScopes

Kind: function

```ts
export declare function resolveGatewayConnectScopes(options?: GatewayRpcClientOptions): string[];
```

<a id="symbol-core-gateway-resolvegatewayproviderkind"></a>

## resolveGatewayProviderKind

Kind: function

```ts
export declare function resolveGatewayProviderKind(options?: ResolveGatewayProviderOptions): GatewayProviderKind;
```

<a id="symbol-core-gateway-resolvegatewayprovidermodule"></a>

## resolveGatewayProviderModule

Kind: function

```ts
export declare function resolveGatewayProviderModule(options?: ResolveGatewayProviderOptions): GatewayProviderModule | null;
```

<a id="symbol-core-gateway-resolvegatewayprovideroptions"></a>

## ResolveGatewayProviderOptions

Kind: type

```ts
export type ResolveGatewayProviderOptions = {
    provider?: GatewayProviderKind | string | null;
    env?: GatewayProviderEnv;
    defaultProvider?: GatewayProviderKind | string | null;
    registry?: GatewayProviderRegistry | null;
    providerModules?: readonly GatewayProviderModule[] | null;
    allowProviderOverrides?: boolean;
};
```

<a id="symbol-core-gateway-resolvegatewayrequestcredentials"></a>

## resolveGatewayRequestCredentials

Kind: function

```ts
export declare function resolveGatewayRequestCredentials(sessionAuthMode: boolean | null | undefined): RequestCredentials | undefined;
```

<a id="symbol-core-gateway-resolvegatewayrpcclientprofile"></a>

## resolveGatewayRpcClientProfile

Kind: function

```ts
export declare function resolveGatewayRpcClientProfile(options?: GatewayRpcClientOptions): ResolvedGatewayRpcClientProfile;
```

<a id="symbol-core-gateway-resolvegatewayruntimehttpbase"></a>

## resolveGatewayRuntimeHttpBase

Kind: function

```ts
export declare function resolveGatewayRuntimeHttpBase(gatewayBaseUrl: string, options?: ResolveGatewayRuntimeTargetOptions): string;
```

<a id="symbol-core-gateway-resolvegatewayruntimehttpurl"></a>

## resolveGatewayRuntimeHttpUrl

Kind: function

```ts
export declare function resolveGatewayRuntimeHttpUrl(gatewayBaseUrl: string, pathname: string, options?: ResolveGatewayRuntimeTargetOptions): string;
```

<a id="symbol-core-gateway-resolvegatewayruntimetargetoptions"></a>

## ResolveGatewayRuntimeTargetOptions

Kind: type

```ts
export type ResolveGatewayRuntimeTargetOptions = {
    configuredGatewayBaseUrl?: string | null;
    windowOrigin?: string | null;
    fallbackWsUrl?: string;
};
```

<a id="symbol-core-gateway-resolvegatewayruntimewsurl"></a>

## resolveGatewayRuntimeWsUrl

Kind: function

```ts
export declare function resolveGatewayRuntimeWsUrl(gatewayBaseUrl: string, options?: ResolveGatewayRuntimeTargetOptions): string;
```

<a id="symbol-core-gateway-resolvegatewaysnapshotfallbacks"></a>

## resolveGatewaySnapshotFallbacks

Kind: function

```ts
export declare function resolveGatewaySnapshotFallbacks(options?: ResolveGatewaySnapshotFallbacksOptions): ResolvedGatewaySnapshotFallbacks;
```

<a id="symbol-core-gateway-resolvegatewaysnapshotfallbacksoptions"></a>

## ResolveGatewaySnapshotFallbacksOptions

Kind: type

```ts
export type ResolveGatewaySnapshotFallbacksOptions = {
    mode?: GatewaySnapshotFallbackMode;
    provider?: GatewaySnapshotFallbackProvider | null;
    overrides?: GatewaySnapshotFallbackOverrides | null;
    now?: number;
};
```

<a id="symbol-core-gateway-resolvegatewaytargets"></a>

## resolveGatewayTargets

Kind: variable

```ts
export declare const resolveGatewayTargets: typeof resolveHttpWebSocketTargets;
```

<a id="symbol-core-gateway-resolvepreauthhandshaketimeoutms"></a>

## resolvePreauthHandshakeTimeoutMs

Kind: function

```ts
export declare function resolvePreauthHandshakeTimeoutMs(params?: ResolvePreauthHandshakeTimeoutMsParams): number;
```

<a id="symbol-core-gateway-resolvepreauthhandshaketimeoutmsparams"></a>

## ResolvePreauthHandshakeTimeoutMsParams

Kind: type

```ts
export type ResolvePreauthHandshakeTimeoutMsParams = {
    env?: GatewayPreauthHandshakeEnv;
    envKeys?: GatewayPreauthHandshakeEnvKeys;
    preauthHandshakeTimeoutMs?: number;
};
```

<a id="symbol-core-gateway-resolverunmodel"></a>

## resolveRunModel

Kind: function

```ts
export declare function resolveRunModel(row: RawUsageSession | null | undefined): string | undefined;
```

<a id="symbol-core-gateway-responsespec"></a>

## ResponseSpec

Kind: type

```ts
export type ResponseSpec = {
    shape?: string;
    note?: string;
};
```

<a id="symbol-core-gateway-routingmatrixsnapshot"></a>

## RoutingMatrixSnapshot

Kind: type

```ts
export type RoutingMatrixSnapshot = GatewayRoutingMatrixSnapshot;
```

<a id="symbol-core-gateway-rpcbehaviorspec"></a>

## RpcBehaviorSpec

Kind: type

```ts
export type RpcBehaviorSpec = {
    blocking?: boolean;
    streamsEvents?: boolean;
    idempotent?: boolean;
    aborts?: string;
};
```

<a id="symbol-core-gateway-run-stream-event-names"></a>

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

<a id="symbol-core-gateway-runeventstreamhandlers"></a>

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

<a id="symbol-core-gateway-runeventstreamprovider"></a>

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

<a id="symbol-core-gateway-runeventstreamsubscribeparams"></a>

## RunEventStreamSubscribeParams

Kind: type

```ts
export type RunEventStreamSubscribeParams = {
    runId: string;
    /** Optional caller-supplied abort signal. Implementations MUST honor abort and dispose. */
    signal?: AbortSignal;
};
```

<a id="symbol-core-gateway-runeventstreamsubscription"></a>

## RunEventStreamSubscription

Kind: type

```ts
/** Disposes an active subscription. Idempotent. */
export type RunEventStreamSubscription = {
    dispose(): void | Promise<void>;
};
```

<a id="symbol-core-gateway-runpreviewpollprovider"></a>

## RunPreviewPollProvider

Kind: class

```ts
/**
 * Synthesizes tool events from {@link AgentRunPreviewItem}s by polling the
 * run-detail snapshot. Used as a stopgap until the Hermes SSE protocol emits
 * `tool.call.*` events natively.
 *
 * Default mode is one-shot: subscribe → fetch snapshot once → emit a
 * `tool.call.completed` event for each tool item → fire `onComplete` → dispose.
 *
 * For in-progress polling (multi-shot), pass `maxPolls > 1` and a
 * `pollIntervalMs`. The provider dedupes by `(toolName, at)` so the same tool
 * call is never emitted twice.
 *
 * This provider DOES NOT emit lifecycle events (`message.delta`,
 * `run.completed`, etc.). Compose it alongside a Hermes/gateway provider that
 * handles the lifecycle.
 */
export declare class RunPreviewPollProvider implements RunEventStreamProvider {
    private readonly fetchSnapshot;
    private readonly maxPolls;
    private readonly pollIntervalMs;
    constructor(options: RunPreviewPollProviderOptions);
    subscribe(params: RunEventStreamSubscribeParams, handlers: RunEventStreamHandlers): Promise<RunEventStreamSubscription>;
}
```

<a id="symbol-core-gateway-runpreviewpollprovideroptions"></a>

## RunPreviewPollProviderOptions

Kind: type

```ts
export type RunPreviewPollProviderOptions = {
    /** Caller-supplied fetcher for the run-detail snapshot (mobile uses gateway loaders; web hits HTTP directly). */
    fetchSnapshot: RunPreviewSnapshotFetcher;
    /**
     * Cap on how many snapshots to poll before giving up. Each poll synthesizes
     * tool events for items newer than the previous snapshot.
     *
     * Set to 1 for one-shot "stitch tool events after run completed" usage.
     * Set higher to track in-progress tool calls before backend SSE catches up.
     */
    maxPolls?: number;
    /** Delay between polls when {@link maxPolls} > 1. */
    pollIntervalMs?: number;
};
```

<a id="symbol-core-gateway-runpreviewsnapshotfetcher"></a>

## RunPreviewSnapshotFetcher

Kind: type

```ts
export type RunPreviewSnapshotFetcher = (runId: string, signal?: AbortSignal) => Promise<AgentRunDetailSnapshot | null>;
```

<a id="symbol-core-gateway-runstreamapprovalchoice"></a>

## RunStreamApprovalChoice

Kind: type

```ts
export type RunStreamApprovalChoice = "once" | "session" | "always" | "deny";
```

<a id="symbol-core-gateway-runstreamapprovalrequestevent"></a>

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

<a id="symbol-core-gateway-runstreamevent"></a>

## RunStreamEvent

Kind: type

```ts
export type RunStreamEvent = RunStreamMessageDeltaEvent | RunStreamRunCompletedEvent | RunStreamRunFailedEvent | RunStreamRunCancelledEvent | RunStreamApprovalRequestEvent | RunStreamToolEvent;
```

<a id="symbol-core-gateway-runstreameventname"></a>

## RunStreamEventName

Kind: type

```ts
export type RunStreamEventName = (typeof RUN_STREAM_EVENT_NAMES)[keyof typeof RUN_STREAM_EVENT_NAMES];
```

<a id="symbol-core-gateway-runstreammessagedeltaevent"></a>

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

<a id="symbol-core-gateway-runstreamruncancelledevent"></a>

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

<a id="symbol-core-gateway-runstreamruncompletedevent"></a>

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

<a id="symbol-core-gateway-runstreamrunfailedevent"></a>

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

<a id="symbol-core-gateway-runstreamtoolcall"></a>

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

<a id="symbol-core-gateway-runstreamtoolevent"></a>

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

<a id="symbol-core-gateway-runstreamtoolstatus"></a>

## RunStreamToolStatus

Kind: type

```ts
export type RunStreamToolStatus = "pending" | "running" | "completed" | "failed";
```

<a id="symbol-core-gateway-runtimeclientoptions"></a>

## RuntimeClientOptions

Kind: type

```ts
export type RuntimeClientOptions = Pick<HttpApiClientOptions, "baseUrl" | "fetchImpl" | "onTrace">;
```

<a id="symbol-core-gateway-runtimeprovidermodule"></a>

## RuntimeProviderModule

Kind: interface

```ts
/** @deprecated Import RuntimeProviderModule from core/runtime. */
export interface RuntimeProviderModule extends RuntimeProviderModuleBase {
}
```

<a id="symbol-core-gateway-runtimeproviderregistry"></a>

## RuntimeProviderRegistry

Kind: interface

```ts
export interface RuntimeProviderRegistry<M extends RuntimeProviderModule = RuntimeProviderModule> {
    resolveProvider(provider: string | null | undefined): M | null;
    listProviders(): readonly M[];
}
```

<a id="symbol-core-gateway-samegatewaydaemon"></a>

## sameGatewayDaemon

Kind: function

```ts
export declare function sameGatewayDaemon(leftBaseUrl: string | null | undefined, rightBaseUrl: string | null | undefined): boolean;
```

<a id="symbol-core-gateway-sessiondetailpayload"></a>

## SessionDetailPayload

Kind: type

```ts
/** sessions.detail payload — kept loose because the gateway shape is still in flux. */
export type SessionDetailPayload = {
    key?: string;
    row?: unknown | null;
    usageSession?: unknown | null;
    preview?: unknown | null;
    errors?: {
        usage?: string | null;
    };
};
```

<a id="symbol-core-gateway-sessiondetailrequestparams"></a>

## SessionDetailRequestParams

Kind: type

```ts
export type SessionDetailRequestParams = {
    key: string;
    previewLimit?: number;
    maxChars?: number;
};
```

<a id="symbol-core-gateway-sessionhttprequestjson"></a>

## SessionHttpRequestJson

Kind: type

```ts
export type SessionHttpRequestJson = <T>(path: string, init?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    timeoutMs?: number;
}) => Promise<T>;
```

<a id="symbol-core-gateway-sessionloaders"></a>

## SessionLoaders

Kind: type

```ts
export type SessionLoaders = {
    loadSessionsListRaw: (params: SessionsListRequestParams, options?: GatewaySessionRequestOptions) => Promise<SessionsListPayloadWithCache>;
    loadSessionsUsageRaw: (params: Record<string, unknown>, options?: GatewaySessionRequestOptions) => Promise<SessionsUsagePayload>;
    loadSessionsPreviewRaw: (params: SessionsPreviewRequestParams, options?: GatewaySessionRequestOptions) => Promise<SessionsPreviewPayload>;
    loadSessionDetailRaw: (params: SessionDetailRequestParams, options?: GatewaySessionRequestOptions) => Promise<SessionDetailPayload>;
    /**
     * Synchronous read of the sessions.list cache for the given param shape. Returns the cached
     * payload (or null) without triggering a fetch. Lets callers do a fast-path lookup before
     * deciding to issue a real `loadSessionsListRaw` call (e.g. detail-by-key fallback).
     */
    peekSessionsListCache: (params: SessionsListRequestParams) => SessionsListPayloadWithCache | null;
    /**
     * Mutate per-session settings via `sessions.patch`. Fire-and-forget — caller is expected to
     * invalidate any session detail / list / usage query on resolve. No client-side caching.
     */
    patchSession: (params: SessionPatchInput, options?: GatewaySessionRequestOptions) => Promise<void>;
};
```

<a id="symbol-core-gateway-sessionpatchinput"></a>

## SessionPatchInput

Kind: type

```ts
/**
 * sessions.patch params — operator-tunable session settings.
 *
 * `null` clears the value (back to inherit). `undefined` leaves the field untouched.
 * `fastMode` is a tri-state: `true` = on, `false` = off, `null` = inherit, `undefined` = unchanged.
 */
export type SessionPatchInput = {
    key: string;
    label?: string | null;
    thinkingLevel?: string | null;
    fastMode?: boolean | null;
    verboseLevel?: string | null;
    reasoningLevel?: string | null;
};
```

<a id="symbol-core-gateway-sessions-detail-cache-ttl-ms"></a>

## SESSIONS_DETAIL_CACHE_TTL_MS

Kind: variable

```ts
/** Align with loader `staleTime` (~10–15s) so SSE/stream invalidations coalesce without hammering the gateway. */
export declare const SESSIONS_DETAIL_CACHE_TTL_MS = 12000;
```

<a id="symbol-core-gateway-sessionslistpayload"></a>

## SessionsListPayload

Kind: type

```ts
export type SessionsListPayload = {
    sessions?: RawSessionRow[];
    count?: number;
};
```

<a id="symbol-core-gateway-sessionslistpayloadwithcache"></a>

## SessionsListPayloadWithCache

Kind: type

```ts
/** sessions.list "happy" payload — the gateway returns this when content actually changed. */
export type SessionsListPayloadWithCache = SessionsListPayload & {
    hash?: string;
    count?: number;
    ts?: number;
    path?: string;
};
```

<a id="symbol-core-gateway-sessionslistrequestparams"></a>

## SessionsListRequestParams

Kind: type

```ts
/** Filters accepted by the gateway's `sessions.list` RPC. Mirrors the web's contract. */
export type SessionsListRequestParams = {
    includeGlobal?: boolean;
    includeUnknown?: boolean;
    includeDerivedTitles?: boolean;
    limit?: number;
    activeMinutes?: number;
    search?: string;
    label?: string;
    spawnedBy?: string;
    agentId?: string;
    lastHash?: string;
};
```

<a id="symbol-core-gateway-sessionslistrpcpayload"></a>

## SessionsListRpcPayload

Kind: type

```ts
export type SessionsListRpcPayload = SessionsListPayloadWithCache | SessionsListUnchangedPayload;
```

<a id="symbol-core-gateway-sessionslistunchangedpayload"></a>

## SessionsListUnchangedPayload

Kind: type

```ts
/** sessions.list "no-op" payload — gateway sends `{ unchanged: true, hash }` when nothing moved. */
export type SessionsListUnchangedPayload = {
    unchanged: true;
    hash: string;
    count?: number;
    ts?: number;
    path?: string;
};
```

<a id="symbol-core-gateway-sessionspreviewpayload"></a>

## SessionsPreviewPayload

Kind: type

```ts
export type SessionsPreviewPayload = {
    previews?: Array<{
        key?: string;
        status?: string;
        items?: Array<{
            role?: string;
            text?: string;
            at?: number;
        }>;
    }>;
};
```

<a id="symbol-core-gateway-sessionspreviewrequestparams"></a>

## SessionsPreviewRequestParams

Kind: type

```ts
export type SessionsPreviewRequestParams = {
    keys: string[];
    limit?: number;
    maxChars?: number;
};
```

<a id="symbol-core-gateway-sessionsusagepayload"></a>

## SessionsUsagePayload

Kind: type

```ts
export type SessionsUsagePayload = {
    sessions?: RawUsageSession[];
    aggregates?: {
        byProvider?: Array<{
            provider?: string;
            totals?: {
                totalTokens?: number;
                totalCost?: number;
            };
        }>;
        byAgent?: Array<{
            agentId?: string;
            totals?: {
                totalCost?: number;
            };
            messages?: number;
        }>;
        messages?: {
            total?: number;
            toolCalls?: number;
            errors?: number;
        };
    };
    totals?: {
        totalCost?: number;
    };
};
```

<a id="symbol-core-gateway-setagentconfigpathvalue"></a>

## setAgentConfigPathValue

Kind: function

```ts
export declare function setAgentConfigPathValue(config: Record<string, unknown>, path: string, value: AgentConfigFieldValue): Record<string, unknown>;
```

<a id="symbol-core-gateway-signpayload"></a>

## signPayload

Kind: function

```ts
export declare function signPayload(privateKey: CryptoKey, payload: string): Promise<string>;
```

<a id="symbol-core-gateway-tointinrange"></a>

## toIntInRange

Kind: function

```ts
export declare function toIntInRange(raw: string | null, fallback: number, min: number, max: number): number;
```

<a id="symbol-core-gateway-tryresolvegatewaytargets"></a>

## tryResolveGatewayTargets

Kind: variable

```ts
export declare const tryResolveGatewayTargets: typeof tryResolveHttpWebSocketTargets;
```

<a id="symbol-core-gateway-ttlcacheentry"></a>

## TtlCacheEntry

Kind: type

```ts
export type TtlCacheEntry<TPayload> = {
    payload: TPayload | null;
    expiresAt: number;
    inFlight: Promise<TPayload> | null;
};
```

<a id="symbol-core-gateway-unflattenportalconfigpatchkeys"></a>

## unflattenPortalConfigPatchKeys

Kind: function

```ts
/**
 * Turns flat keys like `foo › bar` into `{ foo: { bar: value } }`.
 */
export declare function unflattenPortalConfigPatchKeys(flat: Record<string, unknown>, separator?: string): Record<string, unknown>;
```

<a id="symbol-core-gateway-utcdateymd"></a>

## utcDateYmd

Kind: function

```ts
export declare function utcDateYmd(date: Date): string;
```

<a id="symbol-core-gateway-waitforgatewayjob"></a>

## waitForGatewayJob

Kind: function

```ts
export declare function waitForGatewayJob<TJob extends GatewayJobLike>(options: GatewayJobWaitOptions<TJob>): Promise<TJob>;
```

<a id="symbol-core-gateway-withfallback"></a>

## withFallback

Kind: function

```ts
export declare function withFallback<TData>(params: {
    run: () => Promise<TData>;
    fallback: TData;
    area: string;
    expectedContract: string;
    note: string;
    /** Optional observability hook: fired when the envelope resolves live or mock (C2). */
    onResolve?: (info: FallbackResolveInfo) => void;
}): Promise<DataEnvelope<TData>>;
```

<a id="symbol-core-gateway-withmutationresult"></a>

## withMutationResult

Kind: function

```ts
export declare function withMutationResult<TData>(params: {
    run: () => Promise<TData>;
    fallback: () => TData;
    area: string;
    expectedContract: string;
    note: string;
}): Promise<MutationResult<TData>>;
```
