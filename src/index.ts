// @cavi-ai/api-client — root entry (2.x curated stable API).
//
// Providers, the CAVI extension, framework bindings, and low-level core
// primitives are intentionally NOT re-exported here. Import them from their
// subpaths: ./providers/{hermes,openclaw,claude} · ./extensions/cavi ·
// ./frameworks/react · ./core/http · ./core/sse · ./core/ws · ./core/data ·
// ./core/env · ./core/gateway. See MIGRATION.md.

// ── Errors & guards (universal) ──────────────────────────────────────────────
export {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
  getErrorCode,
  getErrorMessage,
  getErrorStatus,
  getErrorType,
  isAbortError,
  isAuthError,
  isEndpointNotFoundError,
  serializeError,
  stringifyUnknownError,
  toError,
  type ApiClientErrorOptions,
  type SerializedApiClientError,
} from "./core/errors.js";
export {
  HttpApiError,
  isHttpApiError,
  IDEMPOTENCY_KEY_HEADER,
  PORTAL_CLIENT_ID_HEADER,
  type HttpApiClientAuth,
  type HttpApiClientOptions,
  type HttpApiClientSurface,
  type HttpApiHttpMethod,
  type HttpApiRequestInit,
  type HttpApiTrace,
  type HttpApiTransport,
} from "./core/http/types.js";
export {
  GatewayHttpError,
  buildGatewayHttpError,
  isGatewayHttpError,
} from "./core/http/gateway-error.js";

// ── Auth seam (construct any provider) ───────────────────────────────────────
export {
  bearerCredentials,
  apiKeyCredentials,
  type CredentialResolver,
  type CredentialHeaders,
  type ApiKeyCredentialOptions,
} from "./core/http/credentials.js";

// ── Universal runtime contract ───────────────────────────────────────────────
export * from "./core/runtime/paths.js";
export {
  RUNTIME_SURFACES,
  runtimeSupports,
  type RuntimeCapabilities,
  type RuntimeSurface,
} from "./core/runtime/capabilities.js";
export {
  type RuntimeRunStartBody,
  type RuntimeRunStatus,
  type RuntimeRunMessage,
  type RuntimeRunInput,
  type RuntimeRunState,
} from "./core/runtime/run.js";
export {
  estimateUsageCost,
  normalizeRuntimeUsage,
  type RuntimeUsage,
  type TokenPrices,
} from "./core/runtime/usage.js";
export {
  buildDryRunStatus,
  buildDryRunStreamEvent,
} from "./core/runtime/dry-run.js";
export {
  type RuntimeBatchRequest,
  type RuntimeBatchStatus,
  type RuntimeBatchResult,
  type RuntimeBatchCounts,
  type RuntimeBatchState,
  type RuntimeBatchOutcome,
} from "./core/runtime/batch.js";
export { unsupportedRuntimeSurface, type RuntimeClient } from "./core/runtime/client.js";
export {
  createRuntimeClient,
  normalizeRuntimeProviderToken,
  type CreateRuntimeClientOptions,
  type RuntimeClientOptions,
  type RuntimeProviderRegistry,
} from "./core/runtime/providers/index.js";
export {
  checkProtocolVersion,
  assertProtocolVersion,
  type ProtocolVersionCheck,
  type ProtocolVersionCarrier,
} from "./core/runtime/protocol.js";

// ── Graceful degradation ─────────────────────────────────────────────────────
export * from "./core/gateway/envelope/index.js";

// ── Unified gateway client ───────────────────────────────────────────────────
export {
  GatewayApiClient,
  type GatewayRunAttachment,
  type GatewayRunMessage,
  type GatewayRunStartBody,
  type GatewayCapabilities,
  type GatewayRunStatus,
} from "./core/gateway/client/client.js";

// ── Canonical run-stream contract (real-time data-in) ────────────────────────
export {
  RUN_STREAM_EVENT_NAMES,
  RunPreviewPollProvider,
  composeRunEventProviders,
  createRunStreamWithToolFallback,
  type AgentRun,
  type AgentRunDetailSnapshot,
  type CreateRunStreamWithToolFallbackOptions,
  type RunStreamEvent,
  type RunStreamEventName,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
  type RunPreviewPollProviderOptions,
  type RunPreviewSnapshotFetcher,
} from "./core/gateway/run/index.js";

