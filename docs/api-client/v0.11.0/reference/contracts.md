# @cavi-ai/api-client/contracts

Package subpath: ./contracts

<a id="symbol-contracts-appendhttpquery"></a>

## appendHttpQuery

Kind: function

```ts
export declare function appendHttpQuery(path: string, query?: Record<string, string | number | boolean | undefined>): string;
```

<a id="symbol-contracts-assertsaferelativepath"></a>

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

<a id="symbol-contracts-cachedteammanifestsource"></a>

## CachedTeamManifestSource

Kind: interface

```ts
export interface CachedTeamManifestSource extends TeamManifestSource {
    /** Re-run the loader and replace the cached manifest. */
    refresh(): Promise<TeamManifest>;
}
```

<a id="symbol-contracts-createcachedmanifestsource"></a>

## createCachedManifestSource

Kind: function

```ts
/**
 * A manifest fetched via a loader (e.g. from a gateway). Cached after first
 * load; call refresh() to revalidate.
 */
export declare function createCachedManifestSource(loader: TeamManifestLoader): CachedTeamManifestSource;
```

<a id="symbol-contracts-createdefaultteammanifest"></a>

## createDefaultTeamManifest

Kind: function

```ts
export declare function createDefaultTeamManifest(options?: CreateDefaultTeamManifestOptions): TeamManifest;
```

<a id="symbol-contracts-createdefaultteammanifestoptions"></a>

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

<a id="symbol-contracts-createstaticmanifestsource"></a>

## createStaticManifestSource

Kind: function

```ts
/** A fixed, host-provided manifest. Normalized once. */
export declare function createStaticManifestSource(manifest: TeamManifestInput): TeamManifestSource;
```

<a id="symbol-contracts-createsurfacepathresolver"></a>

## createSurfacePathResolver

Kind: function

```ts
export declare function createSurfacePathResolver(extensionContracts?: SurfaceContractMap, baseResolver?: SurfacePathResolver): SurfacePathResolver;
```

<a id="symbol-contracts-createteamrouteresolver"></a>

## createTeamRouteResolver

Kind: function

```ts
export declare function createTeamRouteResolver(): TeamRouteResolver;
```

<a id="symbol-contracts-default-team-id"></a>

## DEFAULT_TEAM_ID

Kind: variable

```ts
export declare const DEFAULT_TEAM_ID: "default";
```

<a id="symbol-contracts-default-team-member-id"></a>

## DEFAULT_TEAM_MEMBER_ID

Kind: variable

```ts
export declare const DEFAULT_TEAM_MEMBER_ID: "default-agent";
```

<a id="symbol-contracts-default-team-route-keys"></a>

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

<a id="symbol-contracts-defaultteamroutekey"></a>

## DefaultTeamRouteKey

Kind: type

```ts
export type DefaultTeamRouteKey = (typeof DEFAULT_TEAM_ROUTE_KEYS)[number];
```

<a id="symbol-contracts-findteamactioncontract"></a>

## findTeamActionContract

Kind: function

```ts
export declare function findTeamActionContract(actions: readonly TeamActionContract[] | null | undefined, actionId: string | null | undefined): TeamActionContract | null;
```

<a id="symbol-contracts-findteammanifestmember"></a>

## findTeamManifestMember

Kind: function

```ts
export declare function findTeamManifestMember(team: ManifestTeam, memberId: string | null | undefined): ManifestMember | null;
```

<a id="symbol-contracts-findteammanifestteam"></a>

## findTeamManifestTeam

Kind: function

```ts
export declare function findTeamManifestTeam(manifest: TeamManifest, teamId: string | null | undefined): ManifestTeam | null;
```

<a id="symbol-contracts-gateway-agent-config-api-endpoints"></a>

