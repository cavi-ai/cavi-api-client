# @cavi-ai/api-client/providers/openclaw

Package subpath: ./providers/openclaw

<a id="symbol-providers-openclaw-createopenclawteamregistry"></a>

## createOpenClawTeamRegistry

Kind: function

```ts
export declare function createOpenClawTeamRegistry(config?: TeamRegistryConfig): TeamRegistry;
```

<a id="symbol-providers-openclaw-createopenclawworkboardrpc"></a>

## createOpenClawWorkboardRpc

Kind: function

```ts
export declare function createOpenClawWorkboardRpc(transport: OpenClawRpcTransport): OpenClawWorkboardRpc;
```

<a id="symbol-providers-openclaw-openclaw-core-rpc-methods"></a>

## OPENCLAW_CORE_RPC_METHODS

Kind: variable

```ts
/**
 * The advertised subset of OpenClaw RPC methods — `hello-ok.features.methods`
 * filtered by `advertise !== false` in the upstream registry.
 */
export declare const OPENCLAW_CORE_RPC_METHODS: readonly string[];
```

<a id="symbol-providers-openclaw-openclaw-default-capabilities"></a>

## OPENCLAW_DEFAULT_CAPABILITIES

Kind: variable

```ts
/**
 * Manifest-time baseline capabilities. The real capability snapshot for a
 * connected gateway comes from the `hello-ok` WebSocket handshake — this blob
 * is the offline fallback when no live connection exists yet.
 */
export declare const OPENCLAW_DEFAULT_CAPABILITIES: OpenClawCapabilities;
```

<a id="symbol-providers-openclaw-openclaw-manifest"></a>

## OPENCLAW_MANIFEST

Kind: variable

```ts
export declare const OPENCLAW_MANIFEST: ProviderManifest;
```

<a id="symbol-providers-openclaw-openclaw-provider-module"></a>

## OPENCLAW_PROVIDER_MODULE

Kind: variable

```ts
export declare const OPENCLAW_PROVIDER_MODULE: GatewayProviderModule;
```

<a id="symbol-providers-openclaw-openclaw-rpc-methods"></a>

## OPENCLAW_RPC_METHODS

Kind: variable

```ts
/**
 * Camel-keyed lookup table of every OpenClaw RPC method (`chatSend → "chat.send"`).
 * Derived from `OPENCLAW_MANIFEST.rpc`; never define a new method string here.
 */
export declare const OPENCLAW_RPC_METHODS: RpcMethodTable;
```

<a id="symbol-providers-openclaw-openclaw-workboard-priorities"></a>

## OPENCLAW_WORKBOARD_PRIORITIES

Kind: variable

```ts
export declare const OPENCLAW_WORKBOARD_PRIORITIES: readonly [
    "low",
    "normal",
    "high",
    "urgent"
];
```

<a id="symbol-providers-openclaw-openclaw-workboard-rpc-methods"></a>

## OPENCLAW_WORKBOARD_RPC_METHODS

Kind: variable

