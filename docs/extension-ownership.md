# CAVI Extension Ownership

This inventory freezes the ownership boundary of the released
`@cavi-ai/api-client/extensions/cavi` entry before provider work continues.
A generic-looking symbol name is not evidence that it belongs in core. Promotion
requires a provider-neutral contract, at least one non-CAVI consumer, and an
additive migration plan.

`RuntimeControlClient` and `createRuntimeControlClient` are core/provider-layer
contracts and are not CAVI exports. The CAVI extension owns only setup-time
composition through `createHermesRuntimeControlClient`,
`withCaviRuntimeControlProviders`, `CAVI_CONTROL_EXTENSION`, and
`CaviRuntimeControlProviderOptions`.
That composition may mirror Hermes dashboard JSON-RPC/REST and CAVI plugin task
or workspace behavior, but it does not own those upstream protocols. Hermes,
OpenClaw, Caviclaw, gateway, and plugin runtimes remain protocol owners; this
package is a follower/mirror and normalizes only proven behavior.

## Classification rules

- **keep**: CAVI routes, domain DTOs, fallbacks, environment and path wrappers,
  team configuration, session-key helpers, and product surfaces remain owned by
  the extension.
- **already-core**: the CAVI barrel re-exports a canonical core or contracts
  primitive and must compose it without copying its implementation.
- **promote-now**: the provider-neutral gateway session operation port is now
  owned by core. It is not a CAVI export, so no inventory row uses this
  classification; CAVI composes the core loader and does not copy the port.
- **compatibility-exception**: limited to the four released provider forwarding
  modules listed below.
- **retire-later**: requires an obsolete released symbol, a documented
  replacement, and removal only under an explicitly approved major version. No
  current export is classified this way.

## Complete public export inventory

The inventory is derived with the TypeScript module checker from
`src/extensions/cavi/index.ts`. The checker follows every `export *` and named
re-export barrel, resolves aliases to their declaration files, and produces the
same symbol set the compiler exposes to consumers. The architecture test compares
this table to that live set exactly. It also validates all five columns, the
classification vocabulary, owner/classification consistency, nonempty evidence
and action, and symbol uniqueness. Each symbol alias is resolved to its compiler
declaration, and the row's owner and classification family must match that
actual `core/contracts` or `CAVI extension` owner.

