---
documentedVersion: {{documentedVersion}}
---

# Build a gateway resource view

Configure [Hermes or OpenClaw](providers.md). Their facade can expose sessions,
tasks, models, usage, workspace, teams, kanban, media, wiki, and agent
configuration when the instance supplies the required backends and permissions.

Use discovery to choose visible controls, then handle every call result.
This function returns distinct unavailable and live states so a missing
capability cannot masquerade as an empty session list.

```ts
import type { CapabilityClient } from "@cavi-ai/api-client";

export async function getSessionPage(client: CapabilityClient, cursor?: string) {
  const result = await client.sessions.listSessions({ cursor, limit: 25 });
  if (!result.ok) return { kind: "unavailable" as const, gap: result.gap };
  return {
    kind: "sessions" as const,
    items: result.data.data,
    nextCursor: result.data.nextCursor,
  };
}
```

Render `items` only for the `sessions` state; use `nextCursor` for the next
page when the backend provides it. Authentication/unclassified errors still
reject, so use an exception boundary. The nested list result is a
`RuntimePage`, not a raw array.

## Respect resource ownership

- Sessions and tasks belong to the upstream runtime/control plane.
- Teams can resolve from a manifest or explicit backend.
- Workspace paths follow configured identity and allowed path contracts.
- OpenClaw media/wiki depend on native RPC and plugins.
- CAVI portal, library, registry, and product-board adapters live in the
  [CAVI extension](../reference/extensions-cavi.md), not every gateway.

Keep one client per credential/configuration scope. Dispose at owner shutdown,
not after each refresh or render. Resource availability can change after
discovery; refresh capabilities when configuration changes.

[Capabilities](../concepts/routing-and-capabilities.md) ·
[Sessions](../operations/gateway/sessions.md) · [Control plane](../operations/gateway/control-plane.md)
