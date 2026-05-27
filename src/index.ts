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
  isValidPortalClientId,
  normalizePortalClientId,
  requirePortalClientId,
} from "./core/http/client-id.js";

export {
  resolveHttpSurfaceConfigFromEnv,
  type HttpApiEnvSource,
  type HttpApiSurfaceConfig,
  type HttpSurfaceEnvSpec,
  type HttpSurfaceEnvKeys,
  type HttpSurfaceEnvAliases,
  type HttpSurfaceEnvFallback,
  type ResolveHttpSurfaceConfigOptions,
} from "./core/env/config.js";

// CAVI surface composition (cavi/gateway/library env vars + CAVI defaults) lives
// in extensions/cavi; core stays surface-agnostic. Re-exported here under the
// same names the root entry has always used.
export {
  HTTP_API_CLIENT_ENV_ALIASES,
  HTTP_API_CLIENT_ENV_KEYS,
  resolveHttpApiConfigFromEnv,
  type HttpApiResolvedConfig,
  type ResolveHttpApiConfigOptions,
} from "./extensions/cavi/runtime/env-config.js";

export { BaseHttpApiClient } from "./core/http/client.js";
export {
  RawHttpApiClient,
  createRawHttpApiClient,
  toHttpRequestInit,
} from "./core/http/raw-client.js";
export {
  GatewayHttpError,
  buildGatewayHttpError,
  isGatewayHttpError,
} from "./core/http/gateway-error.js";
export {
  JsonHttpApiClient,
  createJsonHttpRequest,
  withQuery,
  type JsonHttpRequest,
} from "./core/http/json-client.js";
export { describeHttpContract } from "./core/http/contracts.js";
export * from "./core/data/guards.js";
export * from "./core/runtime/paths.js";

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

export * from "./core/gateway/envelope/index.js";
export * from "./core/gateway/client/error-details.js";
export {
  buildGatewayAuthHeaders,
  fetchGatewayBlob,
  fetchGatewayExpectOk,
  fetchGatewayFormDataJson,
  fetchGatewayJson,
  requestGatewayRaw,
  resolveGatewayRequestCredentials,
  type GatewayHttpFetchOptions,
} from "./core/gateway/client/fetch.js";
export * from "./core/gateway/rpc/index.js";
export * from "./core/gateway/client/runtime-targets.js";
export * from "./core/gateway/snapshots/loaders.js";
export * from "./core/sse/index.js";
export * from "./core/ws/index.js";
// NOTE: React hooks/provider are intentionally NOT re-exported here. They live
// behind the optional `react` peer dependency and are reachable only via the
// "@cavi-ai/api-client/frameworks/react" subpath, so importing the root entry never pulls
// React into a non-React consumer's module graph.
export * from "./core/gateway/snapshots/transforms.js";
export {
  createCaviControlAdapters,
  type CaviControlAdapters,
} from "./extensions/cavi/adapters/create-cavi-control-adapters.js";
export {
  createCaviControlAdapterFallbackProvider,
  createCaviSnapshotFallbackProvider,
  type CaviControlAdapterFallbackProvider,
  type CaviControlAdapterFallbacks,
} from "./extensions/cavi/fallbacks/provider.js";
export {
  type CaviSnapshotFallbackMode,
  type CreateGatewayWsSnapshotLoadersOptions,
} from "./extensions/cavi/adapters/cavi-control-adapters/gateway-ws-snapshot-loaders.js";
export { normalizeDiscourseEvent } from "./extensions/cavi/discourse/normalize.js";
export { withCaviControlOperatorCapabilities } from "./extensions/cavi/operator-control/capabilities.js";

export {
  API_PROJECT_BOARD,
  API_OPERATOR,
  API_OPERATOR_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_OPERATOR_API_BASE,
  CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
  OPERATOR_API,
  OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE,
  PROJECT_BOARD_API,
  appendCaviApiPath,
  operatorControlExpectedContractSummary,
  operatorTaskDiscoursePluginAliasPath,
  operatorTaskDiscoursePath,
  projectBoardBacklogItemPath,
  projectBoardWorkspaceDiagnosticRouteHint,
  projectBoardWorkspaceExpectedContractSummary,
  CAVI_CONTROL_BASE_PATH,
  CAVI_CONTROL_API_ENDPOINTS,
  LIBRARY_API_BASE_PATH,
  LIBRARY_API_ENDPOINTS,
  OPERATOR_DISPATCH_ENDPOINTS,
  resolveLibraryApiPath,
  resolvePortalApiPath,
  type CaviApiPathAppendOptions,
} from "./extensions/cavi/contracts/paths.js";

export {
  appendHttpQuery,
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
  OPENCLAW_CORE_RPC_METHODS,
  OPENCLAW_RPC_METHODS,
  OPENCLAW_MEDIA_API_ENDPOINTS,
  OPENCLAW_WIKI_API_ENDPOINTS,
} from "./contracts/paths.js";