```ts
export declare const OPENCLAW_WORKBOARD_RPC_METHODS: {
    readonly cardsList: "workboard.cards.list";
    readonly cardsCreate: "workboard.cards.create";
    readonly cardsUpdate: "workboard.cards.update";
    readonly cardsMove: "workboard.cards.move";
    readonly cardsDelete: "workboard.cards.delete";
    readonly cardsComment: "workboard.cards.comment";
    readonly cardsLink: "workboard.cards.link";
    readonly cardsLinkDependency: "workboard.cards.linkDependency";
    readonly cardsProof: "workboard.cards.proof";
    readonly cardsArtifact: "workboard.cards.artifact";
    readonly cardsClaim: "workboard.cards.claim";
    readonly cardsHeartbeat: "workboard.cards.heartbeat";
    readonly cardsRelease: "workboard.cards.release";
    readonly cardsPromote: "workboard.cards.promote";
    readonly cardsReassign: "workboard.cards.reassign";
    readonly cardsReclaim: "workboard.cards.reclaim";
    readonly cardsComplete: "workboard.cards.complete";
    readonly cardsBlock: "workboard.cards.block";
    readonly cardsUnblock: "workboard.cards.unblock";
    readonly cardsBulk: "workboard.cards.bulk";
    readonly cardsDiagnostics: "workboard.cards.diagnostics";
    readonly cardsDiagnosticsRefresh: "workboard.cards.diagnostics.refresh";
    readonly cardsDispatch: "workboard.cards.dispatch";
    readonly cardsStats: "workboard.cards.stats";
    readonly cardsRuns: "workboard.cards.runs";
    readonly cardsSpecify: "workboard.cards.specify";
    readonly cardsDecompose: "workboard.cards.decompose";
    readonly cardsArchive: "workboard.cards.archive";
    readonly cardsExport: "workboard.cards.export";
    readonly boardsList: "workboard.boards.list";
    readonly boardsUpsert: "workboard.boards.upsert";
    readonly boardsArchive: "workboard.boards.archive";
    readonly boardsDelete: "workboard.boards.delete";
    readonly notificationsSubscribe: "workboard.notifications.subscribe";
    readonly notificationsList: "workboard.notifications.list";
    readonly notificationsDelete: "workboard.notifications.delete";
    readonly notificationsEvents: "workboard.notifications.events";
    readonly notificationsAdvance: "workboard.notifications.advance";
    readonly attachmentsList: "workboard.cards.attachments.list";
    readonly attachmentsGet: "workboard.cards.attachments.get";
    readonly attachmentsAdd: "workboard.cards.attachments.add";
    readonly attachmentsDelete: "workboard.cards.attachments.delete";
    readonly workerLog: "workboard.cards.workerLog";
    readonly protocolViolation: "workboard.cards.protocolViolation";
};
```

<a id="symbol-providers-openclaw-openclaw-workboard-statuses"></a>

## OPENCLAW_WORKBOARD_STATUSES

Kind: variable

```ts
export declare const OPENCLAW_WORKBOARD_STATUSES: readonly [
    "triage",
    "backlog",
    "todo",
    "scheduled",
    "ready",
    "running",
    "review",
    "blocked",
    "done"
];
```

<a id="symbol-providers-openclaw-openclawagentconfigapiclient"></a>

## OpenClawAgentConfigApiClient

Kind: class

```ts
export declare class OpenClawAgentConfigApiClient extends GatewayAgentConfigApiClient {
    constructor(options: HttpApiClientOptions);
    listProfiles(): Promise<AgentProfileSummary[]>;
    getProfileConfig(_agentId: string): Promise<AgentConfig>;
    patchProfileConfig(_agentId: string, _diff: AgentConfigDraftDiff, _options?: PatchProfileConfigOptions): Promise<AgentConfig>;
}
```

<a id="symbol-providers-openclaw-openclawapiclient"></a>

## OpenClawApiClient

Kind: class

```ts
export declare class OpenClawApiClient extends GatewayApiClient {
    private readonly wsUrl?;
    private readonly rpcClientOverride;
    private readonly rpcClientOptions?;
    private rpcClient;
    constructor(options: OpenClawApiClientOptions);
    getCapabilities(): Promise<OpenClawCapabilities>;
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: GatewayRunStartBody): Promise<OpenClawRunStatus>;
    getRun(runId: string): Promise<OpenClawRunStatus>;
    stopRun(runId: string): Promise<{
        status: string;
    }>;
    resolveRunApproval<T = unknown>(): Promise<T>;
    private getRpcClient;
}
```

<a id="symbol-providers-openclaw-openclawapiclientoptions"></a>

## OpenClawApiClientOptions

Kind: type

```ts
export type OpenClawApiClientOptions = HttpApiClientOptions & {
    wsUrl?: string;
    rpcClient?: OpenClawRpcTransport | null;
    rpcClientOptions?: OpenClawWebSocketClientOptions;
};
```

<a id="symbol-providers-openclaw-openclawcapabilities"></a>

## OpenClawCapabilities

Kind: type

```ts
export type OpenClawCapabilities = GatewayCapabilities & {
    object?: "openclaw.api_server.capabilities" | string;
    platform?: "openclaw" | string;
    rpcMethods?: readonly string[];
};
```

