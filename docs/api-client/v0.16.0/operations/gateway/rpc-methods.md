---
documentedVersion: 0.16.0
---

# Gateway WebSocket RPC methods

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

These methods dispatch over the gateway JSON-RPC WebSocket transport
(`{{gatewayWsUrl}}/api/ws`), not over REST — so every operation's `**HTTP**`
line is the RPC method name, not a path. `OpenClawWebSocketClient` keeps the
authenticated OpenClaw gateway handshake and exposes `subscribe(listener)`,
`request(method, params, { signal })`, and `dispose()`; cancelling one request
does not unsubscribe other listeners. Native Workboard methods are surfaced by
the provider-agnostic `KanbanClient` (`@cavi-ai/api-client/core/kanban`); the
OpenClaw Workboard adapter maps its canonical card/status types onto the RPC
calls below. Method names mirror the upstream OpenClaw contract.

<!-- Workboard — cards -->

## workboard.cards.list

**HTTP** `gateway RPC workboard.cards.list`
**Capability** gateway

List native Workboard cards, optionally scoped by board.

## workboard.cards.export

**HTTP** `gateway RPC workboard.cards.export`
**Capability** gateway

Export card data.

## workboard.cards.diagnostics

**HTTP** `gateway RPC workboard.cards.diagnostics`
**Capability** gateway

Read Workboard diagnostics.

## workboard.cards.stats

**HTTP** `gateway RPC workboard.cards.stats`
**Capability** gateway

Read Workboard card status/priority stats.

## workboard.cards.runs

**HTTP** `gateway RPC workboard.cards.runs`
**Capability** gateway

Read Workboard-linked run data.

## workboard.cards.create

**HTTP** `gateway RPC workboard.cards.create`
**Capability** gateway

Create a Workboard card.

## workboard.cards.update

**HTTP** `gateway RPC workboard.cards.update`
**Capability** gateway

Patch card fields.

## workboard.cards.move

**HTTP** `gateway RPC workboard.cards.move`
**Capability** gateway

Move a card to another Workboard status.

## workboard.cards.delete

**HTTP** `gateway RPC workboard.cards.delete`
**Capability** gateway

Delete a card.

## workboard.cards.comment

**HTTP** `gateway RPC workboard.cards.comment`
**Capability** gateway

Add a card comment.

## workboard.cards.link

**HTTP** `gateway RPC workboard.cards.link`
**Capability** gateway

Link a card to an external object.

## workboard.cards.linkDependency

**HTTP** `gateway RPC workboard.cards.linkDependency`
**Capability** gateway

Link card dependency relationships.

## workboard.cards.proof

**HTTP** `gateway RPC workboard.cards.proof`
**Capability** gateway

Attach proof metadata to a card.

## workboard.cards.artifact

**HTTP** `gateway RPC workboard.cards.artifact`
**Capability** gateway

Attach artifact metadata to a card.

## workboard.cards.claim

**HTTP** `gateway RPC workboard.cards.claim`
**Capability** gateway

Claim a card for an agent/operator.

## workboard.cards.heartbeat

**HTTP** `gateway RPC workboard.cards.heartbeat`
**Capability** gateway

Send card worker heartbeat.

## workboard.cards.release

**HTTP** `gateway RPC workboard.cards.release`
**Capability** gateway

Release a claimed card.

## workboard.cards.promote

**HTTP** `gateway RPC workboard.cards.promote`
**Capability** gateway

Promote a card through Workboard flow.

## workboard.cards.reassign

**HTTP** `gateway RPC workboard.cards.reassign`
**Capability** gateway

Reassign a card.

## workboard.cards.reclaim

**HTTP** `gateway RPC workboard.cards.reclaim`
**Capability** gateway

Reclaim a stale card.

## workboard.cards.complete

**HTTP** `gateway RPC workboard.cards.complete`
**Capability** gateway

Complete a card.

## workboard.cards.block

**HTTP** `gateway RPC workboard.cards.block`
**Capability** gateway

Block a card.

## workboard.cards.unblock

**HTTP** `gateway RPC workboard.cards.unblock`
**Capability** gateway

Unblock a card.

## workboard.cards.bulk

**HTTP** `gateway RPC workboard.cards.bulk`
**Capability** gateway

Apply bulk card operations.

## workboard.cards.diagnostics.refresh

**HTTP** `gateway RPC workboard.cards.diagnostics.refresh`
**Capability** gateway

Refresh Workboard diagnostics.

## workboard.cards.dispatch

**HTTP** `gateway RPC workboard.cards.dispatch`
**Capability** gateway

Dispatch queued Workboard card work.

## workboard.cards.specify

**HTTP** `gateway RPC workboard.cards.specify`
**Capability** gateway

Specify card work.

## workboard.cards.decompose

**HTTP** `gateway RPC workboard.cards.decompose`
**Capability** gateway

Decompose card work.

## workboard.cards.archive

**HTTP** `gateway RPC workboard.cards.archive`
**Capability** gateway

Archive a card.

<!-- Workboard — boards -->

## workboard.boards.list

**HTTP** `gateway RPC workboard.boards.list`
**Capability** gateway

List Workboard boards.

## workboard.boards.upsert

**HTTP** `gateway RPC workboard.boards.upsert`
**Capability** gateway

Create or update a board.

## workboard.boards.archive

**HTTP** `gateway RPC workboard.boards.archive`
**Capability** gateway

Archive a board.

## workboard.boards.delete

**HTTP** `gateway RPC workboard.boards.delete`
**Capability** gateway

Delete a board.

<!-- Workboard — notifications -->

## workboard.notifications.subscribe

**HTTP** `gateway RPC workboard.notifications.subscribe`
**Capability** gateway

