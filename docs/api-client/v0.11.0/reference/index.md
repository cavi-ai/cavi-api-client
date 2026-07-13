# @cavi-ai/api-client

Package subpath: .

<a id="symbol-root-agentrun"></a>

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

<a id="symbol-root-agentrundetailsnapshot"></a>

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

<a id="symbol-root-apiclienterror"></a>

## ApiClientError

Kind: class

```ts
export declare class ApiClientError extends Error {
    readonly type: ApiClientErrorType | string;
    readonly code: ApiClientErrorCode | string;
    readonly runtime?: RuntimeErrorMetadata;
    constructor(message: string, options?: ApiClientErrorOptions);
}
```

<a id="symbol-root-apiclienterrorcode"></a>

## ApiClientErrorCode

Kind: enum

```ts
export declare enum ApiClientErrorCode {
    Unknown = "unknown",
    ValidationFailed = "validation_failed",
    InvalidConfig = "invalid_config",
    InvalidJson = "invalid_json",
    HttpRequestFailed = "http_request_failed",
    GatewayError = "gateway_error",
    RequestFailed = "request_failed",
    Timeout = "timeout",
    Aborted = "aborted",
    SocketError = "socket_error",
    SocketClosed = "socket_closed",
    SocketUnavailable = "socket_unavailable",
    ConnectFailed = "connect_failed",
    BackendUnavailable = "backend_unavailable",
    EndpointNotFound = "endpoint_not_found",
    ProtocolMismatch = "protocol_mismatch",
    AuthRequired = "auth_required",
    AuthForbidden = "auth_forbidden",
    CapabilityUnavailable = "capability_unavailable",
    PermissionDenied = "permission_denied",
    InvalidRequest = "invalid_request",
    Conflict = "conflict",
    RateLimited = "rate_limited",
    TransportUnavailable = "transport_unavailable",
    TransportProtocolError = "transport_protocol_error",
    ServerOverloaded = "server_overloaded"
}
```

<a id="symbol-root-apiclienterroroptions"></a>

## ApiClientErrorOptions

Kind: type

```ts
export type ApiClientErrorOptions = {
    type?: ApiClientErrorType | string;
    code?: ApiClientErrorCode | string;
    cause?: unknown;
    runtime?: RuntimeErrorMetadata;
};
```

<a id="symbol-root-apiclienterrortype"></a>

## ApiClientErrorType

Kind: enum

```ts
export declare enum ApiClientErrorType {
    Unknown = "unknown",
    Validation = "validation",
    Configuration = "configuration",
    Http = "http",
    GatewayHttp = "gateway_http",
    GatewayRpc = "gateway_rpc",
    Transport = "transport",
    Timeout = "timeout",
    Abort = "abort",
    BackendUnavailable = "backend_unavailable",
    Auth = "auth"
}
```

<a id="symbol-root-apikeycredentialoptions"></a>

## ApiKeyCredentialOptions

Kind: type

```ts
export type ApiKeyCredentialOptions = {
    /** Header name for the key. Defaults to "Authorization". */
    header?: string;
    /** Extra static headers (e.g. { "anthropic-version": "2023-06-01" }). */
    extra?: Record<string, string>;
};
```

<a id="symbol-root-apikeycredentials"></a>

## apiKeyCredentials

Kind: function

```ts
/** API-key scheme (e.g. Anthropic: header "x-api-key" + "anthropic-version"). */
export declare function apiKeyCredentials(key: string, options?: ApiKeyCredentialOptions): CredentialResolver;
```

<a id="symbol-root-appendhttpquery"></a>

## appendHttpQuery

Kind: function

```ts
export declare function appendHttpQuery(path: string, query?: Record<string, string | number | boolean | undefined>): string;
```

<a id="symbol-root-assertprotocolversion"></a>

## assertProtocolVersion

Kind: function

```ts
/** Throw a typed ProtocolMismatch error when the reported version is not `expected`. */
export declare function assertProtocolVersion(carrier: ProtocolVersionCarrier, expected: string): void;
```

<a id="symbol-root-assertsaferelativepath"></a>

## assertSafeRelativePath

Kind: function

```ts
/**
 * Validate and normalize a caller-supplied **relative** path, returning the
 * cleaned `a/b/c` form or throwing on anything unsafe.
 *
 * This is the **opt-in** companion to the manifest workspace whitelist
 * (`resolveTeamWorkspacePath`). The whitelist is the primary, recommended guard:
 * a path the consumer never declared can never be resolved. Reach for this only
 * when a downstream surface must accept a *free-form* relative path — e.g. a raw
 * `?path=` value a consumer wants to hand to a workspace/wiki file endpoint
 * (`GATEWAY_WIKI_API_ENDPOINTS.read`, a manifest action `query`).
 *
 * `appendHttpQuery` does **not** sanitize values — it only URL-encodes them, so
 * `?path=../secret` becomes `?path=..%2Fsecret` and the backend decodes it back.
 * Run untrusted path values through this first, then pass the result as a query
 * value via `appendHttpQuery` (which encodes it).
 *
 * Rejects: empty/whitespace, absolute (`/…`), protocol-relative (`//…`), URL
 * schemes (`file:`, `http:`…), backslashes, and any `.`/`..` segment — including
 * percent-encoded forms such as `%2e%2e`. Interior `./` and duplicate slashes
 * are collapsed. The return value is **not** URL-encoded.
 *
 * This intentionally mirrors the relative-path rules the team manifest enforces
 * internally for workspace whitelist entries (`src/contracts/team-manifest.ts`).
 * Both are guarded by `safe-relative-path.test.ts`; keep them in lockstep.
 */
export declare function assertSafeRelativePath(value: string): string;
```

<a id="symbol-root-authstatusclient"></a>

## AuthStatusClient

Kind: interface

```ts
export interface AuthStatusClient {
    listAuthStatus(): Promise<readonly RuntimeAuthStatus[]>;
}
```

<a id="symbol-root-bearercredentials"></a>

## bearerCredentials

Kind: function

```ts
/** Standard bearer scheme. Emits nothing when the token is empty. */
export declare function bearerCredentials(token: string | null | undefined): CredentialResolver;
```

<a id="symbol-root-builddryrunstatus"></a>

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

<a id="symbol-root-builddryrunstreamevent"></a>

## buildDryRunStreamEvent

Kind: function

```ts
/** Build the single terminal stream event a dryRun streamRun() emits (A3). */
export declare function buildDryRunStreamEvent(model?: string): RunStreamRunCompletedEvent;
```

<a id="symbol-root-buildgatewayhttperror"></a>

## buildGatewayHttpError

Kind: function

```ts
export declare function buildGatewayHttpError(params: {
    label: string;
    status: number;
    statusText: string;
    message?: string | null;
    code?: string | null;
}): GatewayHttpError;
```

<a id="symbol-root-cachedteammanifestsource"></a>

## CachedTeamManifestSource

Kind: interface

```ts
export interface CachedTeamManifestSource extends TeamManifestSource {
    /** Re-run the loader and replace the cached manifest. */
    refresh(): Promise<TeamManifest>;
}
```

<a id="symbol-root-checkprotocolversion"></a>

## checkProtocolVersion

Kind: function

```ts
/** Compare a provider's reported protocol version against the expected one. */
export declare function checkProtocolVersion(carrier: ProtocolVersionCarrier, expected: string): ProtocolVersionCheck;
```

<a id="symbol-root-classifyfallbackerror"></a>

## classifyFallbackError

Kind: function

```ts
export declare function classifyFallbackError(error: unknown): {
    message: string;
    reason: ContractGapReason;
    httpStatus?: number;
};
```

<a id="symbol-root-composeruneventproviders"></a>

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

<a id="symbol-root-connectivitydomain"></a>

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

<a id="symbol-root-connectivitystatus"></a>

## ConnectivityStatus

Kind: type

```ts
export type ConnectivityStatus = "live" | "empty-but-valid" | "mock-fallback" | "conditional-unavailable" | "not-loaded";
```

<a id="symbol-root-contractgap"></a>

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

<a id="symbol-root-contractgapreason"></a>

## ContractGapReason

Kind: type

```ts
export type ContractGapReason = "backend-unavailable" | "backend-not-configured" | "endpoint-not-found" | "auth-insufficient" | "transport-disconnected" | "unknown";
```

<a id="symbol-root-createcachedmanifestsource"></a>

## createCachedManifestSource

Kind: function

```ts
/**
 * A manifest fetched via a loader (e.g. from a gateway). Cached after first
 * load; call refresh() to revalidate.
 */
