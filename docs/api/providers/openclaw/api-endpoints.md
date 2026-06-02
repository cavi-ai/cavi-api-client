---
summary: "Master canonical list of every Gateway-exposed API endpoint: HTTP routes and WebSocket RPC methods, with their auth scope and source file"
read_when:
  - Auditing the Gateway public surface
  - Building or refreshing a Gateway client (CLI, SDK, web, node)
  - Reviewing PRs that add, rename, or remove endpoints
  - Mapping a method/route back to its handler
title: "API endpoints"
---

This page is the single canonical inventory of every endpoint the Gateway
exposes. It complements the deep-dive surface docs (linked inline) but does
**not** restate them — for handshake details, frame shapes, payload schemas,
and discovery semantics see those pages directly.

Source of truth is always the code. Each table below cites the repo file the
inventory is derived from; rebuild this page against those files when you
suspect drift.

## Surfaces at a glance

| Surface | Transport | Default path | Source |
|---|---|---|---|
| Liveness / readiness probes | HTTP | `/health` `/healthz` `/ready` `/readyz` | [src/gateway/server-http.ts:157](src/gateway/server-http.ts#L157) |
| Webhooks (wake / agent / mappings) | HTTP | `/hooks/*` (configurable) | [src/gateway/server/hooks-request-handler.ts](src/gateway/server/hooks-request-handler.ts), [src/gateway/hooks.ts:22](src/gateway/hooks.ts#L22) |
| OpenAI-compatible chat / embeddings / models | HTTP | `/v1/...` | [src/gateway/openai-http.ts](src/gateway/openai-http.ts), [src/gateway/embeddings-http.ts](src/gateway/embeddings-http.ts), [src/gateway/models-http.ts](src/gateway/models-http.ts) |
| OpenAI Responses-compatible | HTTP | `/v1/responses` | [src/gateway/openresponses-http.ts](src/gateway/openresponses-http.ts) |
| Direct tool invocation | HTTP | `/tools/invoke` | [src/gateway/tools-invoke-http.ts](src/gateway/tools-invoke-http.ts) |
| Session control | HTTP | `/sessions/:key/...` | [src/gateway/session-kill-http.ts](src/gateway/session-kill-http.ts), [src/gateway/session-history-http.ts](src/gateway/session-history-http.ts) |
| Managed outgoing media | HTTP | `/api/chat/media/outgoing/...` | [src/gateway/managed-image-attachments.ts](src/gateway/managed-image-attachments.ts) |
| Control UI (SPA + bootstrap + avatar + assistant media) | HTTP | configurable basePath; `/__openclaw__/assistant-media/...`; `/__openclaw/control-ui-config.json` | [src/gateway/control-ui.ts](src/gateway/control-ui.ts), [src/gateway/control-ui-routing.ts](src/gateway/control-ui-routing.ts), [src/gateway/control-ui-contract.ts](src/gateway/control-ui-contract.ts) |
| Plugin-registered routes | HTTP | dynamic; protected prefix `/api/channels` | [src/gateway/server/plugins-http.ts](src/gateway/server/plugins-http.ts), [src/gateway/security-path.ts:156](src/gateway/security-path.ts#L156) |
| MCP loopback (separate server) | HTTP | `/mcp` | [src/gateway/mcp-http.request.ts](src/gateway/mcp-http.request.ts) |
| Gateway WebSocket RPC | WS | upgrade on Gateway HTTP server | [src/gateway/methods/core-descriptors.ts](src/gateway/methods/core-descriptors.ts), [docs/gateway/protocol.md](docs/gateway/protocol.md) |

HTTP request dispatch order is fixed in [src/gateway/server-http.ts:576](src/gateway/server-http.ts#L576).
Built-in routes always win over plugin routes on overlapping paths; the SPA
catch-all runs last.

## HTTP endpoints

### Liveness and readiness

Auth is not required for `live`. Readiness details are revealed only to local
or authorized callers; unauthenticated remote callers get a `{"ready": …}`
boolean and the matching status code.

| Method | Path | Status | Notes | Source |
|---|---|---|---|---|
| `GET` `HEAD` | `/health` | live | `200 {ok:true,status:"live"}` | [server-http.ts:157](src/gateway/server-http.ts#L157) |
| `GET` `HEAD` | `/healthz` | live | alias | [server-http.ts:159](src/gateway/server-http.ts#L159) |
| `GET` `HEAD` | `/ready` | ready | `200`/`503` from `getReadiness()` | [server-http.ts:160](src/gateway/server-http.ts#L160) |
| `GET` `HEAD` | `/readyz` | ready | alias | [server-http.ts:161](src/gateway/server-http.ts#L161) |

### Webhooks

Token via `Authorization: Bearer <token>` or `X-OpenClaw-Token`. Query
`?token=` is rejected with 400. Default base path is `/hooks` — override with
`gateway.hooks.basePath`.

| Method | Path | Purpose | Source |
|---|---|---|---|
| `POST` | `<basePath>/wake` | Schedule an immediate / next-heartbeat wake | [hooks-request-handler.ts:253](src/gateway/server/hooks-request-handler.ts#L253) |
| `POST` | `<basePath>/agent` | Dispatch a message to a specific agent / session | [hooks-request-handler.ts:264](src/gateway/server/hooks-request-handler.ts#L264) |
| `POST` | `<basePath>/<mapping>` | User-defined hook mappings (Gmail, custom) | [hooks-request-handler.ts:333](src/gateway/server/hooks-request-handler.ts#L333), [hooks-mapping.ts](src/gateway/hooks-mapping.ts) |

Default `DEFAULT_HOOKS_PATH = "/hooks"` is at [hooks.ts:22](src/gateway/hooks.ts#L22).

### OpenAI-compatible

All routes require Gateway auth (bearer). Gated by config flags
`gateway.http.chatCompletions.enabled` / `gateway.http.responses.enabled`;
`/v1/models` and `/v1/embeddings` come up when either flag enables OpenAI
compat. Deep-dive docs: [openai-http-api](../gateway/openai-http-api),
[openresponses-http-api](../gateway/openresponses-http-api).

| Method | Path | Purpose | Source |
|---|---|---|---|
| `GET` | `/v1/models` | List runtime-allowed models | [models-http.ts:105](src/gateway/models-http.ts#L105) |
| `GET` | `/v1/models/{model}` | Single model record | [models-http.ts](src/gateway/models-http.ts) |
| `POST` | `/v1/embeddings` | OpenAI-compat embeddings | [embeddings-http.ts](src/gateway/embeddings-http.ts) |
| `POST` | `/v1/chat/completions` | OpenAI-compat chat completions | [openai-http.ts](src/gateway/openai-http.ts) |
| `POST` | `/v1/responses` | OpenAI Responses-compat | [openresponses-http.ts](src/gateway/openresponses-http.ts) |

### Tool invocation

| Method | Path | Purpose | Source |
|---|---|---|---|
| `POST` | `/tools/invoke` | Direct tool invocation (see [tools-invoke-http-api](../gateway/tools-invoke-http-api)) | [tools-invoke-http.ts:36](src/gateway/tools-invoke-http.ts#L36) |

### Session control (HTTP)

`:sessionKey` is URL-encoded.

| Method | Path | Purpose | Source |
|---|---|---|---|
| `POST` | `/sessions/:sessionKey/kill` | Force-terminate a session | [session-kill-http.ts:32](src/gateway/session-kill-http.ts#L32) |
| `GET` | `/sessions/:sessionKey/history` | Transcript history (see deep-dive) | [session-history-http.ts](src/gateway/session-history-http.ts) |

### Managed media

| Method | Path | Purpose | Source |
|---|---|---|---|
| `GET` | `/api/chat/media/outgoing/...` | Managed outgoing image attachments | [managed-image-attachments.ts:30](src/gateway/managed-image-attachments.ts#L30) |

### Control UI

Active only when `gateway.controlUi.enabled`. The SPA basePath is configurable
(`gateway.controlUi.basePath`). Two well-known paths are constant regardless
of base path.

| Method | Path | Purpose | Source |
|---|---|---|---|
| `GET` | `<basePath>` / `<basePath>/...` | SPA + assets | [control-ui.ts](src/gateway/control-ui.ts), routing in [control-ui-routing.ts:19](src/gateway/control-ui-routing.ts#L19) |
| `GET` | `<basePath>/avatar/...` | Avatar serving | [control-ui.ts:642](src/gateway/control-ui.ts#L642) |
| `GET` | `/__openclaw__/assistant-media/...` | Assistant-rendered media | [control-ui.ts:58](src/gateway/control-ui.ts#L58) |
| `GET` | `/__openclaw/control-ui-config.json` | Bootstrap config | [control-ui-contract.ts:1](src/gateway/control-ui-contract.ts#L1) |

Note: Control UI runs **last** so plugin routes and core endpoints win on
collisions. The SPA catch-all only serves read-method requests and skips
`/api/...`, `/plugins/...`, `/ui/...`, and the probe paths — see the rules in
[control-ui-routing.ts:17](src/gateway/control-ui-routing.ts#L17).

### Plugin-registered routes

Plugins register HTTP routes dynamically through the SDK. Matching is by
pattern, not a fixed list — see [src/gateway/server/plugins-http.ts](src/gateway/server/plugins-http.ts)
for the matching pipeline. Paths under the protected prefix
`/api/channels` always require Gateway auth, regardless of plugin opt-in
(see [security-path.ts:156](src/gateway/security-path.ts#L156)). Per-plugin
documented routes belong in that plugin's own page under
[docs/plugins/](docs/plugins/).

### MCP loopback

Served by a **separate** loopback HTTP server, not the Gateway HTTP server.
Bearer auth uses dedicated owner / non-owner tokens. Browser origins are
rejected.

| Method | Path | Purpose | Source |
|---|---|---|---|
| `POST` | `/mcp` | MCP JSON-RPC entry (`tools/list`, `tools/call`, …) | [mcp-http.request.ts:92](src/gateway/mcp-http.request.ts#L92) |
| `GET` | `/.well-known/*` | Reserved; returns 404 | [mcp-http.request.ts:86](src/gateway/mcp-http.request.ts#L86) |

## WebSocket

The Gateway WS surface is documented at [Gateway protocol](../gateway/protocol);
the [bridge protocol](../gateway/bridge-protocol) covers node-bridge specifics.
Connection lifecycle, handshake, framing, scopes, and event families live there.

The list below is the **canonical method registry**. It is generated from
`CORE_GATEWAY_METHOD_SPECS` in
[src/gateway/methods/core-descriptors.ts:18](src/gateway/methods/core-descriptors.ts#L18).
`hello-ok.features.methods` advertises a subset filtered by `advertise !== false`
plus runtime channel-plugin methods (see "Channel-plugin methods" below).

Scope values: `operator.read`, `operator.write`, `operator.admin`,
`operator.approvals`, `operator.pairing`, `operator.talk.secrets`,
`node` (node-only), `dynamic` (plugin-driven, resolved per call).

### Core RPC methods

#### System / identity / status

| Method | Scope | Source |
|---|---|---|
| `health` | `operator.read` | core-descriptors.ts |
| `status` | `operator.read` | core-descriptors.ts |
| `diagnostics.stability` | `operator.read` | core-descriptors.ts |
| `gateway.identity.get` | `operator.read` | core-descriptors.ts |
| `gateway.restart.preflight` | `operator.read` | core-descriptors.ts |
| `gateway.restart.request` | `operator.admin` | core-descriptors.ts |
| `system-presence` | `operator.read` | core-descriptors.ts |
| `system-event` | `operator.admin` | core-descriptors.ts |
| `last-heartbeat` | `operator.read` | core-descriptors.ts |
| `set-heartbeats` | `operator.admin` | core-descriptors.ts |
| `logs.tail` | `operator.read` | core-descriptors.ts |
| `connect` *(unadvertised)* | `operator.admin` | core-descriptors.ts |
| `poll` *(unadvertised)* | `operator.write` | core-descriptors.ts |

#### Doctor / memory

| Method | Scope |
|---|---|
| `doctor.memory.status` | `operator.read` |
| `doctor.memory.dreamDiary` | `operator.read` |
| `doctor.memory.remHarness` | `operator.read` |
| `doctor.memory.backfillDreamDiary` | `operator.write` |
| `doctor.memory.resetDreamDiary` | `operator.write` |
| `doctor.memory.resetGroundedShortTerm` | `operator.write` |
| `doctor.memory.repairDreamingArtifacts` | `operator.write` |
| `doctor.memory.dedupeDreamDiary` | `operator.write` |

#### Channels / login / push / wake-word

| Method | Scope |
|---|---|
| `channels.status` | `operator.read` |
| `channels.start` | `operator.admin` |
| `channels.stop` | `operator.admin` |
| `channels.logout` | `operator.admin` |
| `web.login.start` *(unadvertised)* | `operator.admin` |
| `web.login.wait` *(unadvertised)* | `operator.admin` |
| `push.test` *(unadvertised)* | `operator.write` |
| `push.web.vapidPublicKey` *(unadvertised)* | `operator.write` |
| `push.web.subscribe` *(unadvertised)* | `operator.write` |
| `push.web.unsubscribe` *(unadvertised)* | `operator.write` |
| `push.web.test` *(unadvertised)* | `operator.write` |
| `voicewake.get` | `operator.read` |
| `voicewake.set` | `operator.write` |
| `voicewake.routing.get` | `operator.read` |
| `voicewake.routing.set` | `operator.write` |

#### Models / usage

| Method | Scope |
|---|---|
| `models.list` | `operator.read` |
| `models.authStatus` | `operator.read` |
| `models.authLogout` | `operator.admin` |
| `usage.status` | `operator.read` |
| `usage.cost` | `operator.read` |

#### Talk / TTS

| Method | Scope |
|---|---|
| `talk.catalog` | `operator.read` |
| `talk.config` | `operator.read` |
| `talk.client.create` | `operator.write` |
| `talk.client.toolCall` | `operator.write` |
| `talk.client.steer` | `operator.write` |
| `talk.session.create` | `operator.write` |
| `talk.session.join` | `operator.write` |
| `talk.session.appendAudio` | `operator.write` |
| `talk.session.startTurn` | `operator.write` |
| `talk.session.endTurn` | `operator.write` |
| `talk.session.cancelTurn` | `operator.write` |
| `talk.session.cancelOutput` | `operator.write` |
| `talk.session.submitToolResult` | `operator.write` |
| `talk.session.steer` | `operator.write` |
| `talk.session.close` | `operator.write` |
| `talk.speak` | `operator.write` |
| `talk.mode` | `operator.write` |
| `tts.status` | `operator.read` |
| `tts.providers` | `operator.read` |
| `tts.personas` | `operator.read` |
| `tts.enable` | `operator.write` |
| `tts.disable` | `operator.write` |
| `tts.convert` | `operator.write` |
| `tts.setProvider` | `operator.write` |
| `tts.setPersona` | `operator.write` |

Note: `talk.config` includes secrets only when the caller has
`operator.talk.secrets` (or `operator.admin`).

#### Config / secrets / wizard / update

| Method | Scope |
|---|---|
| `config.get` | `operator.read` |
| `config.set` | `operator.admin` |
| `config.apply` | `operator.admin` |
| `config.patch` | `operator.admin` |
| `config.schema` | `operator.admin` |
| `config.schema.lookup` | `operator.read` |
| `config.openFile` *(unadvertised)* | `operator.admin` |
| `secrets.reload` | `operator.admin` |
| `secrets.resolve` | `operator.admin` |
| `wizard.start` | `operator.admin` |
| `wizard.next` | `operator.admin` |
| `wizard.status` | `operator.admin` |
| `wizard.cancel` | `operator.admin` |
| `update.status` | `operator.admin` |
| `update.run` | `operator.admin` |

#### Agents / workspaces / artifacts / environments / tasks

| Method | Scope |
|---|---|
| `agents.list` | `operator.read` |
| `agents.create` | `operator.admin` |
| `agents.update` | `operator.admin` |
| `agents.delete` | `operator.admin` |
| `agents.files.list` | `operator.read` |
| `agents.files.get` | `operator.read` |
| `agents.files.set` | `operator.admin` |
| `artifacts.list` | `operator.read` |
| `artifacts.get` | `operator.read` |
| `artifacts.download` | `operator.read` |
| `environments.list` | `operator.read` |
| `environments.status` | `operator.read` |
| `tasks.list` | `operator.read` |
| `tasks.get` | `operator.read` |
| `tasks.cancel` | `operator.write` |
| `agent.identity.get` | `operator.read` |
| `agent.wait` | `operator.write` |
| `agent` | `operator.write` |
| `message.action` | `operator.write` |

#### Sessions / chat

| Method | Scope |
|---|---|
| `sessions.list` | `operator.read` |
| `sessions.subscribe` | `operator.read` |
| `sessions.unsubscribe` | `operator.read` |
| `sessions.messages.subscribe` | `operator.read` |
| `sessions.messages.unsubscribe` | `operator.read` |
| `sessions.preview` | `operator.read` |
| `sessions.describe` | `operator.read` |
| `sessions.compaction.list` | `operator.read` |
| `sessions.compaction.get` | `operator.read` |
| `sessions.compaction.branch` | `operator.write` |
| `sessions.compaction.restore` | `operator.admin` |
| `sessions.create` | `operator.write` |
| `sessions.send` | `operator.write` |
| `sessions.abort` | `operator.write` |
| `sessions.patch` | `operator.admin` |
| `sessions.pluginPatch` | `operator.admin` |
| `sessions.cleanup` | `operator.admin` |
| `sessions.reset` | `operator.admin` |
| `sessions.delete` | `operator.admin` |
| `sessions.compact` | `operator.admin` |
| `sessions.get` *(unadvertised)* | `operator.read` |
| `sessions.resolve` *(unadvertised)* | `operator.read` |
| `sessions.usage` *(unadvertised)* | `operator.read` |
| `sessions.usage.timeseries` *(unadvertised)* | `operator.read` |
| `sessions.usage.logs` *(unadvertised)* | `operator.read` |
| `sessions.steer` *(unadvertised)* | `operator.write` |
| `chat.history` | `operator.read` |
| `chat.send` | `operator.write` |
| `chat.abort` | `operator.write` |
| `chat.inject` *(unadvertised)* | `operator.admin` |
| `send` | `operator.write` |
| `wake` | `operator.write` |
| `assistant.media.get` *(unadvertised)* | `operator.read` |

#### Skills / tools / commands

| Method | Scope |
|---|---|
| `commands.list` | `operator.read` |
| `tools.catalog` | `operator.read` |
| `tools.effective` | `operator.read` |
| `tools.invoke` | `operator.write` |
| `skills.status` | `operator.read` |
| `skills.search` | `operator.read` |
| `skills.detail` | `operator.read` |
| `skills.bins` | `node` |
| `skills.upload.begin` | `operator.admin` |
| `skills.upload.chunk` | `operator.admin` |
| `skills.upload.commit` | `operator.admin` |
| `skills.install` | `operator.admin` |
| `skills.update` | `operator.admin` |

#### Approvals (exec + plugin)

| Method | Scope |
|---|---|
| `exec.approval.get` | `operator.approvals` |
| `exec.approval.list` | `operator.approvals` |
| `exec.approval.request` | `operator.approvals` |
| `exec.approval.waitDecision` | `operator.approvals` |
| `exec.approval.resolve` | `operator.approvals` |
| `exec.approvals.get` | `operator.admin` |
| `exec.approvals.set` | `operator.admin` |
| `exec.approvals.node.get` | `operator.admin` |
| `exec.approvals.node.set` | `operator.admin` |
| `plugin.approval.list` | `operator.approvals` |
| `plugin.approval.request` | `operator.approvals` |
| `plugin.approval.waitDecision` | `operator.approvals` |
| `plugin.approval.resolve` | `operator.approvals` |
| `plugins.uiDescriptors` | `operator.read` |
| `plugins.sessionAction` | `dynamic` |

#### Cron

| Method | Scope |
|---|---|
| `cron.get` | `operator.read` |
| `cron.list` | `operator.read` |
| `cron.status` | `operator.read` |
| `cron.runs` | `operator.read` |
| `cron.add` | `operator.admin` |
| `cron.update` | `operator.admin` |
| `cron.remove` | `operator.admin` |
| `cron.run` | `operator.admin` |

#### Devices

| Method | Scope |
|---|---|
| `device.pair.list` | `operator.pairing` |
| `device.pair.approve` | `operator.pairing` |
| `device.pair.reject` | `operator.pairing` |
| `device.pair.remove` | `operator.pairing` |
| `device.token.rotate` | `operator.pairing` |
| `device.token.revoke` | `operator.pairing` |

#### Nodes (operator-side)

| Method | Scope |
|---|---|
| `node.pair.request` | `operator.pairing` |
| `node.pair.list` | `operator.pairing` |
| `node.pair.approve` | `operator.pairing` |
| `node.pair.reject` | `operator.pairing` |
| `node.pair.remove` | `operator.pairing` |
| `node.pair.verify` | `operator.pairing` |
| `node.rename` | `operator.pairing` |
| `node.list` | `operator.read` |
| `node.describe` | `operator.read` |
| `node.invoke` | `operator.write` |
| `node.pending.enqueue` | `operator.write` |

#### Nodes (node-side, scope `node`)

| Method |
|---|
| `node.pluginSurface.refresh` |
| `node.pending.drain` |
| `node.pending.pull` |
| `node.pending.ack` |
| `node.invoke.result` |
| `node.event` |
| `nativeHook.invoke` *(unadvertised; `operator.admin`)* |

### Aux methods

`GATEWAY_AUX_METHODS` in [server-aux-methods.ts](src/gateway/server-aux-methods.ts)
re-advertises a subset of approval and secret methods for clients that scan
`hello-ok.features.methods`. Scopes match the core entries above.

### Channel-plugin methods

Loaded channel plugins contribute additional methods at runtime via
`gatewayMethods` / `gatewayMethodDescriptors` on the plugin module
(see [server-methods-list.ts:16](src/gateway/server-methods-list.ts#L16)).
These are discovered dynamically per install — there is no static list.
Refer to each plugin's reference page under [docs/plugins/](docs/plugins/).

### Events

Broadcast event names are listed at
[server-methods-list.ts:32](src/gateway/server-methods-list.ts#L32) (`GATEWAY_EVENTS`).
Event families and their payload shapes are documented in
[Gateway protocol — Common event families](../gateway/protocol#common-event-families).

## How to regenerate this list

1. **HTTP routes** — re-read the dispatch stages at
   [src/gateway/server-http.ts:576](src/gateway/server-http.ts#L576). Each
   `requestStages.push({ name, run })` entry is a route family; the matching
   `is*Path()` helper above gives the URL shape.
2. **WS RPC methods** — re-export the names + scopes from
   `CORE_GATEWAY_METHOD_SPECS` in
   [src/gateway/methods/core-descriptors.ts](src/gateway/methods/core-descriptors.ts).
   `advertise: false` entries are the unadvertised rows.
3. **Aux re-advertisement** — [src/gateway/server-aux-methods.ts](src/gateway/server-aux-methods.ts).
4. **Events** — `GATEWAY_EVENTS` in
   [src/gateway/server-methods-list.ts:32](src/gateway/server-methods-list.ts#L32).
5. **MCP loopback** — [src/gateway/mcp-http.request.ts](src/gateway/mcp-http.request.ts).

When you add, rename, or remove an endpoint, update this page in the same
change so client teams aren't reading stale docs.

## Related

- [Gateway protocol](../gateway/protocol)
- [Gateway bridge protocol](../gateway/bridge-protocol)
- [OpenAI HTTP API](../gateway/openai-http-api)
- [OpenAI Responses HTTP API](../gateway/openresponses-http-api)
- [Tools invoke HTTP API](../gateway/tools-invoke-http-api)
- [Authentication](../gateway/authentication)
- [Operator scopes](../gateway/operator-scopes)
- [RPC adapters](./rpc)
