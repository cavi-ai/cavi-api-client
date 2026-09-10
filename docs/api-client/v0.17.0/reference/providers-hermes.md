# @cavi-ai/api-client/providers/hermes

Package subpath: ./providers/hermes

<a id="symbol-providers-hermes-buildagentconfigfromhermesconfigsnapshot"></a>

## buildAgentConfigFromHermesConfigSnapshot

Kind: function

```ts
export declare function buildAgentConfigFromHermesConfigSnapshot(input: {
    agentId: string;
    config: unknown;
    schema?: unknown;
    defaults?: unknown;
    profile?: AgentProfileSummary | null;
    fetchedAt?: number;
    etag?: string;
}): AgentConfig;
```

<a id="symbol-providers-hermes-buildagentconfigfromhermeswebuisnapshot"></a>

## buildAgentConfigFromHermesWebuiSnapshot

Kind: function

```ts
export declare function buildAgentConfigFromHermesWebuiSnapshot(input: {
    agentId: string;
    profile?: AgentProfileSummary | null;
    profiles?: unknown;
    config?: unknown;
    schema?: unknown;
    defaults?: unknown;
    models?: unknown;
    reasoning?: unknown;
    mcpServers?: unknown;
    fetchedAt?: number;
    etag?: string;
}): AgentConfig;
```

<a id="symbol-providers-hermes-createhermesapiservercontrolplane"></a>

## createHermesApiServerControlPlane

Kind: function

```ts
export declare function createHermesApiServerControlPlane(options: RequestOptions): {
    probe(): Promise<void>;
    models: ModelCatalogClient;
    sessions: SessionClient;
    usage: UsageClient;
};
```

<a id="symbol-providers-hermes-createhermesapiservereventclient"></a>

## createHermesApiServerEventClient

Kind: function

```ts
export declare function createHermesApiServerEventClient(options: HermesApiServerRunEventsOptions): HermesApiServerEventClient;
```

<a id="symbol-providers-hermes-createhermesauthstatusclient"></a>

## createHermesAuthStatusClient

Kind: function

```ts
export declare function createHermesAuthStatusClient(rest: HermesDashboardRestClient): AuthStatusClient;
```

<a id="symbol-providers-hermes-createhermescapabilityresolver"></a>

## createHermesCapabilityResolver

Kind: function

```ts
/**
 * Build the runtime capability resolver for a Hermes API server: GET the
 * capabilities endpoint and transform the envelope into the unified shape.
 * The result is authoritative over the static fallback (design decision M1).
 */
export declare function createHermesCapabilityResolver(options: CreateHermesCapabilityResolverOptions): ProviderCapabilityResolver;
```

<a id="symbol-providers-hermes-createhermescapabilityresolveroptions"></a>

## CreateHermesCapabilityResolverOptions

Kind: type

```ts
export type CreateHermesCapabilityResolverOptions = {
    baseUrl: string;
    token?: string;
    fetchImpl?: typeof fetch;
    /** Manifest team id for this gateway instance. Defaults to the provider kind. */
    teamId?: string;
};
```

<a id="symbol-providers-hermes-createhermesdashboardjsonrpcclient"></a>

## createHermesDashboardJsonRpcClient

Kind: function

```ts
export declare function createHermesDashboardJsonRpcClient(options: HermesDashboardJsonRpcOptions): HermesDashboardJsonRpcClient;
```

<a id="symbol-providers-hermes-createhermesdashboardrestclient"></a>

## createHermesDashboardRestClient

Kind: function

```ts
export declare function createHermesDashboardRestClient(options: HermesDashboardRestOptions): HermesDashboardRestClient;
```

<a id="symbol-providers-hermes-createhermeskanbanclient"></a>

## createHermesKanbanClient

Kind: function

```ts
/**
 * Adapt the Hermes kanban plugin's REST surface to the provider-agnostic
 * KanbanClient — the same contract `createOpenClawKanbanClient` satisfies from
 * Workboard RPC.
 */
export declare function createHermesKanbanClient(request: HermesKanbanRequest, options?: HermesKanbanClientOptions): KanbanClient;
```