export {
  GLOBAL_REPO_ROOT_KEY,
  REPO_ROOT_ENV_KEY,
  requireRepoRoot,
  resolveRepoRoot,
  type RepoRootEnv,
  type ResolveRepoRootOptions,
} from "./core/env/repo-root.js";

export { CaviControlApiClient } from "./extensions/cavi/client.js";

export {
  GatewayApiClient,
  type GatewayRunAttachment,
  type GatewayRunMessage,
  type GatewayRunStartBody,
  type GatewayCapabilities,
  type GatewayRunStatus,
} from "./core/gateway/client/client.js";

export {
  gatewaySupportsAction,
  gatewaySupportsMediaKind,
  gatewaySupportsRpcMethod,
  gatewaySupportsTextToSpeech,
  normalizeGatewayFeatureCapabilities,
  type GatewayFeatureCapabilityInput,
  type GatewayMediaCapabilityMap,
  type GatewayMediaProviderCapabilityInput,
  type NormalizeGatewayFeatureCapabilitiesOptions,
  type NormalizedGatewayFeatureCapabilities,
} from "./core/gateway/client/capabilities.js";

export {
  GatewayJobAbortError,
  GatewayJobTimeoutError,
  GATEWAY_JOB_SUCCESS_STATUSES,
  GATEWAY_JOB_TERMINAL_STATUSES,
  isGatewayJobSuccessfulStatus,
  isGatewayJobTerminalStatus,
  waitForGatewayJob,
  type GatewayJobLike,
  type GatewayJobSleep,
  type GatewayJobStatus,
  type GatewayJobWaitOptions,
  type GatewayJobWaitUpdate,
} from "./core/gateway/jobs.js";

export {
  FALLBACK_CORE_SLASH_COMMANDS,
  buildAgentCommandSurface,
  buildAgentMentionChips,
  buildAgentSlashShortcuts,
  extractGatewayCommandCatalog,
  type AgentCommandShortcut,
  type AgentCommandSource,
  type AgentCommandSurface,
  type AgentMentionSuggestion,
  type GatewayCommandCapabilities,
  type GatewayCommandCatalog,
  type GatewayCommandSpec,
} from "./core/gateway/agent/commands.js";

export {
  GatewayMediaApiClient,
  GATEWAY_MEDIA_ACCEPT_HEADERS,
  GATEWAY_MEDIA_KINDS,
  type GatewayMediaAssetDeleteResult,
  type GatewayMediaAssetList,
  type GatewayMediaAssetListOptions,
  type GatewayMediaApiClientOptions,
  type GatewayMediaAsset,
  type GatewayMediaAssetRequest,
  type GatewayMediaAssetUploadRequest,
  type GatewayMediaClient,
  type GatewayMediaEndpointMap,
  type GatewayMediaGenerateInput,
  type GatewayMediaGenerateRequest,
  type GatewayMediaGenerationResult,
  type GatewayMediaJobWaitOptions,
  type GatewayMediaJsonValue,
  type GatewayMediaKind,
  type GatewayMediaProvider,
  type GatewayMediaProviderList,
  type GatewayTextToSpeechRequest,
} from "./core/gateway/resources/media.js";

export {
  createGatewayAgentConfigClient,
  createGatewayApiClient,
  createGatewayMediaClient,
  createGatewayProviderRegistry,
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
  type GatewayProviderEnv,
  type GatewayProviderFactories,
  type GatewayProviderKind,
  type GatewayProviderModule,
  type GatewayProviderRegistry,
  type ResolveGatewayProviderOptions,
} from "./core/gateway/providers/index.js";
export { HERMES_PROVIDER_MODULE } from "./providers/hermes/provider-module.js";
export { OPENCLAW_PROVIDER_MODULE } from "./providers/openclaw/provider-module.js";

export {
  GatewayAgentConfigApiClient,
  agentProfileConfigPath,
  agentProfileConfigSourcePath,
  assertAgentProfileId,
  buildAgentConfigFromConfigSnapshot,
  buildAgentProfileConfigPatchBody,
  findAgentProfile,
  isMissingAgentConfigRouteError,
  normalizeAgentProfiles,
  setAgentConfigPathValue,
  type AgentConfig,
  type AgentConfigDraftDiff,
  type AgentConfigField,
  type AgentConfigFieldKind,
  type AgentConfigFieldValue,
  type AgentConfigSection,
  type AgentConfigSectionId,
  type AgentProfileConfigPatchBody,
  type AgentProfileSourcePathResolver,
  type AgentProfileSummary,
  type GatewayAgentConfigClient,
  type GatewayAgentConfigApiClientOptions,
  type GatewayAgentConfigEndpointMap,
  type GatewayConfigSchemaField,
  type GatewayConfigSchemaPayload,
  type PatchProfileConfigOptions,
} from "./core/gateway/agent/config.js";

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
} from "./core/gateway/resources/wiki.js";

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
} from "./extensions/cavi/registry/team-registry.js";