<a id="symbol-providers-openclaw-openclawmediaapiclient"></a>

## OpenClawMediaApiClient

Kind: class

```ts
export declare class OpenClawMediaApiClient extends GatewayMediaApiClient {
    private readonly wsUrl?;
    private readonly rpcClientOverride;
    private readonly rpcClientOptions?;
    private rpcClient;
    constructor(options: OpenClawMediaApiClientOptions);
    listMediaProviders(kind?: GatewayMediaKind | null): Promise<GatewayMediaProviderList>;
    generateAudio(body: GatewayMediaGenerateInput, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateTextToSpeech(body: GatewayTextToSpeechRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateMedia(body: GatewayMediaGenerateRequest, idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateImage(_body: GatewayMediaGenerateInput, _idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateVideo(_body: GatewayMediaGenerateInput, _idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    generateMusic(_body: GatewayMediaGenerateInput, _idempotencyKey?: string): Promise<GatewayMediaGenerationResult>;
    getMediaJob(_kind: GatewayMediaKind, _jobId: string): Promise<GatewayMediaGenerationResult>;
    waitForMediaJob(_kind: GatewayMediaKind, _jobId: string, _options?: GatewayMediaJobWaitOptions): Promise<GatewayMediaGenerationResult>;
    listMediaAssets(_options?: GatewayMediaAssetListOptions): Promise<GatewayMediaAssetList>;
    getMediaAssetMetadata(_assetId: string): Promise<GatewayMediaAsset>;
    createMediaAsset(_body: GatewayMediaAssetUploadRequest, _idempotencyKey?: string): Promise<GatewayMediaAsset>;
    uploadMediaAsset(_body: GatewayMediaAssetUploadRequest, _idempotencyKey?: string): Promise<GatewayMediaAsset>;
    deleteMediaAsset(_assetId: string): Promise<GatewayMediaAssetDeleteResult>;
    getMediaAsset(_assetId: string, _init?: GatewayMediaAssetRequest): Promise<Blob>;
    getAudioAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getImageAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getVideoAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    getMusicAsset(assetId: string, init?: GatewayMediaAssetRequest): Promise<Blob>;
    private convertViaTts;
    private getRpcClient;
}
```

<a id="symbol-providers-openclaw-openclawmediaapiclientoptions"></a>

## OpenClawMediaApiClientOptions

Kind: type

```ts
export type OpenClawMediaApiClientOptions = HttpApiClientOptions & {
    /** Optional shared RPC transport (e.g. from an existing `OpenClawApiClient`). */
    rpcClient?: OpenClawRpcTransport | null;
    /** Explicit WebSocket URL when not derivable from `baseUrl`. */
    wsUrl?: string;
    rpcClientOptions?: OpenClawWebSocketClientOptions;
};
```

<a id="symbol-providers-openclaw-openclawrpctransport"></a>

## OpenClawRpcTransport

Kind: type

```ts
export type OpenClawRpcTransport = {
    request<TPayload>(method: string, params?: Record<string, unknown>): Promise<TPayload>;
};
```

<a id="symbol-providers-openclaw-openclawrunstatus"></a>

## OpenClawRunStatus

Kind: type

```ts
export type OpenClawRunStatus = GatewayRunStatus & {
    object?: "openclaw.run" | string;
};
```

<a id="symbol-providers-openclaw-openclawsseruneventprovider"></a>

## OpenClawSseRunEventProvider

Kind: class

```ts
export declare class OpenClawSseRunEventProvider extends GatewaySseRunEventProvider {
    constructor(options: OpenClawSseRunEventProviderOptions);
    subscribe(_params: RunEventStreamSubscribeParams, handlers: RunEventStreamHandlers): Promise<RunEventStreamSubscription>;
}
```

<a id="symbol-providers-openclaw-openclawsseruneventprovideroptions"></a>

## OpenClawSseRunEventProviderOptions

Kind: type

```ts
export type OpenClawSseRunEventProviderOptions = GatewaySseRunEventProviderOptions;
```