<a id="symbol-providers-hermes-createhermesmodelcatalogclient"></a>

## createHermesModelCatalogClient

Kind: function

```ts
export declare function createHermesModelCatalogClient(rest: HermesDashboardRestClient): ModelCatalogClient;
```

<a id="symbol-providers-hermes-createhermesrawgatewaychannel"></a>

## createHermesRawGatewayChannel

Kind: function

```ts
export declare function createHermesRawGatewayChannel(rpc: HermesDashboardJsonRpcClient, lifecycle: HermesRawGatewayLifecycle): RawGatewayChannel;
```

<a id="symbol-providers-hermes-createhermesruntimeeventclient"></a>

## createHermesRuntimeEventClient

Kind: function

```ts
export declare function createHermesRuntimeEventClient(rpc: HermesDashboardJsonRpcClient): RuntimeEventClient;
```

<a id="symbol-providers-hermes-createhermessessionclient"></a>

## createHermesSessionClient

Kind: function

```ts
export declare function createHermesSessionClient(operations: GatewaySessionOperations): SessionClient;
```

<a id="symbol-providers-hermes-createhermessessionoperations"></a>

## createHermesSessionOperations

Kind: function

```ts
export declare function createHermesSessionOperations(options: {
    rpc: HermesDashboardJsonRpcClient;
    rest: HermesDashboardRestClient;
}): GatewaySessionOperations;
```

<a id="symbol-providers-hermes-createhermesteamregistry"></a>

## createHermesTeamRegistry

Kind: function

```ts
export declare function createHermesTeamRegistry(config?: TeamRegistryConfig): TeamRegistry;
```

<a id="symbol-providers-hermes-createhermesusageclient"></a>

## createHermesUsageClient

Kind: function

```ts
export declare function createHermesUsageClient(options: HermesUsageClientOptions): UsageClient;
```

<a id="symbol-providers-hermes-gatewaychatrunattachment"></a>

## GatewayChatRunAttachment

Kind: type

```ts
export type GatewayChatRunAttachment = HermesChatRunAttachment;
```

<a id="symbol-providers-hermes-gatewayroutemetadata"></a>

## GatewayRouteMetadata

Kind: type

```ts
export type GatewayRouteMetadata = HermesRouteMetadata;
```

<a id="symbol-providers-hermes-gatewayroutesource"></a>

## GatewayRouteSource

Kind: type

```ts
export type GatewayRouteSource = HermesRouteSource;
```

<a id="symbol-providers-hermes-gatewaysseruneventheaderresolver"></a>

## GatewaySseRunEventHeaderResolver

Kind: type

```ts
export type GatewaySseRunEventHeaderResolver = (params: {
    runId: string;
    phase: GatewaySseRunEventPhase;
}) => Record<string, string | null | undefined>;
```

<a id="symbol-providers-hermes-gatewaysseruneventprovider"></a>

## GatewaySseRunEventProvider

Kind: variable

```ts
export declare const GatewaySseRunEventProvider: typeof CoreGatewaySseRunEventProvider;
```

<a id="symbol-providers-hermes-gatewaysseruneventprovideroptions"></a>

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

<a id="symbol-providers-hermes-hermes-dashboard-paths"></a>

## HERMES_DASHBOARD_PATHS

Kind: variable

```ts
export declare const HERMES_DASHBOARD_PATHS: {
    readonly sessions: "/api/sessions";
    readonly session: (id: string) => string;
    readonly usage: "/api/analytics/usage";
    readonly models: "/api/models";
    readonly providerAuth: "/api/provider-auth";
    readonly profile: "/api/profile";
    readonly config: "/api/config";
};
```

<a id="symbol-providers-hermes-hermes-dashboard-rest-fallbacks"></a>

## HERMES_DASHBOARD_REST_FALLBACKS

Kind: variable

