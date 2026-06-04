# API Reference

Master endpoint catalog for `@cavi-ai/api-client`.

This package mirrors gateway, provider, and CAVI extension contracts. It is not
the canonical runtime contract for upstream OpenClaw, Caviclaw, or gateway
servers. Keep source-of-truth endpoint literals in `paths.ts` files or surface
contract maps, then update this document and the Postman collection together.

Primary sources:

- `src/contracts/paths.ts`
- `src/contracts/surfaces.ts`
- `src/contracts/team-manifest.ts`
- `src/extensions/cavi/contracts/paths.ts`
- `src/extensions/cavi/contracts/surfaces.ts`

The companion Postman collection is
`docs/postman/cavi-api-client.postman_collection.json`.

## Conventions

- `{{gatewayUrl}}` is the HTTP gateway base URL, for example
  `http://localhost:8787`.
- `{{gatewayWsUrl}}` is the WebSocket gateway base URL, for example
  `ws://localhost:8787`.
- `:param` means a path segment that must be URL-encoded by the caller.
- Query strings shown with `?name=:value` are optional unless the description
  says otherwise.
- `GET/POST` or similar means the same path has multiple known method variants.
- `hard` degradation means the surface is expected for core compatibility.
  `gap` degradation means callers should report a compatibility gap or use a
  fallback when the route is missing.

## Core Gateway

Gateway aliases:

- `HERMES_API_ENDPOINTS` and `GATEWAY_API_ENDPOINTS` are the same map.
- `HERMES_MEDIA_API_ENDPOINTS`, `OPENCLAW_MEDIA_API_ENDPOINTS`, and
  `GATEWAY_MEDIA_API_ENDPOINTS` are the same map.
- `HERMES_WIKI_API_ENDPOINTS`, `OPENCLAW_WIKI_API_ENDPOINTS`, and
  `GATEWAY_WIKI_API_ENDPOINTS` are the same map.
- `HERMES_AGENT_CONFIG_API_ENDPOINTS`, `OPENCLAW_AGENT_CONFIG_API_ENDPOINTS`,
  and `GATEWAY_AGENT_CONFIG_API_ENDPOINTS` are the same map.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `gateway.health` | GET | `/health` | Primary gateway reachability check. |
| `gateway.healthDetailed` | GET | `/health/detailed` | Detailed health check; absence is a compatibility gap if basic health works. |
| `probe.healthz` | GET | `/healthz` | Lightweight liveness probe. |
| `probe.readyz` | GET | `/readyz` | Readiness probe. |
| `models` | GET | `/v1/models` | Gateway model inventory. |
| `gateway.capabilities` | GET | `/v1/capabilities` | Authenticated capability proof for saved bearer tokens. |
| `chatCompletions` | POST | `/v1/chat/completions` | OpenAI-compatible chat completions compatibility route. |
| `responses` | POST | `/v1/responses` | OpenAI-compatible response creation route. |
| `response` | GET | `/v1/responses/:responseId` | Retrieve a response by id. |
| `runs` | POST | `/v1/runs` | Create a gateway run. |
| `run` | GET | `/v1/runs/:runId` | Fetch run status or detail. |
| `runEvents` | GET | `/v1/runs/:runId/events` | Stream run events, typically SSE. |
| `runApproval` | POST | `/v1/runs/:runId/approval` | Resolve a run approval decision. |
| `runStop` | POST | `/v1/runs/:runId/stop` | Request that a run stop. |
| `jobs` | GET | `/api/jobs` | Gateway job inventory. |
| `job` | GET | `/api/jobs/:jobId` | Gateway job detail or status. |
| `gateway.websocket` | WS | `/api/ws` | Dashboard/TUI JSON-RPC websocket path for chat, sessions, logs, and health. |
| `ecgSharedFiles` | GET | `/api/v1/files?agent={agent}&folder={folder}` | Template for ECG/shared files by agent and folder. |