export declare function createCachedManifestSource(loader: TeamManifestLoader): CachedTeamManifestSource;
```

<a id="symbol-root-createdefaultteammanifest"></a>

## createDefaultTeamManifest

Kind: function

```ts
export declare function createDefaultTeamManifest(options?: CreateDefaultTeamManifestOptions): TeamManifest;
```

<a id="symbol-root-createdefaultteammanifestoptions"></a>

## CreateDefaultTeamManifestOptions

Kind: type

```ts
export type CreateDefaultTeamManifestOptions = {
    teamId?: string;
    memberId?: string;
    workspaceRootPath?: string | null;
    workspacePaths?: readonly TeamWorkspacePathEntry[] | null;
};
```

<a id="symbol-root-creategatewayagentconfigclient"></a>

## createGatewayAgentConfigClient

Kind: function

```ts
export declare function createGatewayAgentConfigClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayAgentConfigApiClient;
```

<a id="symbol-root-creategatewayapiclient"></a>

## createGatewayApiClient

Kind: function

```ts
export declare function createGatewayApiClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayApiClient;
```

<a id="symbol-root-creategatewaymediaclient"></a>

## createGatewayMediaClient

Kind: function

```ts
export declare function createGatewayMediaClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayMediaApiClient;
```

<a id="symbol-root-creategatewayproviderregistry"></a>

## createGatewayProviderRegistry

Kind: function

```ts
export declare function createGatewayProviderRegistry(options?: CreateGatewayProviderRegistryOptions): GatewayProviderRegistry;
```

<a id="symbol-root-creategatewayproviderregistryoptions"></a>

## CreateGatewayProviderRegistryOptions

Kind: type

```ts
export type CreateGatewayProviderRegistryOptions = CreateProviderRegistryOptions<GatewayProviderModule>;
```

<a id="symbol-root-creategatewayrpcclient"></a>

## createGatewayRpcClient

Kind: variable

```ts
export declare const createGatewayRpcClient: typeof createGatewayWebSocketClient;
```

<a id="symbol-root-creategatewaysseruneventprovider"></a>

## createGatewaySseRunEventProvider

Kind: function

```ts
export declare function createGatewaySseRunEventProvider(options: CreateGatewaySseRunEventProviderOptions, providerOptions?: ResolveGatewayProviderOptions): GatewaySseRunEventProvider;
```

<a id="symbol-root-creategatewaysseruneventprovideroptions"></a>

## CreateGatewaySseRunEventProviderOptions

Kind: type

```ts
export type CreateGatewaySseRunEventProviderOptions = GatewaySseRunEventProviderOptions & {
    sessionKey?: string;
};
```

<a id="symbol-root-creategatewaywebsocketclient"></a>

## createGatewayWebSocketClient

Kind: function

```ts
export declare function createGatewayWebSocketClient(wsUrl: string, authToken: string | null, clientOptions?: GatewayWebSocketClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayWebSocketClient;
```

<a id="symbol-root-creategatewaywikiclient"></a>

## createGatewayWikiClient

Kind: function

```ts
export declare function createGatewayWikiClient(clientOptions: HttpApiClientOptions, providerOptions?: ResolveGatewayProviderOptions): GatewayWikiApiClient;
```

<a id="symbol-root-createproviderregistry"></a>

## createProviderRegistry

Kind: function

```ts
export declare function createProviderRegistry<M extends RuntimeProviderModule>(options?: CreateProviderRegistryOptions<M>): ProviderRegistry<M>;
```

<a id="symbol-root-createproviderregistryoptions"></a>

## CreateProviderRegistryOptions

Kind: type

```ts
export type CreateProviderRegistryOptions<M extends RuntimeProviderModule = GatewayProviderModule> = CreateRuntimeProviderRegistryOptions<M>;
```

<a id="symbol-root-createrunstreamwithtoolfallback"></a>

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

<a id="symbol-root-createrunstreamwithtoolfallbackoptions"></a>

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

<a id="symbol-root-createruntimeclient"></a>

## createRuntimeClient

Kind: function

```ts
export declare function createRuntimeClient(provider: string, options: CreateRuntimeClientOptions): RuntimeClient;
```

<a id="symbol-root-createruntimeclientoptions"></a>

## CreateRuntimeClientOptions

Kind: type

```ts
export type CreateRuntimeClientOptions = {
    registry: RuntimeProviderRegistry;
    clientOptions: RuntimeClientOptions;
};
```

<a id="symbol-root-createruntimeproviderregistry"></a>

## createRuntimeProviderRegistry

Kind: function

```ts
export declare function createRuntimeProviderRegistry(options?: CreateProviderRegistryOptions<RuntimeProviderModule>): ProviderRegistry<RuntimeProviderModule>;
```

<a id="symbol-root-createstaticmanifestsource"></a>

## createStaticManifestSource

Kind: function

```ts
/** A fixed, host-provided manifest. Normalized once. */
export declare function createStaticManifestSource(manifest: TeamManifestInput): TeamManifestSource;
```

<a id="symbol-root-createsurfacepathresolver"></a>

## createSurfacePathResolver

Kind: function

```ts
export declare function createSurfacePathResolver(extensionContracts?: SurfaceContractMap, baseResolver?: SurfacePathResolver): SurfacePathResolver;
```

<a id="symbol-root-createteamrouteresolver"></a>

## createTeamRouteResolver

Kind: function

```ts
export declare function createTeamRouteResolver(): TeamRouteResolver;
```

<a id="symbol-root-credentialheaders"></a>

## CredentialHeaders

Kind: type

```ts
/** Auth headers a credential resolver contributes to a request. */
export type CredentialHeaders = Record<string, string>;
```

<a id="symbol-root-credentialresolver"></a>

## CredentialResolver

Kind: type

```ts
/**
 * Provider-supplied auth scheme. Returns the headers to merge onto a request.
 * Closes over whatever secret the provider needs (token, api key, cookie).
 */
export type CredentialResolver = () => CredentialHeaders;
```

<a id="symbol-root-dataenvelope"></a>

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

<a id="symbol-root-datasourcemode"></a>

## DataSourceMode

Kind: type

```ts
export type DataSourceMode = "gateway" | "mock";
```

<a id="symbol-root-default-team-id"></a>

## DEFAULT_TEAM_ID

Kind: variable

```ts
export declare const DEFAULT_TEAM_ID: "default";
```

<a id="symbol-root-default-team-member-id"></a>

## DEFAULT_TEAM_MEMBER_ID

Kind: variable

```ts
export declare const DEFAULT_TEAM_MEMBER_ID: "default-agent";
```

<a id="symbol-root-default-team-route-keys"></a>

## DEFAULT_TEAM_ROUTE_KEYS

Kind: variable

```ts
export declare const DEFAULT_TEAM_ROUTE_KEYS: readonly [
    "kanban",
    "runs",
    "config",
    "workspace"
];
```

<a id="symbol-root-defaultteamroutekey"></a>

## DefaultTeamRouteKey

Kind: type

```ts
export type DefaultTeamRouteKey = (typeof DEFAULT_TEAM_ROUTE_KEYS)[number];
```

<a id="symbol-root-estimateusagecost"></a>

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

<a id="symbol-root-fallbackgap"></a>

## fallbackGap

Kind: function

```ts
export declare function fallbackGap(area: string, expectedContract: string, note: string, reason?: ContractGapReason, httpStatus?: number): ContractGap;
```

<a id="symbol-root-fallbackresolveinfo"></a>

## FallbackResolveInfo

Kind: type

```ts
export type FallbackResolveInfo = {
    source: "gateway" | "mock";
    fellBack: boolean;
    area: string;
};
```

<a id="symbol-root-findteamactioncontract"></a>

## findTeamActionContract

Kind: function

```ts
export declare function findTeamActionContract(actions: readonly TeamActionContract[] | null | undefined, actionId: string | null | undefined): TeamActionContract | null;
```

<a id="symbol-root-findteammanifestmember"></a>

## findTeamManifestMember

Kind: function

```ts
export declare function findTeamManifestMember(team: ManifestTeam, memberId: string | null | undefined): ManifestMember | null;
```

<a id="symbol-root-findteammanifestteam"></a>

## findTeamManifestTeam

Kind: function

```ts
export declare function findTeamManifestTeam(manifest: TeamManifest, teamId: string | null | undefined): ManifestTeam | null;
```

<a id="symbol-root-gateway-api-endpoint-templates"></a>

## GATEWAY_API_ENDPOINT_TEMPLATES

Kind: variable

```ts
export declare const GATEWAY_API_ENDPOINT_TEMPLATES: {
    readonly ecgSharedFiles: "/api/v1/files?agent={agent}&folder={folder}";
    readonly runApproval: "/v1/runs/{run_id}/approval";
};
```

<a id="symbol-root-gateway-api-endpoints"></a>

## GATEWAY_API_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_API_ENDPOINTS: {
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
```

<a id="symbol-root-gateway-media-api-base-path"></a>

## GATEWAY_MEDIA_API_BASE_PATH

Kind: variable

```ts
export declare const GATEWAY_MEDIA_API_BASE_PATH: "/v1/media";
```

<a id="symbol-root-gateway-media-api-endpoints"></a>

## GATEWAY_MEDIA_API_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_MEDIA_API_ENDPOINTS: {
    readonly root: "/v1/media";
    readonly providers: (kind?: string | null) => string;
    readonly generate: (kind: string) => string;
    readonly job: (kind: string, jobId: string) => string;
    readonly assets: (query?: {
        kind?: string | null;
        cursor?: string | null;
        limit?: number | null;
    } | null) => string;
    readonly asset: (assetId: string) => string;
};
```

<a id="symbol-root-gateway-probe-endpoints"></a>

## GATEWAY_PROBE_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_PROBE_ENDPOINTS: {
    readonly health: "/health";
    readonly healthz: "/healthz";
    readonly readyz: "/readyz";
};
```