## GATEWAY_AGENT_CONFIG_API_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_AGENT_CONFIG_API_ENDPOINTS: {
    readonly profiles: "/api/profiles";
    readonly config: "/api/config";
    readonly configDefaults: "/api/config/defaults";
    readonly configSchema: "/api/config/schema";
    readonly agentConfigs: "/api/agent-configs";
    readonly agentConfig: (agentId: string) => string;
};
```

<a id="symbol-contracts-gateway-api-endpoint-templates"></a>

## GATEWAY_API_ENDPOINT_TEMPLATES

Kind: variable

```ts
export declare const GATEWAY_API_ENDPOINT_TEMPLATES: {
    readonly ecgSharedFiles: "/api/v1/files?agent={agent}&folder={folder}";
    readonly runApproval: "/v1/runs/{run_id}/approval";
};
```

<a id="symbol-contracts-gateway-api-endpoints"></a>

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

<a id="symbol-contracts-gateway-media-api-base-path"></a>

## GATEWAY_MEDIA_API_BASE_PATH

Kind: variable

```ts
export declare const GATEWAY_MEDIA_API_BASE_PATH: "/v1/media";
```

<a id="symbol-contracts-gateway-media-api-endpoints"></a>

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

<a id="symbol-contracts-gateway-portal-api-endpoints"></a>

## GATEWAY_PORTAL_API_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_PORTAL_API_ENDPOINTS: {
    readonly config: (portalSlug: string) => string;
};
```

<a id="symbol-contracts-gateway-probe-endpoints"></a>

## GATEWAY_PROBE_ENDPOINTS

Kind: variable

```ts
export declare const GATEWAY_PROBE_ENDPOINTS: {
    readonly health: "/health";
    readonly healthz: "/healthz";
    readonly readyz: "/readyz";
};
```

<a id="symbol-contracts-gateway-session-api-paths"></a>

## GATEWAY_SESSION_API_PATHS

Kind: variable

```ts
export declare const GATEWAY_SESSION_API_PATHS: {
    readonly list: "/api/sessions/list";
    readonly usage: "/api/sessions/usage";
    readonly preview: "/api/sessions/preview";
    readonly detail: "/api/sessions/detail";
    readonly patch: "/api/sessions/patch";
};
```

<a id="symbol-contracts-gateway-system-rpc-methods"></a>

## GATEWAY_SYSTEM_RPC_METHODS

Kind: variable

```ts
export declare const GATEWAY_SYSTEM_RPC_METHODS: {
    readonly healthSnapshot: "health.snapshot";
    readonly health: "health";
    readonly logsTail: "logs.tail";
};
```

<a id="symbol-contracts-gateway-wiki-api-base-path"></a>

## GATEWAY_WIKI_API_BASE_PATH

Kind: variable

```ts
export declare const GATEWAY_WIKI_API_BASE_PATH: "/v1/wiki";
```

<a id="symbol-contracts-gateway-wiki-api-endpoints"></a>

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

<a id="symbol-contracts-gatewayresolvedroutebinding"></a>

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

<a id="symbol-contracts-gatewayroutebinding"></a>

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

<a id="symbol-contracts-hermes-agent-config-api-endpoints"></a>

## HERMES_AGENT_CONFIG_API_ENDPOINTS

Kind: variable

```ts
export declare const HERMES_AGENT_CONFIG_API_ENDPOINTS: {
    readonly profiles: "/api/profiles";
    readonly config: "/api/config";
    readonly configDefaults: "/api/config/defaults";
    readonly configSchema: "/api/config/schema";
    readonly agentConfigs: "/api/agent-configs";
    readonly agentConfig: (agentId: string) => string;
};
```

<a id="symbol-contracts-hermes-api-endpoint-templates"></a>

## HERMES_API_ENDPOINT_TEMPLATES

Kind: variable

```ts
export declare const HERMES_API_ENDPOINT_TEMPLATES: {
    readonly ecgSharedFiles: "/api/v1/files?agent={agent}&folder={folder}";
    readonly runApproval: "/v1/runs/{run_id}/approval";
};
```

<a id="symbol-contracts-hermes-api-endpoints"></a>

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

<a id="symbol-contracts-hermes-media-api-endpoints"></a>

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

<a id="symbol-contracts-hermes-wiki-api-endpoints"></a>

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