## Gateway Media

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `media.root` | GET | `/v1/media` | Gateway media API root. |
| `gateway.mediaProviders` | GET | `/v1/media/providers` | Provider inventory across audio, image, video, and music generation. |
| `media.providersByKind` | GET | `/v1/media/:kind/providers` | Provider inventory scoped to one media kind. |
| `gateway.mediaAudioGenerate` | POST | `/v1/media/audio/generate` | Audio generation route. |
| `gateway.mediaImageGenerate` | POST | `/v1/media/image/generate` | Image generation route. |
| `gateway.mediaVideoGenerate` | POST | `/v1/media/video/generate` | Video generation route. |
| `gateway.mediaMusicGenerate` | POST | `/v1/media/music/generate` | Music generation route. |
| `gateway.mediaJob` | GET | `/v1/media/:kind/jobs/:jobId` | Media job status route. |
| `gateway.mediaAssets` | GET | `/v1/media/assets?kind=:kind&cursor=:cursor&limit=:limit` | Media asset inventory route. |
| `gateway.mediaAssetCreate` | POST | `/v1/media/assets?kind=:kind` | Create or upload a media asset. |
| `gateway.mediaAsset` | GET | `/v1/media/assets/:assetId` | Fetch media asset bytes or metadata, depending on `Accept`. |
| `gateway.mediaAssetDelete` | DELETE | `/v1/media/assets/:assetId` | Delete a media asset. |

## Gateway Wiki

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `wiki.root` | GET | `/v1/wiki` | Gateway wiki API root. |
| `gateway.wikiVaults` | GET | `/v1/wiki/vaults` | Vault inventory for external Obsidian/QMD plugin vaults. |
| `wiki.vault` | GET | `/v1/wiki/vaults/:vaultId` | Vault metadata. |
| `gateway.wikiTree` | GET | `/v1/wiki/vaults/:vaultId/tree` | Vault tree route. |
| `gateway.wikiRead` | GET | `/v1/wiki/vaults/:vaultId/read?path=:path` | Read a wiki page or file. |
| `gateway.wikiIngest` | POST | `/v1/wiki/vaults/:vaultId/ingest` | Ingest content into a wiki vault. |
| `gateway.wikiCompile` | POST | `/v1/wiki/vaults/:vaultId/compile` | Compile QMD/wiki content. |
| `gateway.wikiPromote` | POST | `/v1/wiki/vaults/:vaultId/promote` | Promote wiki output for durable publishing. |
| `wiki.job` | GET | `/v1/wiki/vaults/:vaultId/jobs/:jobId` | Wiki job status. |
| `wiki.artifact` | GET | `/v1/wiki/vaults/:vaultId/artifacts/:artifactId` | Wiki artifact retrieval. |

## Sessions And Snapshots

The session REST paths are HTTP fallbacks for the websocket RPC session methods.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `sessions.list` | GET | `/api/sessions/list?...` | List sessions with filters such as `limit`, `search`, `agentId`, and `activeMinutes`. |
| `sessions.usage` | GET | `/api/sessions/usage?...` | Fetch session usage and aggregate cost/token data. |
| `sessions.preview` | POST | `/api/sessions/preview` | Fetch compact previews for selected session keys. |
| `sessions.detail` | POST | `/api/sessions/detail` | Fetch detail for one session key. |
| `sessions.patch` | PATCH | `/api/sessions/patch` | Mutate per-session operator settings such as label or thinking level. |
| `gateway.overview` | WS | `sessions.list + sessions.usage + health/log RPC` | Composite overview snapshot assembled by the client loaders. |
| `gateway.costHistory` | GET | `/api/plugins/cavi-control/cost/history?range=:range` | Optional CAVI cost-history fallback used by snapshot loaders. |