<a id="symbol-root-gateway-provider-env-keys"></a>

## GATEWAY_PROVIDER_ENV_KEYS

Kind: variable

```ts
export declare const GATEWAY_PROVIDER_ENV_KEYS: readonly [
    "CAVI_GATEWAY_PROVIDER",
    "GATEWAY_PROVIDER"
];
```

<a id="symbol-root-gateway-system-rpc-methods"></a>

## GATEWAY_SYSTEM_RPC_METHODS

Kind: variable

```ts
export declare const GATEWAY_SYSTEM_RPC_METHODS: {
    readonly healthSnapshot: "health.snapshot";
    readonly health: "health";
    readonly logsTail: "logs.tail";
};
```

<a id="symbol-root-gateway-wiki-api-base-path"></a>

## GATEWAY_WIKI_API_BASE_PATH

Kind: variable

```ts
export declare const GATEWAY_WIKI_API_BASE_PATH: "/v1/wiki";
```

<a id="symbol-root-gateway-wiki-api-endpoints"></a>

## GATEWAY_WIKI_API_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_WIKI_API_ENDPOINTS: {
    readonly root: "/v1/wiki";
    readonly vaults: "/v1/wiki/vaults";
    readonly vault: (vaultId: string) => string;
    readonly tree: (vaultId: string) => string;
    readonly read: (vaultId: string, path: string) => string;
    readonly ingest: (vaultId: string) => string;
    readonly compile: (vaultId: string) => string;
    readonly promote: (vaultId: string) => string;
    readonly job: (vaultId: string, jobId: string) => string;
    readonly artifact: (vaultId: string, artifactId: string) => string;
};
```

<a id="symbol-root-gatewayapiclient"></a>

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

<a id="symbol-root-gatewaycapabilities"></a>

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

<a id="symbol-root-gatewayhttperror"></a>

## GatewayHttpError

Kind: class

```ts
export declare class GatewayHttpError extends Error {
    readonly type = ApiClientErrorType.GatewayHttp;
    readonly status: number;
    readonly code: string | null;
    constructor(message: string, status: number, code?: string | null);
}
```

<a id="symbol-root-gatewayproviderenv"></a>

## GatewayProviderEnv

Kind: type

```ts
export type GatewayProviderEnv = Record<string, string | undefined>;
```

<a id="symbol-root-gatewayproviderfactories"></a>

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

<a id="symbol-root-gatewayproviderkind"></a>

## GatewayProviderKind

Kind: type

```ts
export type GatewayProviderKind = "hermes" | "openclaw" | (string & {});
```

<a id="symbol-root-gatewayprovidermodule"></a>

## GatewayProviderModule

Kind: interface

```ts
export interface GatewayProviderModule extends RuntimeProviderModule, GatewayProviderFactories {
    /** Gateway providers return the gateway-capable client. */
    createApiClient?: (clientOptions: HttpApiClientOptions) => GatewayApiClient;
}
```

<a id="symbol-root-gatewayproviderregistry"></a>

## GatewayProviderRegistry

Kind: type

```ts
export type GatewayProviderRegistry = ProviderRegistry<GatewayProviderModule>;
```

<a id="symbol-root-gatewayresolvedroutebinding"></a>

## GatewayResolvedRouteBinding

Kind: type

```ts
export type GatewayResolvedRouteBinding = {
    id: string;
    teamId: string;
    memberId: string | null;
    source: string | null;
    channel: string | null;
    actionId: string | null;
    routeKey: TeamRouteKey;
    path: string;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-gatewayroutebinding"></a>

## GatewayRouteBinding

Kind: type

```ts
export type GatewayRouteBinding = {
    id: string;
    teamId: string;
    memberId?: string | null;
    source?: string | null;
    channel?: string | null;
    actionId?: string | null;
    routeKey?: TeamRouteKey | null;
    sessionKeyPattern?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-gatewayrunattachment"></a>

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

<a id="symbol-root-gatewayrunmessage"></a>

## GatewayRunMessage

Kind: type

```ts
export type GatewayRunMessage = RuntimeRunMessage;
```

<a id="symbol-root-gatewayrunstartbody"></a>

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

<a id="symbol-root-gatewayrunstatus"></a>

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

<a id="symbol-root-getbrowserwindoworigin"></a>

## getBrowserWindowOrigin

Kind: function

```ts
export declare function getBrowserWindowOrigin(): string | null;
```

<a id="symbol-root-geterrorcode"></a>

## getErrorCode

Kind: function

```ts
export declare function getErrorCode(error: unknown): string | undefined;
```

<a id="symbol-root-geterrormessage"></a>

## getErrorMessage

Kind: function

```ts
export declare function getErrorMessage(error: unknown, fallbackMessage?: string): string;
```

<a id="symbol-root-geterrorstatus"></a>

## getErrorStatus

Kind: function

```ts
/**
 * HTTP status carried by a typed transport error (`HttpApiError`,
 * `GatewayHttpError`, or any error exposing a numeric `status`). `undefined`
 * for non-HTTP failures (transport, abort, RPC) so callers branch on the value,
 * never on the message string.
 */
export declare function getErrorStatus(error: unknown): number | undefined;
```

<a id="symbol-root-geterrortype"></a>

## getErrorType

Kind: function

```ts
export declare function getErrorType(error: unknown): string | undefined;
```

<a id="symbol-root-getruntimeerrormetadata"></a>

## getRuntimeErrorMetadata

Kind: function

```ts
export declare function getRuntimeErrorMetadata(error: unknown): RuntimeErrorMetadata | undefined;
```

<a id="symbol-root-getruntimeprovidercapabilityrow"></a>

## getRuntimeProviderCapabilityRow

Kind: function

```ts
export declare function getRuntimeProviderCapabilityRow(provider: string): RuntimeProviderCapabilityRow | undefined;
```

<a id="symbol-root-global-repo-root-key"></a>

## GLOBAL_REPO_ROOT_KEY

Kind: variable

```ts
export declare const GLOBAL_REPO_ROOT_KEY: "__CAVI_REPO_ROOT__";
```

<a id="symbol-root-hermes-api-endpoint-templates"></a>

## HERMES_API_ENDPOINT_TEMPLATES

Kind: variable

```ts
export declare const HERMES_API_ENDPOINT_TEMPLATES: {
    readonly ecgSharedFiles: "/api/v1/files?agent={agent}&folder={folder}";
    readonly runApproval: "/v1/runs/{run_id}/approval";
};
```

<a id="symbol-root-hermes-api-endpoints"></a>

## HERMES_API_ENDPOINTS

Kind: variable

```ts
export declare const HERMES_API_ENDPOINTS: {
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
```

<a id="symbol-root-hermes-media-api-endpoints"></a>

## HERMES_MEDIA_API_ENDPOINTS

Kind: variable

```ts
export declare const HERMES_MEDIA_API_ENDPOINTS: {
    readonly root: "/v1/media";
    readonly providers: (kind?: string | null) => string;
    readonly generate: (kind: string) => string;
    readonly job: (kind: string, jobId: string) => string;
    readonly assets: (query?: {
        kind?: string | null;
        cursor?: string | null;
        limit?: number | null;
    } | null) => string;
    readonly asset: (assetId: string) => string;
};
```

<a id="symbol-root-hermes-wiki-api-endpoints"></a>

## HERMES_WIKI_API_ENDPOINTS

Kind: variable

```ts
export declare const HERMES_WIKI_API_ENDPOINTS: {
    readonly root: "/v1/wiki";
    readonly vaults: "/v1/wiki/vaults";
    readonly vault: (vaultId: string) => string;
    readonly tree: (vaultId: string) => string;
    readonly read: (vaultId: string, path: string) => string;
    readonly ingest: (vaultId: string) => string;
    readonly compile: (vaultId: string) => string;
    readonly promote: (vaultId: string) => string;
    readonly job: (vaultId: string, jobId: string) => string;
    readonly artifact: (vaultId: string, artifactId: string) => string;
};
```

<a id="symbol-root-httpapiclientauth"></a>

## HttpApiClientAuth

Kind: type

```ts
export type HttpApiClientAuth = {
    bearerToken?: string | null;
    clientId?: string | null;
    /**
     * Provider-supplied auth scheme. When present, its headers replace the
     * default bearer Authorization header. See core/http/credentials.ts.
     */
    resolveHeaders?: CredentialResolver;
};
```

<a id="symbol-root-httpapiclientoptions"></a>

## HttpApiClientOptions

Kind: type

```ts
export type HttpApiClientOptions = {
    baseUrl: string;
    basePath?: string;
    allowRelativeBaseUrl?: boolean;
    defaultHeaders?: Record<string, string>;
    /** Send the X-Portal-Client-Id header. Default true; set false for non-gateway backends. */
    includePortalClientIdHeader?: boolean;
    auth?: HttpApiClientAuth;
    defaultTimeoutMs?: number;
    fetchImpl?: typeof fetch;
    cache?: RequestCache;
    credentials?: RequestCredentials;
    onTrace?: (trace: HttpApiTrace) => void;
};
```

<a id="symbol-root-httpapiclientsurface"></a>

## HttpApiClientSurface

Kind: type

```ts
export type HttpApiClientSurface = string;
```

<a id="symbol-root-httpapierror"></a>

## HttpApiError

Kind: class

```ts
export declare class HttpApiError extends Error {
    readonly type = ApiClientErrorType.Http;
    readonly code = ApiClientErrorCode.HttpRequestFailed;
    readonly path: string;
    readonly url: string;
    readonly method: HttpApiHttpMethod;
    readonly status: number;
    readonly body: string;
    constructor(params: {
        message: string;
        path: string;
        url: string;
        method: HttpApiHttpMethod;
        status: number;
        body: string;
    });
}
```

<a id="symbol-root-httpapihttpmethod"></a>

## HttpApiHttpMethod

Kind: type

```ts
export type HttpApiHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
```

<a id="symbol-root-httpapirequestinit"></a>

## HttpApiRequestInit

Kind: type

```ts
export type HttpApiRequestInit = {
    method?: HttpApiHttpMethod;
    body?: unknown;
    rawBody?: BodyInit;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    idempotencyKey?: string;
    cache?: RequestCache;
    credentials?: RequestCredentials;
};
```

<a id="symbol-root-httpapitrace"></a>

## HttpApiTrace

Kind: type

```ts
export type HttpApiTrace = {
    at: number;
    surface: HttpApiClientSurface;
    method: HttpApiHttpMethod;
    path: string;
    url: string;
    ok: boolean;
    status?: number;
    durationMs: number;
    error?: string;
};
```

<a id="symbol-root-httpapitransport"></a>

## HttpApiTransport

Kind: type

```ts
export type HttpApiTransport = <TResponse>(path: string, init?: HttpApiRequestInit) => Promise<TResponse>;
```

<a id="symbol-root-idempotency-key-header"></a>

## IDEMPOTENCY_KEY_HEADER

Kind: variable

```ts
export declare const IDEMPOTENCY_KEY_HEADER: "Idempotency-Key";
```

<a id="symbol-root-inspectruntimeeventsequence"></a>

## inspectRuntimeEventSequence

Kind: function

```ts
export declare function inspectRuntimeEventSequence(events: readonly RuntimeControlPlaneEvent[]): RuntimeEventSequenceInspection;
```

<a id="symbol-root-isaborterror"></a>

## isAbortError

Kind: function

```ts
export declare function isAbortError(error: unknown): boolean;
```

<a id="symbol-root-isautherror"></a>

## isAuthError

Kind: function

```ts
/**
 * True when an error is an authentication/authorization failure (HTTP 401/403,
 * or a synthesized `Auth`-typed/`auth_required`/`auth_forbidden` error). Use
 * this to trigger token refresh or re-auth instead of inspecting `.status`
 * inline at every call site.
 */
export declare function isAuthError(error: unknown): boolean;
```

<a id="symbol-root-isendpointnotfounderror"></a>

## isEndpointNotFoundError

Kind: function

```ts
/**
 * True when an error is a synthesized `EndpointNotFound` failure — the
 * everyday cross-provider branch for a surface a provider declares
 * unsupported (Gemini `getRun`/`cancelRun`, OpenClaw wiki/media).
 */
export declare function isEndpointNotFoundError(error: unknown): boolean;
```

<a id="symbol-root-isgatewayhttperror"></a>

## isGatewayHttpError

Kind: function

```ts
export declare function isGatewayHttpError(error: unknown): error is GatewayHttpError;
```

<a id="symbol-root-ishttpapierror"></a>

## isHttpApiError

Kind: function

```ts
export declare function isHttpApiError(error: unknown): error is HttpApiError;
```

<a id="symbol-root-manifestidentity"></a>

## ManifestIdentity

Kind: type

```ts
export type ManifestIdentity = {
    name?: string | null;
    displayName?: string | null;
    slug?: string | null;
    code?: string | null;
    aliases?: readonly string[] | null;
    /** Host/domain-specific identity hints (e.g. CAVI portalId/sector). Agnostic core never reads these. */
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-manifestmember"></a>

## ManifestMember

Kind: type

```ts
export type ManifestMember = {
    id: string;
    identity?: ManifestIdentity | null;
    workspace?: TeamWorkspaceConfig | null;
    actions?: readonly TeamActionContract[] | null;
    capabilities?: readonly string[] | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-manifestrouteconfig"></a>

## ManifestRouteConfig

Kind: type

```ts
export type ManifestRouteConfig = {
    key: string;
    path?: string | null;
};
```

<a id="symbol-root-manifestteam"></a>

## ManifestTeam

Kind: type

```ts
export type ManifestTeam = {
    id: string;
    identity?: ManifestIdentity | null;
    members?: readonly ManifestMember[] | null;
    workspace?: TeamWorkspaceConfig | null;
    actions?: readonly TeamActionContract[] | null;
    capabilities?: readonly string[] | null;
    routes?: readonly ManifestRouteConfig[] | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-modelcatalogclient"></a>

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

<a id="symbol-root-mutationresult"></a>

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

<a id="symbol-root-normalizegatewayprovidertoken"></a>

## normalizeGatewayProviderToken

Kind: function

```ts
export declare function normalizeGatewayProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-root-normalizeruntimebasepath"></a>

## normalizeRuntimeBasePath

Kind: function

```ts
export declare function normalizeRuntimeBasePath(rawBasePath: string | null | undefined): string;
```

<a id="symbol-root-normalizeruntimeprovidertoken"></a>

## normalizeRuntimeProviderToken

Kind: function

```ts
export declare function normalizeRuntimeProviderToken(value: string | null | undefined): string | null;
```

<a id="symbol-root-normalizeruntimeusage"></a>

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

<a id="symbol-root-normalizeteammanifest"></a>

## normalizeTeamManifest

Kind: function

```ts
export declare function normalizeTeamManifest(manifest: Partial<TeamManifest> | null | undefined): TeamManifest;
```

<a id="symbol-root-portal-client-id-header"></a>

## PORTAL_CLIENT_ID_HEADER

Kind: variable

```ts
export declare const PORTAL_CLIENT_ID_HEADER: "X-Portal-Client-Id";
```

<a id="symbol-root-protocolversioncarrier"></a>

## ProtocolVersionCarrier

Kind: type

```ts
export type ProtocolVersionCarrier = {
    protocolVersion?: string | null;
};
```

<a id="symbol-root-protocolversioncheck"></a>

## ProtocolVersionCheck

Kind: type

```ts
export type ProtocolVersionCheck = {
    ok: boolean;
    expected: string;
    actual: string | null;
};
```

<a id="symbol-root-providerregistry"></a>

## ProviderRegistry

Kind: type

```ts
export type ProviderRegistry<M extends RuntimeProviderModule = GatewayProviderModule> = RuntimeProviderRegistry<M>;
```

<a id="symbol-root-repo-root-env-key"></a>

## REPO_ROOT_ENV_KEY

Kind: variable

```ts
export declare const REPO_ROOT_ENV_KEY: "REPO_ROOT";
```

<a id="symbol-root-reporootenv"></a>

## RepoRootEnv

Kind: type

```ts
export type RepoRootEnv = Record<string, string | undefined>;
```

<a id="symbol-root-requirereporoot"></a>

## requireRepoRoot

Kind: function

```ts
export declare function requireRepoRoot(options?: ResolveRepoRootOptions): string;
```

<a id="symbol-root-resolvegatewayproviderkind"></a>

## resolveGatewayProviderKind

Kind: function

```ts
export declare function resolveGatewayProviderKind(options?: ResolveGatewayProviderOptions): GatewayProviderKind;
```

<a id="symbol-root-resolvegatewayprovidermodule"></a>

## resolveGatewayProviderModule

Kind: function

```ts
export declare function resolveGatewayProviderModule(options?: ResolveGatewayProviderOptions): GatewayProviderModule | null;
```

<a id="symbol-root-resolvegatewayprovideroptions"></a>

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

<a id="symbol-root-resolvegatewayroutebinding"></a>

## resolveGatewayRouteBinding

Kind: function

```ts
export declare function resolveGatewayRouteBinding(manifest: TeamManifest, options: ResolveGatewayRouteBindingOptions): GatewayResolvedRouteBinding | null;
```

<a id="symbol-root-resolvegatewayroutebindingoptions"></a>

## ResolveGatewayRouteBindingOptions

Kind: type

```ts
export type ResolveGatewayRouteBindingOptions = {
    bindingId?: string | null;
    source?: string | null;
    channel?: string | null;
    sessionKey?: string | null;
    key?: string | null;
    agentId?: string | null;
    actionId?: string | null;
};
```

<a id="symbol-root-resolvepath"></a>

## resolvePath

Kind: function

```ts
export declare function resolvePath(key: string, params?: Record<string, string>): string;
```

<a id="symbol-root-resolvepublicruntimeasset"></a>

## resolvePublicRuntimeAsset

Kind: function

```ts
export declare function resolvePublicRuntimeAsset(pathname: string, rawBasePath: string | null | undefined): string;
```

<a id="symbol-root-resolvereporoot"></a>

## resolveRepoRoot

Kind: function

```ts
export declare function resolveRepoRoot(options?: ResolveRepoRootOptions): string | null;
```

<a id="symbol-root-resolvereporootoptions"></a>

## ResolveRepoRootOptions

Kind: type

```ts
export type ResolveRepoRootOptions = {
    repoRoot?: string | null;
    env?: RepoRootEnv;
    globalRepoRoot?: string | null;
};
```

<a id="symbol-root-resolvesurfacecontractpath"></a>

## resolveSurfaceContractPath

Kind: function

```ts
export declare function resolveSurfaceContractPath(contract: SurfaceContract, params?: Record<string, string>): string;
```

<a id="symbol-root-resolveteamactionapipath"></a>

## resolveTeamActionApiPath

Kind: function

```ts
export declare function resolveTeamActionApiPath(manifest: TeamManifest, teamId: string | null | undefined, actionId: string | null | undefined, options?: ResolveTeamActionContractOptions): string;
```

<a id="symbol-root-resolveteamactioncontract"></a>

## resolveTeamActionContract

Kind: function

```ts
export declare function resolveTeamActionContract(manifest: TeamManifest, teamId: string | null | undefined, actionId: string | null | undefined, options?: ResolveTeamActionContractOptions): TeamActionContract;
```

<a id="symbol-root-resolveteamactioncontractoptions"></a>

## ResolveTeamActionContractOptions

Kind: type

```ts
export type ResolveTeamActionContractOptions = {
    memberId?: string | null;
    /** Values substituted into `{token}` placeholders in the action's route path. */
    params?: Record<string, string | number | boolean> | null;
    /** Query parameters appended to the resolved path (via `appendHttpQuery`). */
    query?: Record<string, string | number | boolean | undefined> | null;
};
```

<a id="symbol-root-resolveteamroutepath"></a>

## resolveTeamRoutePath

Kind: function

```ts
export declare function resolveTeamRoutePath(routeKey: TeamRouteKey, options: ResolveTeamRoutePathOptions): string;
```

<a id="symbol-root-resolveteamroutepathoptions"></a>

## ResolveTeamRoutePathOptions

Kind: type

```ts
export type ResolveTeamRoutePathOptions = {
    teamId: string;
    actionId?: string | null;
    agentId?: string | null;
    workspacePath?: string | null;
};
```

<a id="symbol-root-resolveteamworkspaceapipath"></a>

## resolveTeamWorkspaceApiPath

Kind: function

```ts
export declare function resolveTeamWorkspaceApiPath(team: ManifestTeam, keyOrPath: string, options?: ResolveTeamWorkspacePathOptions): string;
```

<a id="symbol-root-resolveteamworkspacepath"></a>

## resolveTeamWorkspacePath

Kind: function

```ts
export declare function resolveTeamWorkspacePath(team: ManifestTeam, keyOrPath: string, options?: ResolveTeamWorkspacePathOptions): string;
```

<a id="symbol-root-resolveteamworkspacepathoptions"></a>

## ResolveTeamWorkspacePathOptions

Kind: type

```ts
export type ResolveTeamWorkspacePathOptions = {
    memberId?: string | null;
};
```

<a id="symbol-root-run-stream-event-names"></a>

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

<a id="symbol-root-runeventstreamhandlers"></a>

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

<a id="symbol-root-runeventstreamprovider"></a>

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

<a id="symbol-root-runeventstreamsubscribeparams"></a>

## RunEventStreamSubscribeParams

Kind: type

```ts
export type RunEventStreamSubscribeParams = {
    runId: string;
    /** Optional caller-supplied abort signal. Implementations MUST honor abort and dispose. */
    signal?: AbortSignal;
};
```

<a id="symbol-root-runeventstreamsubscription"></a>

## RunEventStreamSubscription

Kind: type

```ts
/** Disposes an active subscription. Idempotent. */
export type RunEventStreamSubscription = {
    dispose(): void | Promise<void>;
};
```

<a id="symbol-root-runpreviewpollprovider"></a>

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

<a id="symbol-root-runpreviewpollprovideroptions"></a>

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

<a id="symbol-root-runpreviewsnapshotfetcher"></a>

## RunPreviewSnapshotFetcher

Kind: type

```ts
export type RunPreviewSnapshotFetcher = (runId: string, signal?: AbortSignal) => Promise<AgentRunDetailSnapshot | null>;
```

<a id="symbol-root-runstreamevent"></a>

## RunStreamEvent

Kind: type

```ts
export type RunStreamEvent = RunStreamMessageDeltaEvent | RunStreamRunCompletedEvent | RunStreamRunFailedEvent | RunStreamRunCancelledEvent | RunStreamApprovalRequestEvent | RunStreamToolEvent;
```

<a id="symbol-root-runstreameventname"></a>

## RunStreamEventName

Kind: type

```ts
export type RunStreamEventName = (typeof RUN_STREAM_EVENT_NAMES)[keyof typeof RUN_STREAM_EVENT_NAMES];
```

<a id="symbol-root-runtime-control-plane-event-names"></a>

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

<a id="symbol-root-runtime-provider-capability-matrix"></a>

## RUNTIME_PROVIDER_CAPABILITY_MATRIX

Kind: variable

```ts
export declare const RUNTIME_PROVIDER_CAPABILITY_MATRIX: Readonly<{
    claude: Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
    "claude-managed-agents": Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
    codex: Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
    gemini: Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
    hermes: Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
    openclaw: Readonly<{
        runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
        transports: Readonly<RuntimeTransportCapabilities>;
        controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
    }>;
}>;
```

<a id="symbol-root-runtime-surfaces"></a>

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

<a id="symbol-root-runtime-transport-kinds"></a>

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

<a id="symbol-root-runtimeauthstatus"></a>

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

<a id="symbol-root-runtimebatchcounts"></a>

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

<a id="symbol-root-runtimebatchoutcome"></a>

## RuntimeBatchOutcome

Kind: type

```ts
export type RuntimeBatchOutcome = "succeeded" | "errored" | "canceled" | "expired" | (string & {});
```

<a id="symbol-root-runtimebatchrequest"></a>

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

<a id="symbol-root-runtimebatchresult"></a>

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

<a id="symbol-root-runtimebatchstate"></a>

## RuntimeBatchState

Kind: type

```ts
export type RuntimeBatchState = "in_progress" | "canceling" | "completed" | "cancelled" | "failed" | (string & {});
```

<a id="symbol-root-runtimebatchstatus"></a>

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

<a id="symbol-root-runtimecapabilities"></a>

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

<a id="symbol-root-runtimeclient"></a>

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

<a id="symbol-root-runtimeclientoptions"></a>

## RuntimeClientOptions

Kind: type

```ts
export type RuntimeClientOptions = Pick<HttpApiClientOptions, "baseUrl" | "fetchImpl" | "onTrace">;
```

<a id="symbol-root-runtimecontrolplane"></a>

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

<a id="symbol-root-runtimecontrolplanedeclaration"></a>

## RuntimeControlPlaneDeclaration

Kind: type

```ts
export type RuntimeControlPlaneDeclaration = {
    transports?: RuntimeTransportCapabilities;
    modules?: Partial<Record<"sessions" | "models" | "usage" | "tasks" | "workspace" | "authStatus" | "events", true>>;
};
```

<a id="symbol-root-runtimecontrolplaneevent"></a>

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

<a id="symbol-root-runtimecontrolplaneeventname"></a>

## RuntimeControlPlaneEventName

Kind: type

```ts
export type RuntimeControlPlaneEventName = (typeof RUNTIME_CONTROL_PLANE_EVENT_NAMES)[number];
```

<a id="symbol-root-runtimecontrolplanemetadata"></a>

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

<a id="symbol-root-runtimecontrolplanesource"></a>

## RuntimeControlPlaneSource

Kind: type

```ts
export type RuntimeControlPlaneSource = {
    transport: "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix-socket";
    method: string;
};
```

<a id="symbol-root-runtimeerrormetadata"></a>

## RuntimeErrorMetadata

Kind: type

```ts
export type RuntimeErrorMetadata = {
    provider: string;
    transport: string;
    operation: string;
    retryable: boolean;
    retryAfterMs?: number;
    status?: number;
    providerCode?: string;
};
```

<a id="symbol-root-runtimeeventclient"></a>

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

<a id="symbol-root-runtimeeventsequenceinspection"></a>

## RuntimeEventSequenceInspection

Kind: interface

```ts
export interface RuntimeEventSequenceInspection {
    valid: boolean;
    terminalCount: number;
    gaps: number;
}
```

<a id="symbol-root-runtimeeventsubscription"></a>

## RuntimeEventSubscription

Kind: interface

```ts
export interface RuntimeEventSubscription {
    dispose(): void | Promise<void>;
}
```

<a id="symbol-root-runtimemodeldescriptor"></a>

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

<a id="symbol-root-runtimepage"></a>

## RuntimePage

Kind: type

```ts
export type RuntimePage<T> = {
    data: readonly T[];
    nextCursor?: string;
};
```

<a id="symbol-root-runtimeprovidercapabilitymatrixkey"></a>

## RuntimeProviderCapabilityMatrixKey

Kind: type

```ts
export type RuntimeProviderCapabilityMatrixKey = keyof typeof RUNTIME_PROVIDER_CAPABILITY_MATRIX;
```

<a id="symbol-root-runtimeprovidercapabilityrow"></a>

## RuntimeProviderCapabilityRow

Kind: type

```ts
export type RuntimeProviderCapabilityRow = Readonly<{
    runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
    transports: Readonly<RuntimeTransportCapabilities>;
    controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
}>;
```

<a id="symbol-root-runtimeprovidermodule"></a>

## RuntimeProviderModule

Kind: interface

```ts
/** @deprecated Import RuntimeProviderModule from core/runtime. */
export interface RuntimeProviderModule extends RuntimeProviderModuleBase {
}
```

<a id="symbol-root-runtimeproviderregistry"></a>

## RuntimeProviderRegistry

Kind: interface

```ts
export interface RuntimeProviderRegistry<M extends RuntimeProviderModule = RuntimeProviderModule> {
    resolveProvider(provider: string | null | undefined): M | null;
    listProviders(): readonly M[];
}
```

<a id="symbol-root-runtimeproviderstability"></a>

## RuntimeProviderStability

Kind: type

```ts
export type RuntimeProviderStability = "stable" | "experimental";
```

<a id="symbol-root-runtimeruninput"></a>

## RuntimeRunInput

Kind: type

```ts
export type RuntimeRunInput = string | RuntimeRunMessage[];
```

<a id="symbol-root-runtimerunmessage"></a>

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

<a id="symbol-root-runtimerunstartbody"></a>

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

<a id="symbol-root-runtimerunstate"></a>

## RuntimeRunState

Kind: type

```ts
export type RuntimeRunState = "started" | "running" | "completed" | "failed" | "cancelled" | "stopping" | "dry_run" | (string & {});
```

<a id="symbol-root-runtimerunstatus"></a>

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

<a id="symbol-root-runtimesessionstate"></a>

## RuntimeSessionState

Kind: type

```ts
export type RuntimeSessionState = "pending" | "active" | "completed" | "cancelled" | "failed" | "unknown";
```

<a id="symbol-root-runtimesessionsummary"></a>

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

<a id="symbol-root-runtimesupports"></a>

## runtimeSupports

Kind: function

```ts
export declare function runtimeSupports(capabilities: RuntimeCapabilities, surface: RuntimeSurface): boolean;
```

<a id="symbol-root-runtimesurface"></a>

## RuntimeSurface

Kind: type

```ts
export type RuntimeSurface = (typeof RUNTIME_SURFACES)[number];
```

<a id="symbol-root-runtimetaskstate"></a>

## RuntimeTaskState

Kind: type

```ts
export type RuntimeTaskState = "pending" | "running" | "completed" | "cancelled" | "failed" | "unknown";
```

<a id="symbol-root-runtimetasksummary"></a>

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

<a id="symbol-root-runtimetransportcapabilities"></a>

## RuntimeTransportCapabilities

Kind: type

```ts
export type RuntimeTransportCapabilities = Partial<Record<RuntimeTransportKind, RuntimeTransportCapability>>;
```

<a id="symbol-root-runtimetransportcapability"></a>

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

<a id="symbol-root-runtimetransportkind"></a>

## RuntimeTransportKind

Kind: type

```ts
export type RuntimeTransportKind = (typeof RUNTIME_TRANSPORT_KINDS)[number];
```

<a id="symbol-root-runtimetransportsupports"></a>

## runtimeTransportSupports

Kind: function

```ts
export declare function runtimeTransportSupports(capabilities: RuntimeTransportCapabilities, kind: RuntimeTransportKind): boolean;
```

<a id="symbol-root-runtimeusage"></a>

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

<a id="symbol-root-runtimeusagecost"></a>

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

<a id="symbol-root-runtimeusagequery"></a>

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

<a id="symbol-root-runtimeusagesummary"></a>

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

<a id="symbol-root-runtimeworkspacedescriptor"></a>

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

<a id="symbol-root-serializedapiclienterror"></a>

## SerializedApiClientError

Kind: type

```ts
export type SerializedApiClientError = {
    name: string;
    message: string;
    type?: string;
    code?: string;
};
```

<a id="symbol-root-serializeerror"></a>

## serializeError

Kind: function

```ts
export declare function serializeError(error: unknown, fallbackMessage?: string): SerializedApiClientError;
```

<a id="symbol-root-sessionclient"></a>

## SessionClient

Kind: interface

```ts
export interface SessionClient {
    listSessions(query?: {
        cursor?: string;
        limit?: number;
    }): Promise<RuntimePage<RuntimeSessionSummary>>;
    getSession(id: string): Promise<RuntimeSessionSummary>;
    cancelSession?(id: string): Promise<RuntimeSessionSummary>;
}
```

<a id="symbol-root-stringifyunknownerror"></a>

## stringifyUnknownError

Kind: function

```ts
export declare function stringifyUnknownError(error: unknown): string;
```

<a id="symbol-root-surface-contracts"></a>

## SURFACE_CONTRACTS

Kind: variable

```ts
export declare const SURFACE_CONTRACTS: Record<string, SurfaceContract>;
```

<a id="symbol-root-surfacecontract"></a>

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

<a id="symbol-root-surfacecontractmap"></a>

## SurfaceContractMap

Kind: type

```ts
export type SurfaceContractMap = Record<string, SurfaceContract>;
```

<a id="symbol-root-surfacepathresolver"></a>

## SurfacePathResolver

Kind: type

```ts
export type SurfacePathResolver = (key: string, params?: Record<string, string>) => string;
```

<a id="symbol-root-taskclient"></a>

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

<a id="symbol-root-team-action-input-modes"></a>

## TEAM_ACTION_INPUT_MODES

Kind: variable

```ts
export declare const TEAM_ACTION_INPUT_MODES: readonly [
    "command",
    "json",
    "text"
];
```

<a id="symbol-root-team-action-output-modes"></a>

## TEAM_ACTION_OUTPUT_MODES

Kind: variable

```ts
export declare const TEAM_ACTION_OUTPUT_MODES: readonly [
    "artifact",
    "json",
    "markdown",
    "text"
];
```

<a id="symbol-root-team-manifest-version"></a>

## TEAM_MANIFEST_VERSION

Kind: variable

```ts
export declare const TEAM_MANIFEST_VERSION: 1;
```

<a id="symbol-root-teamactionartifact"></a>

## TeamActionArtifact

Kind: type

```ts
export type TeamActionArtifact = {
    key: string;
    contentType?: string | null;
    path?: string | null;
    url?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactionartifactcontract"></a>

## TeamActionArtifactContract

Kind: type

```ts
export type TeamActionArtifactContract = {
    key: string;
    contentType?: string | null;
    path?: string | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactioncontract"></a>

## TeamActionContract

Kind: type

```ts
export type TeamActionContract = {
    id: string;
    title?: string | null;
    description?: string | null;
    enabled?: boolean | null;
    route?: TeamActionRouteContract | null;
    input?: TeamActionInputContract | null;
    output?: TeamActionOutputContract | null;
    defaults?: Record<string, TeamActionJsonValue> | null;
    capabilities?: readonly string[] | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactionhttpmethod"></a>

## TeamActionHttpMethod

Kind: type

```ts
export type TeamActionHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
```

<a id="symbol-root-teamactioninputcontract"></a>

## TeamActionInputContract

Kind: type

```ts
export type TeamActionInputContract = {
    mode?: TeamActionInputMode | null;
    command?: string | null;
    params?: readonly TeamActionParamContract[] | null;
    schema?: Record<string, unknown> | null;
    examples?: readonly string[] | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactioninputmode"></a>

## TeamActionInputMode

Kind: type

```ts
export type TeamActionInputMode = (typeof TEAM_ACTION_INPUT_MODES)[number];
```

<a id="symbol-root-teamactionjsonvalue"></a>

## TeamActionJsonValue

Kind: type

```ts
export type TeamActionJsonValue = string | number | boolean | null | readonly TeamActionJsonValue[] | {
    readonly [key: string]: TeamActionJsonValue;
};
```

<a id="symbol-root-teamactionoutputcontract"></a>

## TeamActionOutputContract

Kind: type

```ts
export type TeamActionOutputContract = {
    mode?: TeamActionOutputMode | null;
    contentType?: string | null;
    schema?: Record<string, unknown> | null;
    artifacts?: readonly TeamActionArtifactContract[] | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactionoutputmode"></a>

## TeamActionOutputMode

Kind: type

```ts
export type TeamActionOutputMode = (typeof TEAM_ACTION_OUTPUT_MODES)[number];
```

<a id="symbol-root-teamactionparamcontract"></a>

## TeamActionParamContract

Kind: type

```ts
export type TeamActionParamContract = {
    key: string;
    type?: TeamActionParamType | null;
    required?: boolean | null;
    default?: TeamActionJsonValue;
    values?: readonly string[] | null;
    aliases?: readonly string[] | null;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactionparamtype"></a>

## TeamActionParamType

Kind: type

```ts
export type TeamActionParamType = "boolean" | "enum" | "file" | "json" | "number" | "string";
```

<a id="symbol-root-teamactionresponse"></a>

## TeamActionResponse

Kind: type

```ts
export type TeamActionResponse = (TeamActionResponseBase & {
    kind: "artifact";
    artifacts: readonly TeamActionArtifact[];
    data?: TeamActionJsonValue;
}) | (TeamActionResponseBase & {
    kind: "json";
    data: TeamActionJsonValue;
}) | (TeamActionResponseBase & {
    kind: "markdown";
    markdown: string;
}) | (TeamActionResponseBase & {
    kind: "text";
    text: string;
});
```

<a id="symbol-root-teamactionresponsebase"></a>

## TeamActionResponseBase

Kind: type

```ts
export type TeamActionResponseBase = {
    actionId?: string | null;
    teamId?: string | null;
    memberId?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teamactionroutecontract"></a>

## TeamActionRouteContract

Kind: type

```ts
export type TeamActionRouteContract = {
    method?: TeamActionHttpMethod | null;
    surfaceKey?: string | null;
    path?: string | null;
    metadata?: Record<string, unknown> | null;
};
```

<a id="symbol-root-teammanifest"></a>

## TeamManifest

Kind: type

```ts
export type TeamManifest = {
    version: TeamManifestVersion;
    actions?: readonly TeamActionContract[] | null;
    bindings?: readonly GatewayRouteBinding[] | null;
    teams: readonly ManifestTeam[];
};
```

<a id="symbol-root-teammanifestinput"></a>

## TeamManifestInput

Kind: type

```ts
export type TeamManifestInput = Partial<TeamManifest> | null | undefined;
```

<a id="symbol-root-teammanifestloader"></a>

## TeamManifestLoader

Kind: type

```ts
export type TeamManifestLoader = () => TeamManifestInput | Promise<TeamManifestInput>;
```

<a id="symbol-root-teammanifestsource"></a>

## TeamManifestSource

Kind: interface

```ts
/** The seam through which a host supplies its manifest to the package. */
export interface TeamManifestSource {
    getManifest(): Promise<TeamManifest>;
}
```

<a id="symbol-root-teammanifestversion"></a>

## TeamManifestVersion

Kind: type

```ts
export type TeamManifestVersion = typeof TEAM_MANIFEST_VERSION;
```

<a id="symbol-root-teamroutekey"></a>

## TeamRouteKey

Kind: type

```ts
export type TeamRouteKey = DefaultTeamRouteKey | "action" | "agent.action" | "agent.config" | "agent.workspace" | (string & {});
```

<a id="symbol-root-teamrouteresolver"></a>

## TeamRouteResolver

Kind: interface

```ts
/**
 * Generic, host-overridable route resolution over a TeamManifest. The default
 * implementation delegates to the standard REST path builders.
 */
export interface TeamRouteResolver {
    resolveRoutePath(routeKey: TeamRouteKey, options: ResolveTeamRoutePathOptions): string;
    resolveActionApiPath(manifest: TeamManifest, teamId: string, actionId: string, options?: ResolveTeamActionContractOptions): string;
    resolveWorkspaceApiPath(manifest: TeamManifest, teamId: string, keyOrPath: string, options?: ResolveTeamWorkspacePathOptions): string;
    resolveBinding(manifest: TeamManifest, options: ResolveGatewayRouteBindingOptions): GatewayResolvedRouteBinding | null;
}
```

<a id="symbol-root-teamworkspaceconfig"></a>

## TeamWorkspaceConfig

Kind: type

```ts
export type TeamWorkspaceConfig = {
    rootPath: string;
    paths?: readonly TeamWorkspacePathEntry[] | null;
};
```

<a id="symbol-root-teamworkspacepathentry"></a>

## TeamWorkspacePathEntry

Kind: type

```ts
export type TeamWorkspacePathEntry = string | {
    key: string;
    path?: string | null;
};
```

<a id="symbol-root-toerror"></a>

## toError

Kind: function

```ts
export declare function toError(error: unknown, fallbackMessage?: string): Error;
```

<a id="symbol-root-tokenprices"></a>

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

<a id="symbol-root-unsupportedruntimesurface"></a>

## unsupportedRuntimeSurface

Kind: function

```ts
/** Throw a typed EndpointNotFound for a surface this provider does not serve. */
export declare function unsupportedRuntimeSurface(providerKind: string, surface: RuntimeSurface): never;
```

<a id="symbol-root-usageclient"></a>

## UsageClient

Kind: interface

```ts
export interface UsageClient {
    getUsage(query?: RuntimeUsageQuery): Promise<RuntimeUsageSummary>;
}
```

<a id="symbol-root-withfallback"></a>

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

<a id="symbol-root-withmutationresult"></a>

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

<a id="symbol-root-withruntimebasepath"></a>

## withRuntimeBasePath

Kind: function

```ts
export declare function withRuntimeBasePath(pathname: string, rawBasePath: string | null | undefined): string;
```

<a id="symbol-root-workspaceclient"></a>

## WorkspaceClient

Kind: interface

```ts
export interface WorkspaceClient {
    listWorkspaces(): Promise<readonly RuntimeWorkspaceDescriptor[]>;
    getWorkspace(id: string): Promise<RuntimeWorkspaceDescriptor>;
}
```