```ts
export declare const HERMES_DASHBOARD_REST_FALLBACKS: {
    readonly listSessions: "session.list";
    readonly getUsage: "session.usage";
};
```

<a id="symbol-providers-hermes-hermes-http-api-env-aliases"></a>

## HERMES_HTTP_API_ENV_ALIASES

Kind: variable

```ts
export declare const HERMES_HTTP_API_ENV_ALIASES: {
    readonly baseUrl: readonly [
        "EXPO_PUBLIC_HERMES_API_BASE_URL",
        "VITE_HERMES_API_BASE_URL",
        "GATEWAY_API_BASE_URL",
        "EXPO_PUBLIC_GATEWAY_API_BASE_URL",
        "VITE_GATEWAY_API_BASE_URL"
    ];
    readonly authToken: readonly [
        "EXPO_PUBLIC_HERMES_API_AUTH_TOKEN",
        "VITE_HERMES_API_AUTH_TOKEN",
        "GATEWAY_API_AUTH_TOKEN",
        "EXPO_PUBLIC_GATEWAY_TOKEN",
        "EXPO_PUBLIC_GATEWAY_API_AUTH_TOKEN",
        "VITE_GATEWAY_API_AUTH_TOKEN"
    ];
    readonly clientId: readonly [
        "EXPO_PUBLIC_HERMES_API_CLIENT_ID",
        "VITE_HERMES_API_CLIENT_ID",
        "GATEWAY_API_CLIENT_ID",
        "EXPO_PUBLIC_GATEWAY_CLIENT_ID",
        "EXPO_PUBLIC_GATEWAY_API_CLIENT_ID",
        "VITE_GATEWAY_API_CLIENT_ID"
    ];
};
```

<a id="symbol-providers-hermes-hermes-http-api-env-keys"></a>

## HERMES_HTTP_API_ENV_KEYS

Kind: variable

```ts
export declare const HERMES_HTTP_API_ENV_KEYS: {
    readonly baseUrl: "HERMES_API_BASE_URL";
    readonly authToken: "HERMES_API_AUTH_TOKEN";
    readonly clientId: "HERMES_API_CLIENT_ID";
};
```

<a id="symbol-providers-hermes-hermes-profile-cookie-name"></a>

## HERMES_PROFILE_COOKIE_NAME

Kind: variable

```ts
/** Cookie the Hermes host-config plugin reads to select the active profile. */
export declare const HERMES_PROFILE_COOKIE_NAME = "hermes_profile";
```

<a id="symbol-providers-hermes-hermes-provider-module"></a>

## HERMES_PROVIDER_MODULE

Kind: variable

```ts
export declare const HERMES_PROVIDER_MODULE: GatewayProviderModule;
```

<a id="symbol-providers-hermes-hermesagentconfigapiclient"></a>

## HermesAgentConfigApiClient

Kind: class

```ts
export declare class HermesAgentConfigApiClient extends GatewayAgentConfigApiClient {
    constructor(options: HttpApiClientOptions);
    getProfileConfig(agentId: string): Promise<AgentConfig>;
    private getProfileConfigViaHermesWebui;
    patchProfileConfig(agentId: string, diff: AgentConfigDraftDiff, options?: PatchProfileConfigOptions): Promise<AgentConfig>;
    private patchProfileConfigViaHermesWebui;
}
```

<a id="symbol-providers-hermes-hermesagentprofileconfigyamlpath"></a>

## hermesAgentProfileConfigYamlPath

Kind: function

```ts
export declare function hermesAgentProfileConfigYamlPath(agentId: string): string;
```

<a id="symbol-providers-hermes-hermesapiservereventclient"></a>

## HermesApiServerEventClient

Kind: interface

```ts
export interface HermesApiServerEventClient extends RuntimeEventClient {
    dispose(): Promise<void>;
}
```

<a id="symbol-providers-hermes-hermesapiserverruneventsoptions"></a>

## HermesApiServerRunEventsOptions

Kind: type