<a id="symbol-providers-openclaw-openclawwebsocketclient"></a>

## OpenClawWebSocketClient

Kind: class

```ts
export declare class OpenClawWebSocketClient extends GatewayWebSocketClient {
    constructor(wsUrl: string, authToken: string | null, options?: OpenClawWebSocketClientOptions);
}
```

<a id="symbol-providers-openclaw-openclawwebsocketclientoptions"></a>

## OpenClawWebSocketClientOptions

Kind: type

```ts
export type OpenClawWebSocketClientOptions = GatewayWebSocketClientOptions;
```

<a id="symbol-providers-openclaw-openclawwikiapiclient"></a>

## OpenClawWikiApiClient

Kind: class

```ts
export declare class OpenClawWikiApiClient extends GatewayWikiApiClient {
    constructor(options: HttpApiClientOptions);
    listWikiVaults(): Promise<GatewayWikiVaultList>;
    getWikiVault(_vaultId: string): Promise<GatewayWikiVault>;
    getWikiTree(_vaultId: string): Promise<GatewayWikiTree>;
    readWikiPage(_vaultId: string, _path: string): Promise<GatewayWikiPage>;
    ingestWiki(_vaultId: string, _body: GatewayWikiIngestRequest, _idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    compileWiki(_vaultId: string, _body: GatewayWikiCompileRequest, _idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    promoteWiki(_vaultId: string, _body: GatewayWikiPromoteRequest, _idempotencyKey?: string): Promise<GatewayWikiJobResult>;
    getWikiJob(_vaultId: string, _jobId: string): Promise<GatewayWikiJobResult>;
    getWikiArtifact(_vaultId: string, _artifactId: string, _init?: GatewayWikiArtifactRequest): Promise<Blob>;
}
```

<a id="symbol-providers-openclaw-openclawworkboardcard"></a>

## OpenClawWorkboardCard

Kind: type

```ts
export type OpenClawWorkboardCard = {
    id: string;
    title: string;
    notes?: string;
    status: OpenClawWorkboardStatus;
    priority: OpenClawWorkboardPriority;
    labels: string[];
    agentId?: string;
    boardId?: string;
    sessionKey?: string;
    runId?: string;
    taskId?: string;
    position: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
};
```

<a id="symbol-providers-openclaw-openclawworkboardpriority"></a>

## OpenClawWorkboardPriority

Kind: type

```ts
export type OpenClawWorkboardPriority = (typeof OPENCLAW_WORKBOARD_PRIORITIES)[number];
```

<a id="symbol-providers-openclaw-openclawworkboardrpc"></a>

## OpenClawWorkboardRpc

Kind: type

```ts
export type OpenClawWorkboardRpc = {
    request<TPayload>(method: string, params?: Record<string, unknown>): Promise<TPayload>;
    listCards(params?: {
        boardId?: string;
    }): Promise<{
        cards: OpenClawWorkboardCard[];
        statuses?: readonly OpenClawWorkboardStatus[];
    }>;
    createCard(params: Record<string, unknown>): Promise<{
        card: OpenClawWorkboardCard;
    }>;
    updateCard(id: string, patch: Record<string, unknown>): Promise<{
        card: OpenClawWorkboardCard;
    }>;
    moveCard(id: string, status: OpenClawWorkboardStatus, position?: number): Promise<{
        card: OpenClawWorkboardCard;
    }>;
    dispatch(params?: Record<string, unknown>): Promise<Record<string, unknown>>;
};
```

<a id="symbol-providers-openclaw-openclawworkboardstatus"></a>

## OpenClawWorkboardStatus

Kind: type

```ts
export type OpenClawWorkboardStatus = (typeof OPENCLAW_WORKBOARD_STATUSES)[number];
```

<a id="symbol-providers-openclaw-team-registry-config"></a>

## TEAM_REGISTRY_CONFIG

Kind: variable

```ts
export declare const TEAM_REGISTRY_CONFIG: TeamRegistryConfig;
```

<a id="symbol-providers-openclaw-teamregistryconfig"></a>

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