<a id="symbol-contracts-manifestidentity"></a>

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

<a id="symbol-contracts-manifestmember"></a>

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

<a id="symbol-contracts-manifestrouteconfig"></a>

## ManifestRouteConfig

Kind: type

```ts
export type ManifestRouteConfig = {
    key: string;
    path?: string | null;
};
```

<a id="symbol-contracts-manifestteam"></a>

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

<a id="symbol-contracts-normalizeteammanifest"></a>

## normalizeTeamManifest

Kind: function

```ts
export declare function normalizeTeamManifest(manifest: Partial<TeamManifest> | null | undefined): TeamManifest;
```

<a id="symbol-contracts-resolvegatewayroutebinding"></a>

## resolveGatewayRouteBinding

Kind: function

```ts
export declare function resolveGatewayRouteBinding(manifest: TeamManifest, options: ResolveGatewayRouteBindingOptions): GatewayResolvedRouteBinding | null;
```

<a id="symbol-contracts-resolvegatewayroutebindingoptions"></a>

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

<a id="symbol-contracts-resolvepath"></a>

## resolvePath

Kind: function

```ts
export declare function resolvePath(key: string, params?: Record<string, string>): string;
```

<a id="symbol-contracts-resolvesurfacecontractpath"></a>

## resolveSurfaceContractPath

Kind: function

```ts
export declare function resolveSurfaceContractPath(contract: SurfaceContract, params?: Record<string, string>): string;
```

<a id="symbol-contracts-resolveteamactionapipath"></a>

## resolveTeamActionApiPath

Kind: function

```ts
export declare function resolveTeamActionApiPath(manifest: TeamManifest, teamId: string | null | undefined, actionId: string | null | undefined, options?: ResolveTeamActionContractOptions): string;
```

<a id="symbol-contracts-resolveteamactioncontract"></a>

## resolveTeamActionContract

Kind: function

```ts
export declare function resolveTeamActionContract(manifest: TeamManifest, teamId: string | null | undefined, actionId: string | null | undefined, options?: ResolveTeamActionContractOptions): TeamActionContract;
```

<a id="symbol-contracts-resolveteamactioncontractoptions"></a>

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

<a id="symbol-contracts-resolveteamroutepath"></a>

## resolveTeamRoutePath

Kind: function

```ts
export declare function resolveTeamRoutePath(routeKey: TeamRouteKey, options: ResolveTeamRoutePathOptions): string;
```

<a id="symbol-contracts-resolveteamroutepathoptions"></a>

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

<a id="symbol-contracts-resolveteamworkspaceapipath"></a>

## resolveTeamWorkspaceApiPath

Kind: function

```ts
export declare function resolveTeamWorkspaceApiPath(team: ManifestTeam, keyOrPath: string, options?: ResolveTeamWorkspacePathOptions): string;
```

<a id="symbol-contracts-resolveteamworkspacepath"></a>

## resolveTeamWorkspacePath

Kind: function

```ts
export declare function resolveTeamWorkspacePath(team: ManifestTeam, keyOrPath: string, options?: ResolveTeamWorkspacePathOptions): string;
```

<a id="symbol-contracts-resolveteamworkspacepathoptions"></a>

## ResolveTeamWorkspacePathOptions

Kind: type

```ts
export type ResolveTeamWorkspacePathOptions = {
    memberId?: string | null;
};
```

<a id="symbol-contracts-surface-contracts"></a>

## SURFACE_CONTRACTS

Kind: variable

```ts
export declare const SURFACE_CONTRACTS: Record<string, SurfaceContract>;
```

<a id="symbol-contracts-surfacecontract"></a>

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

<a id="symbol-contracts-surfacecontractmap"></a>

## SurfaceContractMap

Kind: type

```ts
export type SurfaceContractMap = Record<string, SurfaceContract>;
```

<a id="symbol-contracts-surfacepathresolver"></a>

## SurfacePathResolver

Kind: type

```ts
export type SurfacePathResolver = (key: string, params?: Record<string, string>) => string;
```

