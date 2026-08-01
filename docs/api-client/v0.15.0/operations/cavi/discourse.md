---
documentedVersion: 0.15.0
---

# Discourse operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The discourse surface loads the per-task discourse tree (agent messages,
blockers, resolutions, completion outcomes) for the cavi-control operator plane.
It is a divergence point: it prefers the native WebSocket RPC `discourse.tree`,
falls back to the operator-task discourse REST endpoint (canonical path first,
plugin-alias path second), and normalizes whichever payload it gets into the
`TaskDiscourseSnapshot` DTO.

Route/RPC owners: `CAVI_CONTROL_OPERATOR_RPC_METHODS.discourseTree` and the
`operatorTaskDiscoursePath` / `operatorTaskDiscoursePluginAliasPath` helpers in
`extensions/cavi/contracts/paths.ts`;
the surface key is `cavi.operator.taskDiscourse`.

Source:
`extensions/cavi/discourse/`.

## Loader

### loadTaskDiscourseLive

**Signature** `loadTaskDiscourseLive(requestJson: JsonHttpRequest, wsClient: GatewayWebSocketClient | null, taskId: string): Promise<TaskDiscourseSnapshot>`
**HTTP** `gateway RPC discourse.tree` → fallback `GET` `operatorTaskDiscoursePath(taskId)` → `GET` `operatorTaskDiscoursePluginAliasPath(taskId)`
**Capability** gateway
**Upstream equivalent** gateway RPC `discourse.tree` (cavi-control operator plane)
**CAVI value-add** Chooses transport (WS RPC when a `wsClient` is present, else HTTP), tries the canonical operator path then the plugin-alias path, and normalizes every payload shape into a single `TaskDiscourseSnapshot`. The `discourse.tree` RPC returns raw tree data; this helper is the only place that reconciles the two transports and produces the typed snapshot.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| requestJson | `JsonHttpRequest` | yes | HTTP transport for the REST fallback. |
| wsClient | `GatewayWebSocketClient \| null` | no | When present, tried first via `discourse.tree`. |
| taskId | `string` | yes | Operator task id (trimmed; empty throws). |

#### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| taskId | `string` | Echoed task id. |
| events | `DiscourseEvent[]` | Normalized message / blocker / resolution / completion events. |

#### Example

```ts
const snapshot = await loadTaskDiscourseLive(requestJson, wsClient, "task_42");
for (const event of snapshot.events) {
  console.log(event.type, event.at);
}
```

## Normalization helpers

`normalizeTaskDiscourseSnapshot`, `normalizeDiscourseEvent`, and the
`asDiscourse*` coercion helpers are client-side (`n/a` capability) building
blocks used by `loadTaskDiscourseLive`. They have no upstream equivalent — they
exist to turn loosely-typed gateway payloads into the strict `TaskDiscourse*`
domain types, and `fallbackTaskDiscourse(taskId)` supplies the degraded-mode
snapshot. Documented here as internal surface; consumers normally call
`loadTaskDiscourseLive`.