```ts
export type HermesApiServerRunEventsOptions = Readonly<{
    runId: string;
    sessionKey: string;
    clientId: string;
    baseUrl: string;
    token: string | null;
    fetchImpl?: typeof fetch;
}>;
```

<a id="symbol-providers-hermes-hermescavicosthistorysource"></a>

## HermesCaviCostHistorySource

Kind: type

```ts
export type HermesCaviCostHistorySource = Readonly<{
    getCostHistory(range: CostHistoryRange): Promise<CostHistorySnapshot>;
    range: CostHistoryRange;
    currency: string;
    accountingAuthority: string;
}>;
```

<a id="symbol-providers-hermes-hermeschatrunattachment"></a>

## HermesChatRunAttachment

Kind: type

```ts
/**
 * A file sent with a chat turn. Base64 keeps it on the HTTP run path (gateway
 * field names are sent in snake AND camel case so the server can read whichever
 * casing it accepts).
 */
export type HermesChatRunAttachment = {
    name: string;
    mimeType: string;
    size: number;
    /** Base64-encoded file bytes (no data: prefix). */
    dataBase64: string;
};
```

<a id="symbol-providers-hermes-hermesdashboarddeleteresult"></a>

## HermesDashboardDeleteResult

Kind: type

```ts
export type HermesDashboardDeleteResult = Readonly<{
    ok: true;
}>;
```

<a id="symbol-providers-hermes-hermesdashboardevent"></a>

## HermesDashboardEvent

Kind: type

```ts
export type HermesDashboardEvent = Readonly<{
    type: string;
    payload: unknown;
}>;
```

<a id="symbol-providers-hermes-hermesdashboardjsonrpcclient"></a>

## HermesDashboardJsonRpcClient

Kind: interface

```ts
export interface HermesDashboardJsonRpcClient {
    request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
    subscribe(listener: (event: HermesDashboardEvent) => void): () => void;
    dispose(): Promise<void>;
}
```

<a id="symbol-providers-hermes-hermesdashboardjsonrpcoptions"></a>

## HermesDashboardJsonRpcOptions

Kind: type

```ts
export type HermesDashboardJsonRpcOptions = Readonly<{
    channel: TransportMessageChannel<unknown>;
    ownsChannel?: boolean;
    maxPendingRequests?: number;
    onProtocolError?: (error: TransportError) => void;
}>;
```

<a id="symbol-providers-hermes-hermesdashboardjsonvalue"></a>

## HermesDashboardJsonValue

Kind: type

```ts
export type HermesDashboardJsonValue = null | string | number | boolean | readonly HermesDashboardJsonValue[] | {
    readonly [key: string]: HermesDashboardJsonValue;
};
```

<a id="symbol-providers-hermes-hermesdashboardmodels"></a>

## HermesDashboardModels

Kind: type

```ts
export type HermesDashboardModels = Readonly<{
    providers: readonly JsonRecord[];
}> & JsonRecord;
```

<a id="symbol-providers-hermes-hermesdashboardobject"></a>

## HermesDashboardObject

Kind: type

```ts
export type HermesDashboardObject = Readonly<Record<string, HermesDashboardJsonValue>>;
```

<a id="symbol-providers-hermes-hermesdashboardproviderauth"></a>

## HermesDashboardProviderAuth

Kind: type

```ts
export type HermesDashboardProviderAuth = Readonly<{
    providers: readonly JsonRecord[];
}> & JsonRecord;
```

<a id="symbol-providers-hermes-hermesdashboardrestclient"></a>

## HermesDashboardRestClient

Kind: interface

```ts
export interface HermesDashboardRestClient {
    listSessions(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardSessions>;
    getSession(id: string, options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardSession>;
    deleteSession(id: string, options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardDeleteResult>;
    getUsage(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardUsage>;
    getModels(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardModels>;
    getProviderAuth(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardProviderAuth>;
    getProfile(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardObject>;
    getConfig(options?: {
        signal?: AbortSignal;
    }): Promise<HermesDashboardObject>;
}
```