<a id="symbol-contracts-team-action-input-modes"></a>

## TEAM_ACTION_INPUT_MODES

Kind: variable

```ts
export declare const TEAM_ACTION_INPUT_MODES: readonly [
    "command",
    "json",
    "text"
];
```

<a id="symbol-contracts-team-action-output-modes"></a>

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

<a id="symbol-contracts-team-manifest-version"></a>

## TEAM_MANIFEST_VERSION

Kind: variable

```ts
export declare const TEAM_MANIFEST_VERSION: 1;
```

<a id="symbol-contracts-teamactionartifact"></a>

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

<a id="symbol-contracts-teamactionartifactcontract"></a>

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

<a id="symbol-contracts-teamactioncontract"></a>

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

<a id="symbol-contracts-teamactionhttpmethod"></a>

## TeamActionHttpMethod

Kind: type

```ts
export type TeamActionHttpMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";
```

<a id="symbol-contracts-teamactioninputcontract"></a>

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

<a id="symbol-contracts-teamactioninputmode"></a>

## TeamActionInputMode

Kind: type

```ts
export type TeamActionInputMode = (typeof TEAM_ACTION_INPUT_MODES)[number];
```

<a id="symbol-contracts-teamactionjsonvalue"></a>

## TeamActionJsonValue

Kind: type

```ts
export type TeamActionJsonValue = string | number | boolean | null | readonly TeamActionJsonValue[] | {
    readonly [key: string]: TeamActionJsonValue;
};
```

<a id="symbol-contracts-teamactionoutputcontract"></a>

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

<a id="symbol-contracts-teamactionoutputmode"></a>

## TeamActionOutputMode

Kind: type

```ts
export type TeamActionOutputMode = (typeof TEAM_ACTION_OUTPUT_MODES)[number];
```

<a id="symbol-contracts-teamactionparamcontract"></a>

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

<a id="symbol-contracts-teamactionparamtype"></a>

## TeamActionParamType

Kind: type

```ts
export type TeamActionParamType = "boolean" | "enum" | "file" | "json" | "number" | "string";
```

<a id="symbol-contracts-teamactionresponse"></a>

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

<a id="symbol-contracts-teamactionresponsebase"></a>

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

<a id="symbol-contracts-teamactionroutecontract"></a>

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

<a id="symbol-contracts-teammanifest"></a>

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

<a id="symbol-contracts-teammanifestinput"></a>

## TeamManifestInput

Kind: type

```ts
export type TeamManifestInput = Partial<TeamManifest> | null | undefined;
```

<a id="symbol-contracts-teammanifestloader"></a>

## TeamManifestLoader

Kind: type

```ts
export type TeamManifestLoader = () => TeamManifestInput | Promise<TeamManifestInput>;
```

<a id="symbol-contracts-teammanifestsource"></a>

## TeamManifestSource

Kind: interface

```ts
/** The seam through which a host supplies its manifest to the package. */
export interface TeamManifestSource {
    getManifest(): Promise<TeamManifest>;
}
```

<a id="symbol-contracts-teammanifestversion"></a>

## TeamManifestVersion

Kind: type

```ts
export type TeamManifestVersion = typeof TEAM_MANIFEST_VERSION;
```

<a id="symbol-contracts-teamroutekey"></a>

## TeamRouteKey

Kind: type

```ts
export type TeamRouteKey = DefaultTeamRouteKey | "action" | "agent.action" | "agent.config" | "agent.workspace" | (string & {});
```

<a id="symbol-contracts-teamrouteresolver"></a>

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

<a id="symbol-contracts-teamworkspaceconfig"></a>

## TeamWorkspaceConfig

Kind: type

```ts
export type TeamWorkspaceConfig = {
    rootPath: string;
    paths?: readonly TeamWorkspacePathEntry[] | null;
};
```

<a id="symbol-contracts-teamworkspacepathentry"></a>

## TeamWorkspacePathEntry

Kind: type

```ts
export type TeamWorkspacePathEntry = string | {
    key: string;
    path?: string | null;
};
```