| Symbol | Current owner | Classification | Evidence | Action |
| --- | --- | --- | --- | --- |
| `AgentMemoryFile` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `AgentMemorySnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `appendCaviApiPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `appendHttpQuery` | core/contracts | already-core | Declared by `src/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Compose the canonical shared symbol; do not copy it into CAVI. |
| `backfillCanonicalTeam` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildAgentMainSessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildLibraryClipPayload` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildLibraryClipSchemaSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildLibraryManualFileClipInput` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildPortalApiErrorEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildPortalApiRequestEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildPortalApiSuccessEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildPortalMemoryEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `buildPortalTtsVoiceOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_API_ENDPOINTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_BASE_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_EXTENSION` | CAVI extension | keep | Declared by `src/extensions/cavi/adapters/runtime-control-extension.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep typed CAVI capability discovery and adapter composition under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_API` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_API_BASE` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS_BASE` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_CONTROL_OPERATOR_RPC_METHODS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CAVI_COST_HISTORY_API_PATHS` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep the released-first cost-history alias order under the CAVI extension. |
| `CAVI_SURFACE_CONTRACTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/surfaces.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviApiPathAppendOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviControlAdapterFallbackProvider` | CAVI extension | keep | Declared by `src/extensions/cavi/fallbacks/provider.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviControlAdapterFallbacks` | CAVI extension | keep | Declared by `src/extensions/cavi/fallbacks/provider.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviControlAdapterOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/adapters/create-cavi-control-adapters.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep CAVI adapter configuration under the CAVI extension. |
| `CaviControlAdapters` | CAVI extension | keep | Declared by `src/extensions/cavi/adapters/create-cavi-control-adapters.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviControlApiClient` | CAVI extension | keep | Declared by `src/extensions/cavi/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CaviRuntimeControlProviderOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/runtime-control-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep provider-specific registry setup out of the package root. |
| `CaviTeamPortalId` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `configureCanonicalOperatorRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `configureCanonicalTeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `configureTeamRegistryConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createCaviControlAdapterFallbackProvider` | CAVI extension | keep | Declared by `src/extensions/cavi/fallbacks/provider.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createCaviControlAdapters` | CAVI extension | keep | Declared by `src/extensions/cavi/adapters/create-cavi-control-adapters.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createCaviSnapshotFallbackProvider` | CAVI extension | keep | Declared by `src/extensions/cavi/fallbacks/provider.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createContractGap` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyDelegatedTransport` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyOperatorMemory` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyOperatorRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyOperatorSectionStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyOperatorStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyOperatorTasks` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createEmptyWorkerTransport` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/defaults.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createHermesDashboardJsonRpcClient` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/dashboard-json-rpc.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createHermesRuntimeControlClient` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/runtime-control-client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep Hermes dashboard and CAVI plugin composition under the CAVI extension. |
| `createHermesTeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createOpenClawTeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/openclaw/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createOperatorSectionStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/load-section.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createPortalTtsAgentVoiceAssignment` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createTeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `createTeamRegistryFromSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `CreateTeamRegistryOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DEFAULT_PROJECT_BOARD_ASSET_DIR` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DelegationNode` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseBlockerData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseBlockerEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseCompletionData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseCompletionEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDecisionData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDecisionEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDelegationData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDelegationEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDispatchData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseDispatchEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseEscalationData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseEscalationEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseEventType` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseResolutionData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseResolutionEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnBudgetData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnBudgetEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnDedupData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnDedupEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnGuardData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseSpawnGuardEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseStatusData` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `DiscourseStatusEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `EnrichedAgentRun` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/observability.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `FleetLibrarySnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `GATEWAY_KANBAN_BOARD_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `GATEWAY_KANBAN_TASKS_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `GATEWAY_RPC_METHODS` | CAVI extension | keep | Declared by `src/extensions/cavi/discourse/contracts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `GATEWAY_WS_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `GatewayTargets` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getConfiguredGatewayBaseUrl` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getConfiguredTeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getFleetLibraryRef` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/portal-library-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getMobileGatewayEndpointContract` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getMobileGatewayEndpointPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getOperatorTeamLookupKeys` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getPortalTeamCode` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getPortalTeamIdentity` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getPortalTeamSectorSlug` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getPortalTeamSlug` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getPortalTtsProviderLabel` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getProjectBoardAssetDir` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getRuntimeBasePath` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `getTeamLookupKeys` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HERMES_KANBAN_BOARD_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HERMES_KANBAN_TASKS_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HERMES_WS_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HermesDashboardEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/types.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HermesDashboardJsonRpcClient` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/types.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HermesDashboardJsonRpcOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/types.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HermesApiServerRunEventBinding` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/runtime-control-client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep provider-specific existing-run SSE configuration out of core runtime-control options. |
| `HermesCaviRuntimeControlOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/runtime-control-client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep provider-specific configuration out of core runtime-control options. |
| `HermesGatewayTargets` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HTTP_API_CLIENT_ENV_ALIASES` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/env-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HTTP_API_CLIENT_ENV_KEYS` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/env-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `HttpApiResolvedConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/env-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_API_BASE_PATH` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_API_ENDPOINTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_DEFAULT_TEAM` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_ENDPOINT` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_HEALTH_ENDPOINT` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_LOGS_ENDPOINT` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_SCHEMA_ENDPOINT` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LIBRARY_CLIP_SOURCE_TAG` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryApiClient` | CAVI extension | keep | Declared by `src/extensions/cavi/library/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipDiagnosticsCheck` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipDiagnosticsLog` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipDiagnosticsSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipInput` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipRequest` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipResult` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipSchemaField` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipSchemaSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryClipTransport` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryIngestRequest` | CAVI extension | keep | Declared by `src/extensions/cavi/library/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryIngestResult` | CAVI extension | keep | Declared by `src/extensions/cavi/library/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryIngestSource` | CAVI extension | keep | Declared by `src/extensions/cavi/library/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryManualFileClipInput` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryNote` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryNoteType` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibrarySensitivity` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibrarySourceEntry` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `LibraryVerification` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `listCaviTeamPortalIds` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `listCompiledCanonicalTeams` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `listPortalLibraryRefs` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/portal-library-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `loadOperatorControlSection` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/load-section.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `matchesOperatorTeamIdentifier` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `matchesTaskTargetToTeam` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `matchesTeamIdentifier` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `MOBILE_GATEWAY_ENDPOINT_CONTRACTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `MobileGatewayContractGap` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `MobileGatewayEndpointContract` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `MobileGatewaySurfaceKey` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeDiscourseEvent` | CAVI extension | keep | Declared by `src/extensions/cavi/discourse/normalize.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeSessionAgentId` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeSessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeTaskDiscourseSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/discourse/normalize.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeTeamLookupValue` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `normalizeTeamRegistryTeam` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OPERATOR_DISPATCH_ENDPOINTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OPERATOR_MEMORY_SAMPLE_LIMIT` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/constants.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OPERATOR_TASK_SAMPLE_LIMIT` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/constants.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `operatorControlExpectedContractSummary` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorControlSectionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorControlSectionStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorControlSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorControlStatusSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorDelegatedTransportSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorMemoryCollectionSummary` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorMemoryRecord` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryAgent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryAgentIdentity` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryAgentOwnership` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryAgentRepoConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryAgentRoleBoundary` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryDelegatedTransportConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryIdentity` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryRuntime` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryRuntimeConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistrySkillOwnership` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistrySnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorRegistryTeam` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorSectionLoadResult` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/load-section.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorSharedMemoryAuthority` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorSharedMemoryCollection` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorSharedMemorySnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `operatorTaskDiscoursePath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `operatorTaskDiscoursePluginAliasPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorTaskDispatchMode` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorTaskListSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorTaskRecord` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorTaskState` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorTaskTier` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorWorkerTransportSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorWorkflowLane` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `OperatorWorkflowLaneStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/operator.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `parseAgentSessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `ParsedAgentSessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PORTAL_CLIENT_ID_HEADER` | core/contracts | already-core | Declared by `src/core/http/types.ts`; TypeScript resolves this declaration through the CAVI barrel. | Compose the canonical shared symbol; do not copy it into CAVI. |
| `PORTAL_MEMORY_SNAPSHOT_CONTRACT` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiClient` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiClientOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/client.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiEnvelopeBase` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiError` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiRequestEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalApiResponseEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `portalDashboardPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalLibraryRef` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalMemoryEnvelope` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/portals.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsAgentVoiceAssignment` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsAudioRequest` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsAudioTransport` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsBlobRequester` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsDashboardVoiceLike` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsJsonRequester` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsProviderLike` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsProviderVoiceLike` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `PortalTtsVoiceOption` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `postLibraryClip` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `requestLibraryClipDiagnostics` | CAVI extension | keep | Declared by `src/extensions/cavi/library/clip.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `requestPortalTtsAudio` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `requestPortalTtsProviders` | CAVI extension | keep | Declared by `src/extensions/cavi/portal/tts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resetCanonicalOperatorRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resetTeamRegistryConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveCaviPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/resolve.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveCompiledCanonicalTeam` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveGatewayHttpBase` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveGatewayHttpUrl` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveGatewayWsUrl` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveHttpApiConfigFromEnv` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/env-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `RequestOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/hermes/types.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `ResolveHttpApiConfigOptions` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/env-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveLibraryApiPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveLibraryRefByTeamIdentity` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/portal-library-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveMemoryScope` | CAVI extension | keep | Declared by `src/extensions/cavi/memory/scope-resolver.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveOperatorTaskDispatchContract` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveOperatorTaskDispatchPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/mobile.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolvePath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/resolve.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolvePluginApiPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep generic CAVI plugin route resolution distinct from portal dispatch. |
| `resolvePortalApiPath` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolvePortalLibraryRef` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/portal-library-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolvePortalPrimarySessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveProjectBoardAssetPath` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolvePublicAsset` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveSessionApiPath` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveTeamFromCollection` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveTeamSessionAgentId` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `resolveTeamSessionKey` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/canonical-team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `RunTaskLinkCandidate` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/observability.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `sessionKeysEqual` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/session-keys.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `SURFACE_CONTRACTS` | CAVI extension | keep | Declared by `src/extensions/cavi/contracts/surfaces.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `SurfaceContract` | core/contracts | already-core | Declared by `src/contracts/surfaces.ts`; TypeScript resolves this declaration through the CAVI barrel. | Compose the canonical shared symbol; do not copy it into CAVI. |
| `TaskDiscourseAgent` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `taskDiscourseExpectedContractSummary` | CAVI extension | keep | Declared by `src/extensions/cavi/discourse/contracts.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TaskDiscourseSnapshot` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TaskDiscourseSummary` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/discourse.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TaskObservabilitySummary` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/observability.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TEAM_REGISTRY_CONFIG` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry-config.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamLibraryStatus` | CAVI extension | keep | Declared by `src/extensions/cavi/domain/library.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistry` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistryConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistryLibraryConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistryLibraryRefConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistryProviderKind` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `TeamRegistryTeamConfig` | CAVI extension | keep | Declared by `src/extensions/cavi/registry/team-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `withCaviControlOperatorCapabilities` | CAVI extension | keep | Declared by `src/extensions/cavi/operator-control/capabilities.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |
| `withCaviRuntimeControlProviders` | CAVI extension | keep | Declared by `src/extensions/cavi/providers/runtime-control-registry.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep immutable provider-specific registry composition under the CAVI extension. |
| `withRuntimeBasePath` | CAVI extension | keep | Declared by `src/extensions/cavi/runtime/paths.ts`; TypeScript resolves this declaration through the CAVI barrel. | Keep implementation and evolution under the CAVI extension. |

## Provider forwarding compatibility exceptions

These are the only provider-to-extension imports allowed. They preserve released
provider subpath exports while delegating to extension-owned team registry code;
they do not transfer implementation ownership to a provider.

| Module | Current owner | Classification | Evidence | Action |
| --- | --- | --- | --- | --- |
| `src/providers/hermes/team-registry.ts` | Provider compatibility facade | compatibility-exception | Released Hermes forwarding module imports the CAVI registry implementation. | Preserve as a forwarding-only module until a human-approved major-version plan removes it. |
| `src/providers/hermes/team-registry-config.ts` | Provider compatibility facade | compatibility-exception | Released Hermes configuration forwarding module imports the CAVI registry implementation. | Preserve as a forwarding-only module until a human-approved major-version plan removes it. |
| `src/providers/openclaw/team-registry.ts` | Provider compatibility facade | compatibility-exception | Released OpenClaw forwarding module imports the CAVI registry implementation. | Preserve as a forwarding-only module until a human-approved major-version plan removes it. |
| `src/providers/openclaw/team-registry-config.ts` | Provider compatibility facade | compatibility-exception | Released OpenClaw configuration forwarding module imports the CAVI registry implementation. | Preserve as a forwarding-only module until a human-approved major-version plan removes it. |

## Dependency direction

`core` and `contracts` cannot import the CAVI extension. Providers cannot import
it except through the four forwarding files above. The guard parses static imports
and re-exports, dynamic `import()`, TypeScript `import = require()`, and
JavaScript `require()`, then resolves their actual modules with TypeScript.
A production source file also cannot import both a core implementation and a CAVI
implementation for the same resolved owner-relative concern; transport and
snapshot implementation filenames are normalized explicitly, including through
relative alias barrels. Extension code must reuse canonical transport and gateway
snapshot owners rather than introduce duplicate `transport` or `snapshot`
implementation filenames.

## Provider-neutral gateway session operations

`GatewaySessionOperations` is the core-owned seam for list, usage, preview,
detail, patch, and optional provider-neutral cancel operations.
`createSessionLoaders` accepts an injected port;
when none is supplied, `createOpenClawSessionOperations` preserves the released
plural OpenClaw RPC names and session REST fallbacks. CAVI continues to compose
the core loader and owns no duplicate session operation implementation. Loader
request options pass through this seam unchanged. The default adapter rejects
already-aborted signals before dispatch; its released legacy RPC and REST
transports do not provide in-flight cancellation.
Raw session rows type optional provider-neutral creation/update timestamps and
state. Canonical session methods use the shared abortable request options; a
provider leaves cancel absent unless its native operation has matching,
fixture-proven semantics.

## Runtime-control compatibility ownership

The pinned compatibility ledger separates three authorities. Each upstream
provider owns its observed wire operation, payload schema, and transport. Core
owns the provider-neutral canonical capability names that adapters implement.
CAVI owns extension IDs and the product-specific composition that installs
extension providers; it does not redefine upstream wire operations or core
capabilities. Drift reports are read-only evidence and never update the pinned
ledger automatically.
