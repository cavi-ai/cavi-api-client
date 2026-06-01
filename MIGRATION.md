# Migrating to @cavi-ai/api-client 2.x

The root entry now exports only the curated stable API. Provider modules, the
CAVI extension, framework bindings, and low-level core primitives moved to
subpaths. Update imports:

| Was (root) | Now (subpath) |
| --- | --- |
| `CaviControlApiClient`, `PortalApiClient`, `LibraryApiClient`, `createTeamRegistry`, `TEAM_REGISTRY_CONFIG`, `resolveCaviPath`, `CAVI_SURFACE_CONTRACTS`, CAVI contracts (`portals`/`mobile`/`paths`) | `@cavi-ai/api-client/extensions/cavi` |
| `HermesApiClient`, `HERMES_PROVIDER_MODULE`, `createHermesTeamRegistry`, Hermes chat-run/media/wiki/agent-config/websocket/env-config | `@cavi-ai/api-client/providers/hermes` |
| `OpenClawApiClient`, `OPENCLAW_PROVIDER_MODULE`, `OPENCLAW_MANIFEST`, `createOpenClawTeamRegistry`, OpenClaw media/wiki/agent-config/websocket | `@cavi-ai/api-client/providers/openclaw` |
| `ClaudeApiClient`, `CLAUDE_PROVIDER_MODULE`, `mapAnthropicStreamEvent` | `@cavi-ai/api-client/providers/claude` |
| `BaseHttpApiClient`, `RawHttpApiClient`, `JsonHttpApiClient`, redaction helpers, client-id helpers | `@cavi-ai/api-client/core/http` |
| SSE / WS helpers (`GatewayWebSocketClient`, …) | `@cavi-ai/api-client/core/sse`, `@cavi-ai/api-client/core/ws` |
| Gateway resource clients (`GatewayMediaApiClient`, `GatewayWikiApiClient`, `GatewayAgentConfigApiClient`, `GatewayRpcClient`, `GatewaySseRunEventProvider`, jobs, commands, snapshots, `portalConfigPatchPath`) | `@cavi-ai/api-client/core/gateway` |
| `resolveHttpSurfaceConfigFromEnv` and other env config | `@cavi-ai/api-client/core/env` |
| `core/data` guards | `@cavi-ai/api-client/core/data` |

## What stays at the root

The curated stable API remains importable from `@cavi-ai/api-client`:

- **Unified client + registry** — `GatewayApiClient`, `RuntimeClient`, the
  `create*ProviderRegistry`/`createGateway*` factories, provider-module types.
- **Errors & guards** — `ApiClientError`, `HttpApiError`, `GatewayHttpError`,
  `isAuthError`, `getErrorCode`, …
- **Graceful degradation** — `DataEnvelope`, `withFallback`, `contractGap`.
- **Auth seam** — `HttpApiClientOptions`, `bearerCredentials`, `apiKeyCredentials`.
- **Runtime contract** — `RuntimeCapabilities`, run types, `RunStreamEvent` + the
  run-stream contract, protocol guard.
- **Contracts** — `paths`, `surfaces`, `resolve`, team-manifest, manifest-source,
  route-resolver.
- **`resolveRepoRoot`** / `requireRepoRoot`.
