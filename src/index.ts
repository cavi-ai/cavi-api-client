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
  isValidPortalClientId,
  normalizePortalClientId,
  requirePortalClientId,
} from "./core/http/client-id.js";

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
  RawHttpApiClient,
  createRawHttpApiClient,
  toHttpRequestInit,
} from "./core/http/raw-client.js";

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
export * from "./core/gateway/error-details.js";
export * from "./core/gateway/rpc.js";
export * from "./core/gateway/runtime-targets.js";
export * from "./core/gateway/websocket.js";
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
  GATEWAY_MEDIA_API_BASE_PATH,
  GATEWAY_MEDIA_API_ENDPOINTS,
  GATEWAY_PROBE_ENDPOINTS,
  GATEWAY_WIKI_API_BASE_PATH,
  GATEWAY_WIKI_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  HERMES_MEDIA_API_ENDPOINTS,
  HERMES_WIKI_API_ENDPOINTS,
  LIBRARY_API_BASE_PATH,
  LIBRARY_API_ENDPOINTS,
  OPENCLAW_MEDIA_API_ENDPOINTS,
  OPENCLAW_WIKI_API_ENDPOINTS,
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
  GatewayMediaApiClient,
  GATEWAY_MEDIA_KINDS,
  type GatewayMediaApiClientOptions,
  type GatewayMediaAsset,
  type GatewayMediaAssetRequest,
  type GatewayMediaClient,
  type GatewayMediaEndpointMap,
  type GatewayMediaGenerateInput,
  type GatewayMediaGenerateRequest,
  type GatewayMediaGenerationResult,
  type GatewayMediaJsonValue,
  type GatewayMediaKind,
  type GatewayMediaProvider,
  type GatewayMediaProviderList,
} from "./core/gateway/media.js";

export {
  createGatewayAgentConfigClient,
  createGatewayApiClient,
  createGatewayMediaClient,
  createGatewayRpcClient,
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
  createGatewayWikiClient,
  GATEWAY_PROVIDER_ENV_KEYS,
  resolveGatewayProviderKind,
  type CreateGatewaySseRunEventProviderOptions,
  type GatewayProviderEnv,
  type GatewayProviderKind,
  type ResolveGatewayProviderOptions,
} from "./providers/gateway-provider.js";

export {
  GatewayWikiApiClient,
  GATEWAY_WIKI_FORMATS,
  type GatewayWikiApiClientOptions,
  type GatewayWikiArtifactRequest,
  type GatewayWikiClient,
  type GatewayWikiCompileRequest,
  type GatewayWikiEndpointMap,
  type GatewayWikiFormat,
  type GatewayWikiIngestRequest,
  type GatewayWikiJobResult,
  type GatewayWikiJsonValue,
  type GatewayWikiPage,
  type GatewayWikiPromoteRequest,
  type GatewayWikiTree,
  type GatewayWikiTreeEntry,
  type GatewayWikiVault,
  type GatewayWikiVaultList,
} from "./core/gateway/wiki.js";

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

export { HermesMediaApiClient } from "./providers/hermes/media.js";
export { OpenClawApiClient, type OpenClawCapabilities, type OpenClawRunStatus } from "./providers/openclaw/client.js";
export { OpenClawMediaApiClient } from "./providers/openclaw/media.js";
export { HermesWikiApiClient } from "./providers/hermes/wiki.js";
export { OpenClawWikiApiClient } from "./providers/openclaw/wiki.js";
export { HermesWebSocketClient, type HermesWebSocketClientOptions } from "./providers/hermes/websocket.js";
export { OpenClawWebSocketClient, type OpenClawWebSocketClientOptions } from "./providers/openclaw/websocket.js";

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
  type GatewaySseRunEventEndpointMap,
  type GatewaySseRunEventHeaderResolver,
  type GatewaySseRunEventPhase,
  type GatewaySseRunEventProviderOptions,
} from "./core/gateway/sse-run-event-provider.js";

export {
  HermesSseRunEventProvider,
  type HermesSseRunEventProviderOptions,
} from "./providers/hermes/sse-run-event-provider.js";

export {
  OpenClawSseRunEventProvider,
  type OpenClawSseRunEventProviderOptions,
} from "./providers/openclaw/sse-run-event-provider.js";

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

export {
  LIBRARY_CLIP_DEFAULT_TEAM,
  LIBRARY_CLIP_ENDPOINT,
  LIBRARY_CLIP_HEALTH_ENDPOINT,
  LIBRARY_CLIP_LOGS_ENDPOINT,
  LIBRARY_CLIP_SCHEMA_ENDPOINT,
  LIBRARY_CLIP_SOURCE_TAG,
  buildLibraryClipPayload,
  buildLibraryClipSchemaSnapshot,
  buildLibraryManualFileClipInput,
  postLibraryClip,
  requestLibraryClipDiagnostics,
  type LibraryClipDiagnosticsCheck,
  type LibraryClipDiagnosticsLog,
  type LibraryClipDiagnosticsSnapshot,
  type LibraryClipInput,
  type LibraryClipRequest,
  type LibraryClipResult,
  type LibraryClipSchemaField,
  type LibraryClipSchemaSnapshot,
  type LibraryClipTransport,
  type LibraryManualFileClipInput,
} from "./cavi/library/clip.js";

export { PortalApiClient, type PortalApiClientOptions } from "./cavi/portal/client.js";

export {
  MACHINE_TTS_PATH,
  MACHINE_TTS_PROVIDERS_PATH,
  buildMachineTtsVoiceOptions,
  createMachineTtsAgentVoiceAssignment,
  getMachineTtsProviderLabel,
  requestMachineTtsAudio,
  requestMachineTtsProviders,
  type MachineTtsAgentVoiceAssignment,
  type MachineTtsAudioTransport,
  type MachineTtsBlobRequester,
  type MachineTtsDashboardVoiceLike,
  type MachineTtsJsonRequester,
  type MachineTtsProviderLike,
  type MachineTtsProviderVoiceLike,
  type MachineTtsVoiceOption,
} from "./cavi/portal/machine-tts.js";

export { SURFACE_CONTRACTS, type GatewayMode, type SurfaceContract } from "./contracts/surfaces.js";
export { resolvePath } from "./contracts/resolve.js";
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
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamRoutePath,
  resolveTeamWorkspaceApiPath,
  resolveTeamWorkspacePath,
  type CreateDefaultTeamManifestOptions,
  type DefaultTeamRouteKey,
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
  type TeamManifestIdentity,
  type TeamManifestMember,
  type TeamManifestRouteConfig,
  type TeamManifestTeam,
  type TeamManifestVersion,
  type TeamRouteKey,
  type TeamWorkspaceConfig,
  type TeamWorkspacePathEntry,
} from "./contracts/team-manifest.js";
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