// ── Provider registry & factories ────────────────────────────────────────────
export {
  createGatewayAgentConfigClient,
  createGatewayApiClient,
  createGatewayMediaClient,
  createGatewayProviderRegistry,
  createProviderRegistry,
  createRuntimeProviderRegistry,
  createGatewayRpcClient,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  GATEWAY_PROVIDER_ENV_KEYS,
  normalizeGatewayProviderToken,
  resolveGatewayProviderKind,
  resolveGatewayProviderModule,
  type CreateGatewaySseRunEventProviderOptions,
  type CreateGatewayProviderRegistryOptions,
  type CreateProviderRegistryOptions,
  type GatewayProviderEnv,
  type GatewayProviderFactories,
  type GatewayProviderKind,
  type GatewayProviderModule,
  type GatewayProviderRegistry,
  type ProviderRegistry,
  type RuntimeProviderModule,
  type ResolveGatewayProviderOptions,
} from "./core/gateway/providers/index.js";

// ── Contracts (global path & manifest layer) ─────────────────────────────────
export {
  appendHttpQuery,
  assertSafeRelativePath,
  GATEWAY_API_ENDPOINTS,
  GATEWAY_API_ENDPOINT_TEMPLATES,
  GATEWAY_MEDIA_API_BASE_PATH,
  GATEWAY_MEDIA_API_ENDPOINTS,
  GATEWAY_PROBE_ENDPOINTS,
  GATEWAY_SYSTEM_RPC_METHODS,
  GATEWAY_WIKI_API_BASE_PATH,
  GATEWAY_WIKI_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  HERMES_MEDIA_API_ENDPOINTS,
  HERMES_WIKI_API_ENDPOINTS,
} from "./contracts/paths.js";
export { SURFACE_CONTRACTS, type SurfaceContract } from "./contracts/surfaces.js";
export {
  createSurfacePathResolver,
  resolvePath,
  resolveSurfaceContractPath,
  type SurfaceContractMap,
  type SurfacePathResolver,
} from "./contracts/resolve.js";
export {
  createStaticManifestSource,
  createCachedManifestSource,
  type TeamManifestSource,
  type CachedTeamManifestSource,
  type TeamManifestInput,
  type TeamManifestLoader,
} from "./contracts/manifest-source.js";
export {
  createTeamRouteResolver,
  type TeamRouteResolver,
} from "./contracts/route-resolver.js";
export {
  DEFAULT_TEAM_ID,
  DEFAULT_TEAM_MEMBER_ID,
  DEFAULT_TEAM_ROUTE_KEYS,
  TEAM_MANIFEST_VERSION,
  TEAM_ACTION_INPUT_MODES,
  TEAM_ACTION_OUTPUT_MODES,
  createDefaultTeamManifest,
  findTeamActionContract,
  findTeamManifestMember,
  findTeamManifestTeam,
  normalizeTeamManifest,
  resolveGatewayRouteBinding,
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamRoutePath,
  resolveTeamWorkspaceApiPath,
  resolveTeamWorkspacePath,
  type CreateDefaultTeamManifestOptions,
  type DefaultTeamRouteKey,
  type GatewayResolvedRouteBinding,
  type GatewayRouteBinding,
  type ResolveGatewayRouteBindingOptions,
  type ResolveTeamActionContractOptions,
  type ResolveTeamRoutePathOptions,
  type ResolveTeamWorkspacePathOptions,
  type TeamActionArtifact,
  type TeamActionArtifactContract,
  type TeamActionContract,
  type TeamActionHttpMethod,
  type TeamActionInputContract,
  type TeamActionInputMode,
  type TeamActionJsonValue,
  type TeamActionOutputContract,
  type TeamActionOutputMode,
  type TeamActionParamContract,
  type TeamActionParamType,
  type TeamActionResponse,
  type TeamActionResponseBase,
  type TeamActionRouteContract,
  type TeamManifest,
  type ManifestIdentity,
  type ManifestMember,
  type ManifestRouteConfig,
  type ManifestTeam,
  type TeamManifestVersion,
  type TeamRouteKey,
  type TeamWorkspaceConfig,
  type TeamWorkspacePathEntry,
} from "./contracts/team-manifest.js";

// ── Repo root (filesystem integrations) ──────────────────────────────────────
export {
  GLOBAL_REPO_ROOT_KEY,
  REPO_ROOT_ENV_KEY,
  requireRepoRoot,
  resolveRepoRoot,
  type RepoRootEnv,
  type ResolveRepoRootOptions,
} from "./core/env/repo-root.js";