<a id="symbol-providers-hermes-hermesdashboardrestfallback"></a>

## HermesDashboardRestFallback

Kind: interface

```ts
export interface HermesDashboardRestFallback {
    request<T>(method: string, params?: unknown, options?: {
        signal?: AbortSignal;
    }): Promise<T>;
}
```

<a id="symbol-providers-hermes-hermesdashboardrestoptions"></a>

## HermesDashboardRestOptions

Kind: type

```ts
export type HermesDashboardRestOptions = Readonly<{
    baseUrl: string;
    authToken: string | null;
    defaultHeaders?: Record<string, string>;
    resolveAuthHeaders?: CredentialResolver;
    fetchImpl?: typeof fetch;
    fallback?: HermesDashboardRestFallback;
}>;
```

<a id="symbol-providers-hermes-hermesdashboardsession"></a>

## HermesDashboardSession

Kind: type

```ts
export type HermesDashboardSession = Readonly<{
    id: string;
    source: string | null;
    model: string | null;
}> & JsonRecord;
```

<a id="symbol-providers-hermes-hermesdashboardsessions"></a>

## HermesDashboardSessions

Kind: type

```ts
export type HermesDashboardSessions = Readonly<{
    sessions: readonly JsonRecord[];
    total: number;
    limit: number;
    offset: number;
}> & JsonRecord;
```

<a id="symbol-providers-hermes-hermesdashboardusage"></a>

## HermesDashboardUsage

Kind: type

```ts
export type HermesDashboardUsage = Readonly<{
    daily: readonly JsonRecord[];
    by_model: readonly JsonRecord[];
    totals: JsonRecord;
    period_days: number;
    skills: JsonRecord;
}> & JsonRecord;
```

<a id="symbol-providers-hermes-hermeskanbanclientoptions"></a>

## HermesKanbanClientOptions

Kind: type

```ts
export type HermesKanbanClientOptions = {
    /** Board slug; omitted means the plugin's active board. */
    boardId?: string;
};
```

<a id="symbol-providers-hermes-hermeskanbanrequest"></a>

## HermesKanbanRequest

Kind: type

```ts
/** JSON transport for the kanban plugin's REST surface. */
export type HermesKanbanRequest = <T>(path: string, init?: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
}) => Promise<T>;
```

<a id="symbol-providers-hermes-hermesprofilecookieheader"></a>

## hermesProfileCookieHeader

Kind: function

```ts
export declare function hermesProfileCookieHeader(agentId: string): string;
```

<a id="symbol-providers-hermes-hermesrawgatewaylifecycle"></a>

## HermesRawGatewayLifecycle

Kind: type

```ts
export type HermesRawGatewayLifecycle = Readonly<{
    connect: () => Promise<void>;
    getConnectionState: () => RawGatewayConnectionState;
    onConnectionState: (listener: (state: RawGatewayConnectionState) => void) => () => void;
    dispose?: () => void | Promise<void>;
}>;
```

<a id="symbol-providers-hermes-hermesroutemetadata"></a>

## HermesRouteMetadata

Kind: type

```ts
/**
 * Provider-neutral metadata bag attached to a Hermes chat run. Free-form by
 * design — the gateway forwards untyped fields to route handlers. Use
 * {@link sanitizeHermesRouteMetadata} before sending to strip dict-valued
 * route binding keys some routers reject as malformed.
 */
export type HermesRouteMetadata = Record<string, unknown>;
```

<a id="symbol-providers-hermes-hermesroutesource"></a>

## HermesRouteSource

Kind: type

```ts
export type HermesRouteSource = Record<string, unknown>;
```

<a id="symbol-providers-hermes-hermessseruneventprovider"></a>

## HermesSseRunEventProvider

Kind: class