## Agent Config And Profiles

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `profiles` | GET | `/api/profiles` | Legacy profile list fallback. |
| `config` | GET | `/api/config` | Legacy gateway config payload. |
| `configDefaults` | GET | `/api/config/defaults` | Default config values. |
| `configSchema` | GET | `/api/config/schema` | Config schema. |
| `agentConfigs` | GET | `/api/agent-configs` | Native agent config/profile inventory. |
| `agentConfig` | GET | `/api/agent-configs/:agentId/config` | Fetch one agent profile config. |
| `agentConfig` | PATCH | `/api/agent-configs/:agentId/config` | Patch one agent profile config. |
| `portal.config` | POST | `/api/plugins/portal/:portalSlug/config` | Shared portal config patch route. |

## Vault, Kanban, And Teams

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `vault.tree` | GET | `/api/obsidian/tree` | Obsidian vault tree; no native gateway route identified yet. |
| `vault.read` | GET | `/api/obsidian/read?path=:path` | Obsidian file read; query string is appended by caller. |
| `kanban.tasks` | POST | `/api/plugins/kanban/tasks` | Legacy/unknown kanban compatibility route; no native OpenClaw Workboard REST owner is mirrored here. |
| `kanban.board` | GET | `/api/plugins/kanban/board` | Legacy/unknown board compatibility route; prefer native Workboard RPC when available. |
| `team.kanban` | GET | `/api/teams/:teamId/kanban` | Team-shaped compatibility route; CAVI adapters map `teamId` to Workboard `boardId` only in compatibility code. |
| `team.runs` | GET | `/api/teams/:teamId/runs` | Team runs route derived from the team manifest identity. |
| `team.config` | GET | `/api/teams/:teamId/config` | Team config route derived from the team manifest identity. |
| `team.workspace` | GET | `/api/teams/:teamId/workspace/:workspacePath` | Whitelisted team workspace route. |
| `team.action` | POST | `/api/teams/:teamId/actions/:actionId` | Team action route derived from a manifest action contract. |
| `team.agent.config` | GET | `/api/teams/:teamId/agents/:agentId/config` | Team member config route. |
| `team.agent.action` | POST | `/api/teams/:teamId/agents/:agentId/actions/:actionId` | Team member action route. |
| `team.agent.workspace` | GET | `/api/teams/:teamId/agents/:agentId/workspace/:workspacePath` | Whitelisted team-member workspace route. |

## CAVI Control Operator

The plugin alias paths mirror the operator paths under
`/api/plugins/cavi-control/operator`.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `operator.root` | GET | `/cavi-control/api/operator` | Operator API root. |
| `cavi.operator.snapshot` | GET | `/cavi-control/api/operator/snapshot` | Aggregate operator snapshot. |
| `cavi.operator.status` | GET | `/cavi-control/api/operator/status` | Operator status endpoint. |
| `cavi.operator.registry` | GET | `/cavi-control/api/operator/registry` | Operator registry endpoint. |
| `cavi.operator.tasks` | POST | `/cavi-control/api/operator/tasks` | Create an operator task. |
| `cavi.operator.task` | GET | `/cavi-control/api/operator/tasks/:taskId` | Fetch operator task detail. |
| `cavi.operator.taskDiscourse` | GET | `/cavi-control/api/operator/tasks/:taskId/discourse` | Fetch task discourse tree. |
| `cavi.operator.memory` | GET | `/cavi-control/api/operator/memory` | Operator memory endpoint. |
| `cavi.operator.workerReady` | GET | `/cavi-control/api/operator/worker/ready` | Operator worker readiness. |
| `cavi.operator.workerTasks` | GET | `/cavi-control/api/operator/worker/tasks` | Operator worker task queue. |
| `operatorAlias.root` | GET | `/api/plugins/cavi-control/operator` | Plugin alias for the operator API root. |
| `operatorAlias.snapshot` | GET | `/api/plugins/cavi-control/operator/snapshot` | Plugin alias for the aggregate operator snapshot. |
| `operatorAlias.status` | GET | `/api/plugins/cavi-control/operator/status` | Plugin alias for operator status. |
| `operatorAlias.registry` | GET | `/api/plugins/cavi-control/operator/registry` | Plugin alias for operator registry. |
| `operatorAlias.tasks` | POST | `/api/plugins/cavi-control/operator/tasks` | Plugin alias for operator task creation. |
| `operatorAlias.task` | GET | `/api/plugins/cavi-control/operator/tasks/:taskId` | Plugin alias for operator task detail. |
| `operatorAlias.taskDiscourse` | GET | `/api/plugins/cavi-control/operator/tasks/:taskId/discourse` | Plugin alias for task discourse. |
| `operatorAlias.memory` | GET | `/api/plugins/cavi-control/operator/memory` | Plugin alias for operator memory. |
| `operatorAlias.workerReady` | GET | `/api/plugins/cavi-control/operator/worker/ready` | Plugin alias for worker readiness. |
| `operatorAlias.workerTasks` | GET | `/api/plugins/cavi-control/operator/worker/tasks` | Plugin alias for worker task queue. |

