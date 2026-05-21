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
} from "./types.js";

export {
  HTTP_API_CLIENT_ENV_ALIASES,
  HTTP_API_CLIENT_ENV_KEYS,
  resolveHttpApiConfigFromEnv,
  type HttpApiEnvSource,
  type HttpApiResolvedConfig,
  type HttpApiSurfaceConfig,
  type ResolveHttpApiConfigOptions,
} from "./config.js";

export { BaseHttpApiClient } from "./base-client.js";

export * from "./domain/index.js";
export * from "./gateway/index.js";
export * from "./gateway/react.js";
export * from "./gateway-transforms/index.js";
export {
  createCaviControlAdapters,
  type CaviControlAdapters,
} from "./data/create-cavi-control-adapters.js";
export { normalizeDiscourseEvent } from "./data/cavi-control/discourse/normalize.js";

export {
  appendHttpQuery,
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_API_ENDPOINTS,
  GATEWAY_API_ENDPOINT_TEMPLATES,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  LIBRARY_API_BASE_PATH,
  LIBRARY_API_ENDPOINTS,
  resolveLibraryApiPath,
} from "./paths.js";

export {
  GLOBAL_REPO_ROOT_KEY,
  REPO_ROOT_ENV_KEY,
  requireRepoRoot,
  resolveRepoRoot,
  type RepoRootEnv,
  type ResolveRepoRootOptions,
} from "./repo-root.js";

export { CaviControlApiClient } from "./cavi-control-client.js";

export {
  GatewayApiClient,
  HermesApiClient,
  type GatewayCapabilities,
  type GatewayRunStatus,
  type HermesCapabilities,
  type HermesRunStatus,
} from "./hermes-client.js";

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
} from "./run-event-stream.js";

export {
  HermesSseRunEventProvider,
  type HermesSseRunEventProviderOptions,
} from "./hermes-sse-provider.js";

export {
  resolveHermesChatRunApproval,
  sanitizeHermesRouteMetadata,
  startHermesChatRun,
  streamHermesChatRun,
  type HermesChatRunAttachment,
  type HermesRouteMetadata,
  type ResolveHermesChatRunApprovalParams,
  type StartHermesChatRunParams,
  type StreamHermesChatRunParams,
  type StreamHermesChatRunResult,
} from "./hermes-chat-run.js";

export {
  LibraryApiClient,
  type LibraryIngestRequest,
  type LibraryIngestResult,
  type LibraryIngestSource,
} from "./library-client.js";

export { PortalApiClient, type PortalApiClientOptions } from "./portal-client.js";

export { SURFACE_CONTRACTS, type GatewayMode, type SurfaceContract } from "./surface-paths.js";
export { resolvePath } from "./resolve.js";
export {
  PORTAL_DASHBOARD_IDS,
  isPortalDashboardId,
  portalDashboardPath,
  type PortalDashboardId,
} from "./portal-paths.js";
export {
  MARTINA_RUN_DISPATCH_LABEL,
  martinaRunDispatchLabel,
  normalizeMartinaRunStatus,
  type MartinaRunStatus,
} from "./martina-runs.js";
export {
  MARTINA_REMOTE_POLICY_KEYS,
  MARTINA_DOCTOR_COMMAND_PRESETS,
  ENUM_CANDIDATE_SETS,
  humanizeKey,
  isRecord,
  isPrimitive,
  isSimpleArray,
  isEditableValue,
  parseListValue,
  isMultilineString,
  inferSelectOptions,
  isMartinaCommandModifierKey,
  mergeDoctorCommandOptions,
  serializeRemotePolicyValue,
  deserializeRemotePolicyValue,
  remotePolicySelectItems,
  inferMartinaConfigFieldKind,
  type MartinaConfigFieldKind,
} from "./martina-config.js";

export {
  CAVI_TEAM_PORTAL_IDS,
  configureCanonicalOperatorRegistry,
  getPortalTeamCode,
  getPortalTeamIdentity,
  resetCanonicalOperatorRegistry,
  type CaviTeamPortalId,
} from "./data/lib/canonical-team-registry.js";
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
} from "./mobile-gateway-contracts.js";