```ts
/**
 * Subscribes to the Hermes run-event SSE stream and emits
 * canonical run-stream events. Falls back to status polling
 * when SSE is unsupported by the server.
 *
 * The caller is responsible for starting the run and
 * supplying the resulting `run_id` to {@link subscribe}.
 *
 * Tool events are emitted when the underlying Hermes payload contains
 * tool-shaped fields (`tool_name`, `function_name`, etc.). When the Hermes API
 * does not natively emit tool events, compose this provider with
 * {@link RunPreviewPollProvider} via `createRunStreamWithToolFallback`.
 */
export declare class HermesSseRunEventProvider extends CoreGatewaySseRunEventProvider {
    constructor(options: HermesSseRunEventProviderOptions);
}
```

<a id="symbol-providers-hermes-hermessseruneventprovideroptions"></a>

## HermesSseRunEventProviderOptions

Kind: type

```ts
export type HermesSseRunEventProviderOptions = GatewaySseRunEventProviderOptions & {
    /** Required for `X-Hermes-Session-Key` on both the SSE request and the poll fallback. */
    sessionKey: string;
};
```

<a id="symbol-providers-hermes-hermesusageclientoptions"></a>

## HermesUsageClientOptions

Kind: type

```ts
export type HermesUsageClientOptions = Readonly<{
    rest: HermesDashboardRestClient;
    caviCostHistory?: HermesCaviCostHistorySource;
}>;
```

<a id="symbol-providers-hermes-max-hermes-session-page-size"></a>

## MAX_HERMES_SESSION_PAGE_SIZE

Kind: variable

```ts
export declare const MAX_HERMES_SESSION_PAGE_SIZE = 200;
```

<a id="symbol-providers-hermes-requestoptions"></a>

## RequestOptions

Kind: type

```ts
export type RequestOptions = Readonly<{
    signal?: AbortSignal;
}>;
```

<a id="symbol-providers-hermes-requirehermessafejsonrecord"></a>

## requireHermesSafeJsonRecord

Kind: function

```ts
export declare function requireHermesSafeJsonRecord(value: unknown, label: string): Record<string, unknown>;
```

<a id="symbol-providers-hermes-resolvegatewaychatrunapproval"></a>

## resolveGatewayChatRunApproval

Kind: variable

```ts
export declare const resolveGatewayChatRunApproval: typeof resolveHermesChatRunApproval;
```

<a id="symbol-providers-hermes-resolvegatewaychatrunapprovalparams"></a>

## ResolveGatewayChatRunApprovalParams

Kind: type

```ts
export type ResolveGatewayChatRunApprovalParams = ResolveHermesChatRunApprovalParams;
```

<a id="symbol-providers-hermes-resolvegatewayroutesource"></a>

## resolveGatewayRouteSource

Kind: variable

```ts
export declare const resolveGatewayRouteSource: typeof resolveHermesRouteSource;
```

<a id="symbol-providers-hermes-resolvehermeschatrunapproval"></a>

## resolveHermesChatRunApproval

Kind: function

```ts
/**
 * Resolves a pending approval gate through the configured run approval endpoint with
 * one of the canonical {@link RunStreamApprovalChoice} options.
 */
export declare function resolveHermesChatRunApproval(params: ResolveHermesChatRunApprovalParams): Promise<void>;
```

<a id="symbol-providers-hermes-resolvehermeschatrunapprovalparams"></a>

## ResolveHermesChatRunApprovalParams

Kind: type

```ts
export type ResolveHermesChatRunApprovalParams = {
    httpBase: string;
    authToken: string;
    clientId: string;
    headers?: Record<string, string>;
    runId: string;
    choice: RunStreamApprovalChoice;
    sessionKey?: string;
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
};
```

<a id="symbol-providers-hermes-resolvehermeshttpapiconfigfromenv"></a>

## resolveHermesHttpApiConfigFromEnv

Kind: function

```ts
export declare function resolveHermesHttpApiConfigFromEnv(env: HttpApiEnvSource, options?: ResolveHermesHttpApiConfigOptions): HttpApiSurfaceConfig;
```