## CAVI Control Project Board

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `cavi.costHistory` | GET | `/api/plugins/cavi-control/cost/history?range=:range` | CAVI cost history endpoint. |
| `cavi.scoringModel` | GET | `/api/plugins/cavi-control/scoring/model` | CAVI scoring model endpoint. |
| `cavi.projectBoard.root` | GET | `/api/plugins/cavi-control/kanban` | Project Board compatibility aggregate; native Workboard data may be projected from RPC. |
| `cavi.projectBoard.profile` | GET | `/api/plugins/cavi-control/kanban/profile` | Project Board compatibility profile slice. |
| `cavi.projectBoard.profile` | PUT | `/api/plugins/cavi-control/kanban/profile` | Persist Project Board profile email mutations. |
| `cavi.projectBoard.sprint` | GET | `/api/plugins/cavi-control/kanban/sprint` | Project Board compatibility sprint slice synthesized from board metadata, stats, or fallback data. |
| `cavi.projectBoard.backlog` | GET | `/api/plugins/cavi-control/kanban/backlog` | Project Board compatibility backlog slice; native cards map through Workboard RPC when present. |
| `cavi.projectBoard.backlog` | POST | `/api/plugins/cavi-control/kanban/backlog` | Compatibility create route; native Workboard-backed clients use `workboard.cards.create`. |
| `cavi.projectBoard.backlogItem` | PATCH | `/api/plugins/cavi-control/kanban/backlog/:itemId` | Compatibility update route; native Workboard-backed clients use `workboard.cards.update` and `workboard.cards.move`. |
| `cavi.projectBoard.call` | POST | `/api/plugins/cavi-control/kanban/call` | Compatibility command route; known actions map to typed Workboard card RPC methods. |

## CAVI Portal Surfaces

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `portal.dashboard` | GET | `/api/plugins/portal/:portal/dashboard` | Generic portal dashboard aggregate. |
| `portal.config` | POST | `/api/plugins/portal/:portal/config` | Generic portal config patch endpoint. |
| `martina.dashboard` | GET | `/api/plugins/portal/martina/dashboard` | Martina portal dashboard. |
| `martina.config` | GET/POST | `/api/plugins/portal/martina/config` | Martina portal config read or patch. |
| `martina.runs` | GET | `/api/plugins/portal/martina/runs` | Martina run inventory. |
| `martina.run` | GET | `/api/plugins/portal/martina/runs/:runId` | Martina run detail. |
| `martina.doctor` | GET | `/api/plugins/portal/martina/doctor` | Martina diagnostics. |
| `martina.queuesMove` | POST | `/api/plugins/portal/martina/queues/move` | Move Martina queue entries. |
| `martina.artifactFile` | GET | `/api/plugins/portal/martina/artifacts/:bucket/:name` | Fetch a Martina artifact file. |
| `martina.artifactPreview` | GET | `/api/plugins/portal/martina/artifacts/:bucket/:name/preview` | Fetch a Martina artifact preview. |
| `scout.dashboard` | GET | `/api/plugins/portal/scout/dashboard` | Scout portal dashboard. |
| `angela.dashboard` | GET | `/api/plugins/portal/angela/dashboard` | Angela portal dashboard. |
| `machine.dashboard` | GET | `/api/plugins/machine/dashboard` | Machine portal aggregate snapshot. |
| `machine.inbox` | POST | `/api/plugins/machine/inbox` | Machine-owned media/action upload route. |
| `machine.media` | GET | `/api/plugins/machine/media?name=:filename` | Authenticated machine media fetch endpoint. |
| `machine.tts` | POST | `/api/plugins/machine/tts` | Text-to-speech render path. |
| `machine.memeJobs` | GET | `/api/plugins/machine/meme/jobs` | Meme job listing or mutation surface. |
| `machine.ttsProviders` | GET | `/api/plugins/machine/tts/providers` | Voice/TTS provider inventory. |
| `machine.comedyRun` | POST | `/v1/runs` | Machine comedy action using the gateway run fallback. |
| `portalMemory.snapshot` | GET | `/api/plugins/portal-memory/teams/:teamSlug/members/:memberId/:memoryKey` | Portal memory snapshot endpoint. |

