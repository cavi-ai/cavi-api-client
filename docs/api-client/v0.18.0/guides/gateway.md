---
documentedVersion: 0.18.0
---

# Access gateway resources

Configure Hermes or OpenClaw with [provider setup](providers.md). Their facade
can expose sessions, tasks, models, usage, workspace, teams, kanban, media, wiki,
and agent configuration, subject to the configured gateway's capabilities.

The [gateway resource helper](../examples/gateway-resources.ts) lists sessions
and handles both live data and a structured gap. The nested list envelope is
different from a raw array: inspect the declared result shape.

Use `getCapabilityMap()` to choose visible features, but continue handling each
call's `ok`. A missing plugin, permission, manifest, or backend can produce a
gap after discovery.

## Resource ownership

- Sessions and tasks belong to the upstream runtime/control plane.
- Teams can resolve from a manifest or explicit backend.
- Workspace paths must follow the configured identity and allowed path contract.
- OpenClaw media/wiki use native RPC and plugins.
- CAVI portal, registry, library, and product-board behavior belongs to the
  [CAVI extension reference](../reference/extensions-cavi.md), not every gateway.

Dispose the facade when its application owner shuts down. Do not create a new
connection for every render or list refresh.

[Sessions and configuration](../operations/gateway/sessions.md) ·
[Teams and kanban](../operations/gateway/teams.md) ·
[Media and wiki](../operations/gateway/media-wiki.md) ·
[Control plane](../operations/gateway/control-plane.md)