<a id="symbol-providers-hermes-resolvehermeshttpapiconfigoptions"></a>

## ResolveHermesHttpApiConfigOptions

Kind: type

```ts
export type ResolveHermesHttpApiConfigOptions = {
    defaults?: Partial<HttpApiSurfaceConfig>;
    trimValues?: boolean;
    includeAliases?: boolean;
};
```

<a id="symbol-providers-hermes-resolvehermesroutesource"></a>

## resolveHermesRouteSource

Kind: function

```ts
export declare function resolveHermesRouteSource(input: {
    clientId: string;
    sessionKey: string;
    targetProfile?: string;
    targetAgent?: string;
    harness?: string;
    source?: HermesRouteSource;
    routeChannel?: RouteChannelConfig;
}): HermesRouteSource | undefined;
```

<a id="symbol-providers-hermes-routechannelconfig"></a>

## RouteChannelConfig

Kind: type

```ts
/**
 * Host-supplied route-channel policy. The provider knows no product agents; a
 * consumer maps its own default channel and agent→channel overrides (e.g. CAVI
 * passes `{ defaultChannel: "front-door", agentChannelOverrides: { tony: "front-door" } }`).
 */
export type RouteChannelConfig = {
    defaultChannel?: string;
    agentChannelOverrides?: Record<string, string>;
};
```

<a id="symbol-providers-hermes-sanitizegatewayroutemetadata"></a>

## sanitizeGatewayRouteMetadata

Kind: variable

```ts
export declare const sanitizeGatewayRouteMetadata: typeof sanitizeHermesRouteMetadata;
```

<a id="symbol-providers-hermes-sanitizegatewayroutesource"></a>

## sanitizeGatewayRouteSource

Kind: variable

```ts
export declare const sanitizeGatewayRouteSource: typeof sanitizeHermesRouteSource;
```

<a id="symbol-providers-hermes-sanitizehermesroutemetadata"></a>

## sanitizeHermesRouteMetadata

Kind: function

```ts
/**
 * Gateway route bindings are scalar fields (`targetProfile`, `targetAgent`,
 * `sessionKey`, `action`). Some routers validate dict-valued `binding` /
 * `routeBinding` keys and reject the whole chat turn — strip those before
 * forwarding metadata.
 */
export declare function sanitizeHermesRouteMetadata(metadata: HermesRouteMetadata | undefined): HermesRouteMetadata | undefined;
```

<a id="symbol-providers-hermes-sanitizehermesroutesource"></a>

## sanitizeHermesRouteSource

Kind: function

```ts
export declare function sanitizeHermesRouteSource(source: HermesRouteSource | undefined): HermesRouteSource | undefined;
```

<a id="symbol-providers-hermes-startgatewaychatrun"></a>

## startGatewayChatRun

Kind: variable

```ts
export declare const startGatewayChatRun: typeof startHermesChatRun;
```

<a id="symbol-providers-hermes-startgatewaychatrunparams"></a>

## StartGatewayChatRunParams

Kind: type

```ts
export type StartGatewayChatRunParams = StartHermesChatRunParams;
```

<a id="symbol-providers-hermes-starthermeschatrun"></a>

## startHermesChatRun

Kind: function

```ts
/**
 * Starts a Hermes chat run through the configured run endpoint. Sends route binding fields in
 * both snake AND camel case for cross-version gateway compatibility. Sanitizes
 * metadata via {@link sanitizeHermesRouteMetadata} before forwarding.
 *
 * Returns the new `run_id`. Pair with {@link HermesSseRunEventProvider} or
 * {@link streamHermesChatRun} to consume the event stream.
 */
export declare function startHermesChatRun(params: StartHermesChatRunParams): Promise<{
    runId: string;
}>;
```

<a id="symbol-providers-hermes-starthermeschatrunparams"></a>

## StartHermesChatRunParams

Kind: type