## Front Door And Trading

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `frontDoor.dashboard` | GET | `/api/plugins/front-door/dashboard` | Front Door dashboard endpoint. |
| `frontDoor.ideaList` | GET | `/api/plugins/front-door/ideas` | Front Door idea list endpoint. |
| `frontDoor.ideaCreate` | POST | `/api/plugins/front-door/ideas` | Front Door idea creation endpoint. |
| `frontDoor.ideaDetail` | GET | `/api/plugins/front-door/ideas/:id` | Front Door idea detail endpoint. |
| `frontDoor.ideaPatch` | PATCH | `/api/plugins/front-door/ideas/:id` | Front Door idea patch endpoint. |
| `frontDoor.ideaPromote` | POST | `/api/plugins/front-door/ideas/:id/promote` | Front Door idea promotion endpoint. |
| `frontDoor.projectList` | GET | `/api/plugins/front-door/projects` | Front Door project list endpoint. |
| `frontDoor.projectDetail` | GET | `/api/plugins/front-door/projects/:id` | Front Door project detail endpoint. |
| `frontDoor.articleList` | GET | `/api/plugins/front-door/articles` | Front Door article list endpoint. |
| `frontDoor.articleCreate` | POST | `/api/plugins/front-door/articles` | Front Door article creation endpoint. |
| `frontDoor.memoryList` | GET | `/api/plugins/front-door/memory` | Front Door memory list endpoint. |
| `frontDoor.memoryCreate` | POST | `/api/plugins/front-door/memory` | Front Door memory creation endpoint. |
| `frontDoor.inboxUpload` | POST | `/api/plugins/front-door/inbox` | Front Door inbox upload endpoint. |
| `trading.dashboard` | GET | `/api/plugins/trading/dashboard` | Trading workspace dashboard endpoint. |
| `trading.researchPackets` | GET | `/api/plugins/trading/research-packets` | Trading research packet endpoint. |
| `trading.sourceRegistry` | GET | `/api/plugins/trading/source-registry` | Trading source registry endpoint. |
| `wuTang.githubProxyWildcard` | GET | `/api/plugins/wu-tang/github/*` | GitHub proxy route pattern; keep credentials server-side. |

## Library APIs