Subscribe to Workboard notifications.

## workboard.notifications.list

**HTTP** `gateway RPC workboard.notifications.list`
**Capability** gateway

List Workboard notifications.

## workboard.notifications.delete

**HTTP** `gateway RPC workboard.notifications.delete`
**Capability** gateway

Delete a Workboard notification.

## workboard.notifications.events

**HTTP** `gateway RPC workboard.notifications.events`
**Capability** gateway

Read Workboard notification events.

## workboard.notifications.advance

**HTTP** `gateway RPC workboard.notifications.advance`
**Capability** gateway

Advance notification cursor/state.

<!-- Workboard — attachments -->

## workboard.cards.attachments.list

**HTTP** `gateway RPC workboard.cards.attachments.list`
**Capability** gateway

List card attachments.

## workboard.cards.attachments.get

**HTTP** `gateway RPC workboard.cards.attachments.get`
**Capability** gateway

Fetch a card attachment.

## workboard.cards.attachments.add

**HTTP** `gateway RPC workboard.cards.attachments.add`
**Capability** gateway

Add a card attachment.

## workboard.cards.attachments.delete

**HTTP** `gateway RPC workboard.cards.attachments.delete`
**Capability** gateway

Delete a card attachment.

<!-- Workboard — workers -->

## workboard.cards.workerLog

**HTTP** `gateway RPC workboard.cards.workerLog`
**Capability** gateway

Append Workboard worker log data.

## workboard.cards.protocolViolation

**HTTP** `gateway RPC workboard.cards.protocolViolation`
**Capability** gateway

Record a worker protocol violation.

<!-- System -->

## health

**HTTP** `gateway RPC health`
**Capability** gateway

Core health RPC.

## health.snapshot

**HTTP** `gateway RPC health.snapshot`
**Capability** gateway

Legacy health snapshot fallback.

## status

**HTTP** `gateway RPC status`
**Capability** gateway

OpenClaw status RPC.

## logs.tail

**HTTP** `gateway RPC logs.tail`
**Capability** gateway

Tail gateway logs.

<!-- Agent -->

## agent.wait

**HTTP** `gateway RPC agent.wait`
**Capability** gateway

Wait for agent readiness.

<!-- Config -->

## config.get

**HTTP** `gateway RPC config.get`
**Capability** gateway

Fetch runtime config.

## config.schema

**HTTP** `gateway RPC config.schema`
**Capability** gateway

Fetch runtime config schema.

<!-- Catalog -->

## models.list

**HTTP** `gateway RPC models.list`
**Capability** gateway

List models.

## commands.list

**HTTP** `gateway RPC commands.list`
**Capability** gateway

List commands.

## tools.catalog

**HTTP** `gateway RPC tools.catalog`
**Capability** gateway

List available tools.

## agents.list

**HTTP** `gateway RPC agents.list`
**Capability** gateway

List agents.

<!-- Sessions -->

## sessions.list

**HTTP** `gateway RPC sessions.list`
**Capability** gateway

List sessions.

## sessions.preview

**HTTP** `gateway RPC sessions.preview`
**Capability** gateway

Fetch compact session previews.

## sessions.describe

**HTTP** `gateway RPC sessions.describe`
**Capability** gateway

Describe a session.

## sessions.usage

**HTTP** `gateway RPC sessions.usage`
**Capability** gateway

Fetch session usage data.

## sessions.create

**HTTP** `gateway RPC sessions.create`
**Capability** gateway

Create a session.

## sessions.resolve

**HTTP** `gateway RPC sessions.resolve`
**Capability** gateway

Resolve a session key.

## sessions.send

**HTTP** `gateway RPC sessions.send`
**Capability** gateway

Send to a session.

## sessions.steer

**HTTP** `gateway RPC sessions.steer`
**Capability** gateway

Steer session behavior.

## sessions.abort

**HTTP** `gateway RPC sessions.abort`
**Capability** gateway

Abort session work.

## sessions.patch

**HTTP** `gateway RPC sessions.patch`
**Capability** gateway

Patch session settings.

<!-- Chat -->

## chat.send

**HTTP** `gateway RPC chat.send`
**Capability** gateway

Send a chat message.

## chat.abort

**HTTP** `gateway RPC chat.abort`
**Capability** gateway

Abort chat work.

<!-- CAVI Operator -->

## operator.status

**HTTP** `gateway RPC operator.status`
**Capability** gateway

Fetch CAVI operator status.

## operator.registry.get

**HTTP** `gateway RPC operator.registry.get`
**Capability** gateway

Fetch CAVI operator registry.

## operator.snapshot

**HTTP** `gateway RPC operator.snapshot`
**Capability** gateway

Fetch CAVI operator snapshot.

## operator.memory.list

**HTTP** `gateway RPC operator.memory.list`
**Capability** gateway

List operator memory entries.

## operator.tasks.list

**HTTP** `gateway RPC operator.tasks.list`
**Capability** gateway

List operator tasks.

## operator.tasks.get

**HTTP** `gateway RPC operator.tasks.get`
**Capability** gateway

Fetch operator task detail.

## discourse.tree

**HTTP** `gateway RPC discourse.tree`
**Capability** gateway

Fetch discourse tree.

## operator.worker.ready

**HTTP** `gateway RPC operator.worker.ready`
**Capability** gateway

Fetch worker readiness.

## operator.worker.tasks.list

**HTTP** `gateway RPC operator.worker.tasks.list`
**Capability** gateway

List worker tasks.

## operator.worker.tasks.get

**HTTP** `gateway RPC operator.worker.tasks.get`
**Capability** gateway

Fetch worker task detail.
