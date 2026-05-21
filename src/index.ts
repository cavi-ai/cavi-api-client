export {
  HttpApiError,
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
  HTTP_API_CLIENT_ENV_ALIASES,
  HTTP_API_CLIENT_ENV_KEYS,
  resolveHttpApiConfigFromEnv,
  type HttpApiEnvSource,
  type HttpApiResolvedConfig,
  type HttpApiSurfaceConfig,
  type ResolveHttpApiConfigOptions,
} from "./core/env/config.js";

export { BaseHttpApiClient } from "./core/http/client.js";

export {
  DEFAULT_PREVIEW_MAX_CHARS,
  REDACTION_PLACEHOLDER,
  SENSITIVE_KEY_PATTERN,
  isSensitiveKey,
  redactPreviewText,
  redactSensitiveText,
  redactSensitiveValue,
  stringifyRedacted,
} from "./core/http/redaction.js";

export * from "./cavi/domain/index.js";
export * from "./core/gateway/rpc.js";
export * from "./react/gateway-provider.js";
export * from "./core/gateway/transforms.js";
export {
  createCaviControlAdapters,
  type CaviControlAdapters,
} from "./cavi/adapters/create-cavi-control-adapters.js";
export { normalizeDiscourseEvent } from "./cavi/data/cavi-control/discourse/normalize.js";

export {
  appendHttpQuery,
  CAVI_CONTROL_BASE_PATH,
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_API_ENDPOINTS,
  GATEWAY_API_ENDPOINT_TEMPLATES,
  GATEWAY_PROBE_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  LIBRARY_API_BASE_PATH,
  LIBRARY_API_ENDPOINTS,
  OPERATOR_DISPATCH_ENDPOINTS,
  resolveLibraryApiPath,
} from "./contracts/paths.js";

export {
  GLOBAL_REPO_ROOT_KEY,
  REPO_ROOT_ENV_KEY,
  requireRepoRoot,
  resolveRepoRoot,
  type RepoRootEnv,
  type ResolveRepoRootOptions,
} from "./core/env/repo-root.js";

export { CaviControlApiClient } from "./cavi/client.js";

export {
  GatewayApiClient,
  type GatewayRunAttachment,
  type GatewayRunMessage,
  type GatewayRunStartBody,
  type GatewayCapabilities,
  type GatewayRunStatus,
} from "./core/gateway/client.js";

export {
  createGatewayApiClient,
  GATEWAY_PROVIDER_ENV_KEYS,
  resolveGatewayProviderKind,
  type GatewayProviderEnv,
  type GatewayProviderKind,
  type ResolveGatewayProviderOptions,
} from "./providers/gateway-provider.js";

export {
  createTeamRegistry,
  createTeamRegistryFromSnapshot,
  getTeamLookupKeys,
  matchesTeamIdentifier,
  normalizeTeamLookupValue,
  normalizeTeamRegistryTeam,
  resolveTeamFromCollection,
  type CreateTeamRegistryOptions,
  type TeamRegistry,
  type TeamRegistryConfig,
  type TeamRegistryLibraryConfig,
  type TeamRegistryLibraryRefConfig,
  type TeamRegistryProviderKind,
  type TeamRegistryTeamConfig,
} from "./cavi/registry/team-registry.js";

export {
  TEAM_REGISTRY_CONFIG,
  configureTeamRegistryConfig,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
} from "./cavi/registry/team-registry-config.js";

export { createHermesTeamRegistry } from "./providers/hermes/team-registry.js";
export { createOpenClawTeamRegistry } from "./providers/openclaw/team-registry.js";

export {
  HermesApiClient,
  type HermesCapabilities,
  type HermesRunStatus,
} from "./providers/hermes/client.js";

export {
  HERMES_HTTP_API_ENV_ALIASES,
  HERMES_HTTP_API_ENV_KEYS,
  resolveHermesHttpApiConfigFromEnv,
  type ResolveHermesHttpApiConfigOptions,
} from "./providers/hermes/env-config.js";

export {
  RunPreviewPollProvider,
  composeRunEventProviders,
  createRunStreamWithToolFallback,
  type CreateRunStreamWithToolFallbackOptions,
  type RunEventStreamHandlers,
  type RunEventStreamProvider,
  type RunEventStreamSubscribeParams,
  type RunEventStreamSubscription,
  type RunPreviewPollProviderOptions,
  type RunPreviewSnapshotFetcher,
} from "./core/gateway/run-event-stream.js";

export {
  GatewaySseRunEventProvider,
  HermesSseRunEventProvider,
  type GatewaySseRunEventProviderOptions,
  type HermesSseRunEventProviderOptions,
} from "./providers/hermes/sse-run-event-provider.js";

export {
  resolveGatewayChatRunApproval,
  resolveHermesChatRunApproval,
  sanitizeGatewayRouteMetadata,
  sanitizeHermesRouteMetadata,
  startGatewayChatRun,
  startHermesChatRun,
  streamGatewayChatRun,
  streamHermesChatRun,
  type GatewayChatRunAttachment,
  type GatewayRouteMetadata,
  type ResolveGatewayChatRunApprovalParams,
  type StartGatewayChatRunParams,
  type StreamGatewayChatRunParams,
  type StreamGatewayChatRunResult,
  type HermesChatRunAttachment,
  type HermesRouteMetadata,
  type ResolveHermesChatRunApprovalParams,
  type StartHermesChatRunParams,
  type StreamHermesChatRunParams,
  type StreamHermesChatRunResult,
} from "./providers/hermes/chat-run.js";

export {
  LibraryApiClient,
  type LibraryIngestRequest,
  type LibraryIngestResult,
  type LibraryIngestSource,
} from "./cavi/library/client.js";

export { PortalApiClient, type PortalApiClientOptions } from "./cavi/portal/client.js";

export { SURFACE_CONTRACTS, type GatewayMode, type SurfaceContract } from "./contracts/surfaces.js";
export { resolvePath } from "./contracts/resolve.js";
export {
  PORTAL_DASHBOARD_IDS,
  isPortalDashboardId,
  portalDashboardPath,
  type PortalDashboardId,
} from "./contracts/portals.js";
export {
  GATEWAY_KANBAN_BOARD_PATH,
  GATEWAY_KANBAN_TASKS_PATH,
  GATEWAY_WS_PATH,
  HERMES_KANBAN_BOARD_PATH,
  HERMES_KANBAN_TASKS_PATH,
  HERMES_WS_PATH,
  MOBILE_GATEWAY_ENDPOINT_CONTRACTS,
  createContractGap,
  getMobileGatewayEndpointContract,
  getMobileGatewayEndpointPath,
  resolveOperatorTaskDispatchContract,
  resolveOperatorTaskDispatchPath,
  type GatewayTargets,
  type HermesGatewayTargets,
  type MobileGatewayContractGap,
  type MobileGatewayEndpointContract,
  type MobileGatewaySurfaceClass,
  type MobileGatewaySurfaceKey,
  type OperatorTaskDispatchMode,
} from "./contracts/mobile.js";