`LIBRARY_API_ENDPOINTS` uses `/library/api`. CAVI surface contracts also mirror
several library routes under `/api/plugins/library`.

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `library.root` | GET | `/library/api` | Library API root. |
| `library.search` | GET | `/library/api/search?...` | Library search endpoint. |
| `library.ingest` | POST | `/library/api/ingest` | Ingest URL, text, file, or note content into the library. |
| `library.documents` | GET | `/library/api/documents` | Library document inventory. |
| `library.document` | GET | `/library/api/documents/:id` | Library document detail. |
| `library.fleetStatus` | GET | `/library/api/fleet-status` | Fleet library status. |
| `library.status` | GET | `/library/api/status` | Library ingest pipeline counters. |
| `library.inbox` | GET | `/library/api/inbox` | Library inbox endpoint. |
| `library.promotable` | GET | `/library/api/promotable` | Promotable library rows. |
| `library.reviewRequests` | GET | `/library/api/review-requests` | Library review-request rows. |
| `library.clip` | POST | `/library/api/clip` | CaviClip ingest endpoint. |
| `library.clipHealth` | GET | `/library/api/clip/health` | CaviClip health endpoint. |
| `library.clipSchema` | GET | `/library/api/clip/schema` | CaviClip schema endpoint. |
| `library.clipLogs` | GET | `/library/api/clip/logs` | CaviClip logs endpoint. |
| `libraryPlugin.fleetStatus` | GET | `/api/plugins/library/fleet-status` | Plugin route for fleet library status. |
| `libraryPlugin.status` | GET | `/api/plugins/library/status` | Plugin route for library pipeline counters. |
| `libraryPlugin.inbox` | GET | `/api/plugins/library/inbox` | Plugin route for library inbox. |
| `libraryPlugin.promotable` | GET | `/api/plugins/library/promotable` | Plugin route for promotable rows. |
| `libraryPlugin.reviewRequests` | GET | `/api/plugins/library/review-requests` | Plugin route for review-request rows. |
| `libraryPlugin.search` | GET | `/api/plugins/library/search?...` | Plugin route for library search. |
| `libraryPlugin.clip` | POST | `/api/plugins/library/clip` | Plugin route for CaviClip ingest. |

## Operator Dispatch

| Key | Method | Path | Description |
| --- | --- | --- | --- |
| `operatorDispatch.message` | POST | `/api/message` | Operator dispatch message endpoint. |
| `operatorDispatch.operatorEvents` | GET | `/operator/events` | Operator event stream endpoint. |
| `operatorDispatch.taskReceiptsTemplate` | GET | `/cavi-control/api/tasks/:taskId/receipts` | Operator task receipt template. |

## WebSocket RPC Methods

Postman can open the transport URL, but websocket JSON-RPC calls are runtime
protocol messages rather than ordinary HTTP requests. Use `{{gatewayWsUrl}}/api/ws`
for the transport.

### Gateway RPC: OpenClaw Workboard

Native Workboard methods are WebSocket RPC messages, not HTTP routes. This
package mirrors the upstream OpenClaw method names and card field enums so
clients can call them without hand-built strings; OpenClaw remains the runtime
contract owner.