export {
  TEAM_REGISTRY_CONFIG,
  configureTeamRegistryConfig,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
} from "./extensions/cavi/registry/team-registry-config.js";

export { createHermesTeamRegistry } from "./providers/hermes/team-registry.js";
export { createOpenClawTeamRegistry } from "./providers/openclaw/team-registry.js";

export {
  HermesApiClient,
  type HermesCapabilities,
  type HermesRunStatus,
} from "./providers/hermes/client.js";

export { HermesMediaApiClient } from "./providers/hermes/media.js";
export {
  OPENCLAW_DEFAULT_CAPABILITIES,
  OpenClawApiClient,
  type OpenClawCapabilities,
  type OpenClawRunStatus,
} from "./providers/openclaw/client.js";
export { OpenClawMediaApiClient } from "./providers/openclaw/media.js";
export {
  HERMES_PROFILE_COOKIE_NAME,
  HermesAgentConfigApiClient,
  buildAgentConfigFromHermesConfigSnapshot,
  buildAgentConfigFromHermesWebuiSnapshot,
  hermesAgentProfileConfigYamlPath,
  hermesProfileCookieHeader,
} from "./providers/hermes/agent-config.js";
export { OpenClawAgentConfigApiClient } from "./providers/openclaw/agent-config.js";
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

export {
  GatewaySseRunEventProvider,
  type GatewaySseRunEventEndpointMap,
  type GatewaySseRunEventHeaderResolver,
  type GatewaySseRunEventPhase,
  type GatewaySseRunEventProviderOptions,
} from "./core/gateway/run/sse-run-event-provider.js";

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
  resolveGatewayRouteSource,
  resolveHermesChatRunApproval,
  resolveHermesRouteSource,
  sanitizeGatewayRouteMetadata,
  sanitizeGatewayRouteSource,
  sanitizeHermesRouteMetadata,
  sanitizeHermesRouteSource,
  startGatewayChatRun,
  startHermesChatRun,
  streamGatewayChatRun,
  streamHermesChatRun,
  type GatewayChatRunAttachment,
  type GatewayRouteMetadata,
  type GatewayRouteSource,
  type ResolveGatewayChatRunApprovalParams,
  type StartGatewayChatRunParams,
  type StreamGatewayChatRunParams,
  type StreamGatewayChatRunResult,
  type HermesChatRunAttachment,
  type HermesRouteMetadata,
  type HermesRouteSource,
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
} from "./extensions/cavi/library/client.js";

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
} from "./extensions/cavi/library/clip.js";

export { PortalApiClient, type PortalApiClientOptions } from "./extensions/cavi/portal/client.js";

export {
  PORTAL_TTS_PATH,
  PORTAL_TTS_PROVIDERS_PATH,
  buildPortalTtsVoiceOptions,
  createPortalTtsAgentVoiceAssignment,
  getPortalTtsProviderLabel,
  requestPortalTtsAudio,
  requestPortalTtsProviders,
  type PortalTtsAgentVoiceAssignment,
  type PortalTtsAudioRequest,
  type PortalTtsAudioTransport,
  type PortalTtsBlobRequester,
  type PortalTtsDashboardVoiceLike,
  type PortalTtsJsonRequester,
  type PortalTtsProviderLike,
  type PortalTtsProviderVoiceLike,
  type PortalTtsVoiceOption,
} from "./extensions/cavi/portal/tts.js";

export { SURFACE_CONTRACTS, type SurfaceContract } from "./contracts/surfaces.js";
export {
  createSurfacePathResolver,
  resolvePath,
  resolveSurfaceContractPath,
  type SurfaceContractMap,
  type SurfacePathResolver,
} from "./contracts/resolve.js";
export {
  CAVI_SURFACE_CONTRACTS,
  resolveCaviPath,
} from "./extensions/cavi/contracts/index.js";
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
  PORTAL_MEMORY_SNAPSHOT_CONTRACT,
  buildPortalApiErrorEnvelope,
  buildPortalApiRequestEnvelope,
  buildPortalApiSuccessEnvelope,
  buildPortalMemoryEnvelope,
  isPortalDashboardId,
  portalDashboardPath,
  type PortalApiEnvelopeBase,
  type PortalApiError,
  type PortalApiRequestEnvelope,
  type PortalApiResponseEnvelope,
  type PortalDashboardId,
  type PortalLibraryRef,
  type PortalMemoryEnvelope,
} from "./extensions/cavi/contracts/portals.js";
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
  type MobileGatewaySurfaceKey,
  type OperatorTaskDispatchMode,
} from "./extensions/cavi/contracts/mobile.js";