```ts
export type StartHermesChatRunParams = {
    httpBase: string;
    authToken: string;
    clientId: string;
    headers?: Record<string, string>;
    input: string;
    sessionId: string;
    /** Defaults to {@link sessionId} when omitted. */
    sessionKey?: string;
    targetProfile?: string;
    targetAgent?: string;
    action?: string;
    harness?: string;
    source?: HermesRouteSource;
    /** Host-supplied default/agent channel mapping (the provider bakes in none). */
    routeChannel?: RouteChannelConfig;
    metadata?: HermesRouteMetadata;
    attachments?: readonly HermesChatRunAttachment[];
    signal?: AbortSignal;
    fetchImpl?: typeof fetch;
};
```

<a id="symbol-providers-hermes-streamgatewaychatrun"></a>

## streamGatewayChatRun

Kind: variable

```ts
export declare const streamGatewayChatRun: typeof streamHermesChatRun;
```

<a id="symbol-providers-hermes-streamgatewaychatrunparams"></a>

## StreamGatewayChatRunParams

Kind: type

```ts
export type StreamGatewayChatRunParams = StreamHermesChatRunParams;
```

<a id="symbol-providers-hermes-streamgatewaychatrunresult"></a>

## StreamGatewayChatRunResult

Kind: type

```ts
export type StreamGatewayChatRunResult = StreamHermesChatRunResult;
```

<a id="symbol-providers-hermes-streamhermeschatrun"></a>

## streamHermesChatRun

Kind: function

```ts
/**
 * Canonical orchestrator: starts a Hermes chat run, subscribes to its event
 * stream via {@link HermesSseRunEventProvider}, and optionally stitches in
 * tool events from the post-hoc run preview via
 * {@link createRunStreamWithToolFallback}. Consumers receive canonical
 * {@link RunStreamEvent}s on `onEvent` — switch on `event.event` against
 * {@link RUN_STREAM_EVENT_NAMES}, never inline strings.
 */
export declare function streamHermesChatRun(params: StreamHermesChatRunParams): Promise<StreamHermesChatRunResult>;
```

<a id="symbol-providers-hermes-streamhermeschatrunparams"></a>

## StreamHermesChatRunParams

Kind: type

```ts
export type StreamHermesChatRunParams = StartHermesChatRunParams & {
    onEvent: (event: RunStreamEvent) => void;
    /**
     * Optional snapshot fetcher — when present, composes a tool-event fallback
     * via {@link RunPreviewPollProvider} so tool calls land in the stream even
     * when the Hermes SSE doesn't surface them. Once Hermes SSE catches up on
     * tool events, the fallback becomes a no-op automatically.
     */
    fetchToolEventSnapshot?: RunPreviewSnapshotFetcher;
};
```

<a id="symbol-providers-hermes-streamhermeschatrunresult"></a>

## StreamHermesChatRunResult

Kind: type

```ts
export type StreamHermesChatRunResult = {
    /**
     * True when at least one terminal lifecycle event was observed (delta /
     * completed / failed / cancelled). Callers use this to detect a silent
     * stream (no response) and trigger a fallback transport.
     */
    sawAssistantResponseEvent: boolean;
};
```

<a id="symbol-providers-hermes-team-registry-config"></a>

## TEAM_REGISTRY_CONFIG

Kind: variable

```ts
export declare const TEAM_REGISTRY_CONFIG: TeamRegistryConfig;
```

<a id="symbol-providers-hermes-teamregistryconfig"></a>

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

<a id="symbol-providers-hermes-transformhermescapabilities"></a>

## transformHermesCapabilities

Kind: function

```ts
export declare function transformHermesCapabilities(payload: unknown, options?: TransformHermesCapabilitiesOptions): ResolvedProviderCapabilities;
```

<a id="symbol-providers-hermes-transformhermescapabilitiesoptions"></a>

## TransformHermesCapabilitiesOptions

Kind: type

```ts
export type TransformHermesCapabilitiesOptions = {
    /** Manifest team id for this gateway instance. Defaults to the provider kind. */
    teamId?: string;
};
```