| Group | Method | Description |
| --- | --- | --- |
| Cards | `workboard.cards.list` | List native Workboard cards, optionally scoped by board. |
| Cards | `workboard.cards.export` | Export card data. |
| Cards | `workboard.cards.diagnostics` | Read Workboard diagnostics. |
| Cards | `workboard.cards.stats` | Read Workboard card status/priority stats. |
| Cards | `workboard.cards.runs` | Read Workboard-linked run data. |
| Cards | `workboard.cards.create` | Create a Workboard card. |
| Cards | `workboard.cards.update` | Patch card fields. |
| Cards | `workboard.cards.move` | Move a card to another Workboard status. |
| Cards | `workboard.cards.delete` | Delete a card. |
| Cards | `workboard.cards.comment` | Add a card comment. |
| Cards | `workboard.cards.link` | Link a card to an external object. |
| Cards | `workboard.cards.linkDependency` | Link card dependency relationships. |
| Cards | `workboard.cards.proof` | Attach proof metadata to a card. |
| Cards | `workboard.cards.artifact` | Attach artifact metadata to a card. |
| Cards | `workboard.cards.claim` | Claim a card for an agent/operator. |
| Cards | `workboard.cards.heartbeat` | Send card worker heartbeat. |
| Cards | `workboard.cards.release` | Release a claimed card. |
| Cards | `workboard.cards.promote` | Promote a card through Workboard flow. |
| Cards | `workboard.cards.reassign` | Reassign a card. |
| Cards | `workboard.cards.reclaim` | Reclaim a stale card. |
| Cards | `workboard.cards.complete` | Complete a card. |
| Cards | `workboard.cards.block` | Block a card. |
| Cards | `workboard.cards.unblock` | Unblock a card. |
| Cards | `workboard.cards.bulk` | Apply bulk card operations. |
| Cards | `workboard.cards.diagnostics.refresh` | Refresh Workboard diagnostics. |
| Cards | `workboard.cards.dispatch` | Dispatch queued Workboard card work. |
| Cards | `workboard.cards.specify` | Specify card work. |
| Cards | `workboard.cards.decompose` | Decompose card work. |
| Cards | `workboard.cards.archive` | Archive a card. |
| Boards | `workboard.boards.list` | List Workboard boards. |
| Boards | `workboard.boards.upsert` | Create or update a board. |
| Boards | `workboard.boards.archive` | Archive a board. |
| Boards | `workboard.boards.delete` | Delete a board. |
| Notifications | `workboard.notifications.subscribe` | Subscribe to Workboard notifications. |
| Notifications | `workboard.notifications.list` | List Workboard notifications. |
| Notifications | `workboard.notifications.delete` | Delete a Workboard notification. |
| Notifications | `workboard.notifications.events` | Read Workboard notification events. |
| Notifications | `workboard.notifications.advance` | Advance notification cursor/state. |
| Attachments | `workboard.cards.attachments.list` | List card attachments. |
| Attachments | `workboard.cards.attachments.get` | Fetch a card attachment. |
| Attachments | `workboard.cards.attachments.add` | Add a card attachment. |
| Attachments | `workboard.cards.attachments.delete` | Delete a card attachment. |
| Workers | `workboard.cards.workerLog` | Append Workboard worker log data. |
| Workers | `workboard.cards.protocolViolation` | Record a worker protocol violation. |

| Group | Method | Description |
| --- | --- | --- |
| System | `health` | Core health RPC. |
| System | `health.snapshot` | Legacy health snapshot fallback. |
| System | `status` | OpenClaw status RPC. |
| System | `logs.tail` | Tail gateway logs. |
| Agent | `agent.wait` | Wait for agent readiness. |
| Config | `config.get` | Fetch runtime config. |
| Config | `config.schema` | Fetch runtime config schema. |
| Catalog | `models.list` | List models. |
| Catalog | `commands.list` | List commands. |
| Catalog | `tools.catalog` | List available tools. |
| Catalog | `agents.list` | List agents. |
| Sessions | `sessions.list` | List sessions. |
| Sessions | `sessions.preview` | Fetch compact session previews. |
| Sessions | `sessions.describe` | Describe a session. |
| Sessions | `sessions.usage` | Fetch session usage data. |
| Sessions | `sessions.create` | Create a session. |
| Sessions | `sessions.resolve` | Resolve a session key. |
| Sessions | `sessions.send` | Send to a session. |
| Sessions | `sessions.steer` | Steer session behavior. |
| Sessions | `sessions.abort` | Abort session work. |
| Sessions | `sessions.patch` | Patch session settings. |
| Chat | `chat.send` | Send a chat message. |
| Chat | `chat.abort` | Abort chat work. |
| CAVI Operator | `operator.status` | Fetch CAVI operator status. |
| CAVI Operator | `operator.registry.get` | Fetch CAVI operator registry. |
| CAVI Operator | `operator.snapshot` | Fetch CAVI operator snapshot. |
| CAVI Operator | `operator.memory.list` | List operator memory entries. |
| CAVI Operator | `operator.tasks.list` | List operator tasks. |
| CAVI Operator | `operator.tasks.get` | Fetch operator task detail. |
| CAVI Operator | `discourse.tree` | Fetch discourse tree. |
| CAVI Operator | `operator.worker.ready` | Fetch worker readiness. |
| CAVI Operator | `operator.worker.tasks.list` | List worker tasks. |
| CAVI Operator | `operator.worker.tasks.get` | Fetch worker task detail. |
