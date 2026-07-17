---
documentedVersion: 0.12.0
---

# Gateway sessions & agent config operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Session REST routes (`GATEWAY_SESSION_API_PATHS`) are HTTP fallbacks for the
WebSocket RPC session methods — see [rpc-methods](rpc-methods.md). Agent config and
profile routes come from `GATEWAY_AGENT_CONFIG_API_ENDPOINTS`. Core snapshot
loaders accept a provider-neutral `GatewaySessionOperations` port; the default
`createOpenClawSessionOperations` adapter keeps the plural `sessions.*` RPC names
and the REST mappings below. Path literals are owned by `src/contracts/paths.ts`.

## sessions.list

**HTTP** `GET /api/sessions/list`
**Capability** gateway

List sessions with filters such as `limit`, `search`, `agentId`, and
`activeMinutes`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| limit | number | no | Query param — max sessions to return. |
| search | string | no | Query param — free-text filter. |
| agentId | string | no | Query param — scope to one agent. |
| activeMinutes | number | no | Query param — recent-activity window. |

## sessions.usage

**HTTP** `GET /api/sessions/usage`
**Capability** gateway

Fetch session usage and aggregate cost/token data.

## sessions.preview

**HTTP** `POST /api/sessions/preview`
**Capability** gateway

Fetch compact previews for selected session keys.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| keys | string[] | yes | Session keys to preview. |

## sessions.detail

**HTTP** `POST /api/sessions/detail`
**Capability** gateway

Fetch detail for one session key.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| key | string | yes | Session key to fetch. |

## sessions.patch

**HTTP** `PATCH /api/sessions/patch`
**Capability** gateway

Mutate per-session operator settings such as label or thinking level.

### Request body

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| key | string | yes | Session key to mutate. |
| label | string | no | New session label. |
| thinkingLevel | string | no | Per-session thinking level. |

## gateway.overview

**HTTP** `gateway RPC sessions.list + sessions.usage + health/log RPC`
**Capability** gateway

Composite overview snapshot assembled client-side by the snapshot loaders from
the session, usage, and health/log RPC calls. No dedicated REST route.

## gateway.costHistory

**HTTP** `GET /api/plugins/cavi-control/cost/history?range=:range`
**Capability** gateway (`gap` — optional CAVI cost-history fallback)

Optional CAVI cost-history fallback used by snapshot loaders. The released plugin
route above remains primary; only `404`/`405` responses try the current CAVI
alias `/cavi-control/api/cost/history?range=:range`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| range | string | yes | Query param — time range for the cost history. |

## profiles

**HTTP** `GET /api/profiles`
**Capability** gateway (`gap` — legacy fallback)

Legacy profile list fallback.

## config

**HTTP** `GET /api/config`
**Capability** gateway (`gap` — legacy payload)

Legacy gateway config payload.

## configDefaults

**HTTP** `GET /api/config/defaults`
**Capability** gateway

Default config values.

## configSchema

**HTTP** `GET /api/config/schema`
**Capability** gateway

Config schema.

## agentConfigs

**HTTP** `GET /api/agent-configs`
**Capability** gateway

Native agent config/profile inventory.

## agentConfig (get)

**HTTP** `GET /api/agent-configs/:agentId/config`
**Capability** gateway

Fetch one agent profile config.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| agentId | string | yes | Path param — agent id. |

## agentConfig (patch)

**HTTP** `PATCH /api/agent-configs/:agentId/config`
**Capability** gateway

Patch one agent profile config.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| agentId | string | yes | Path param — agent id. |

## portal.config

**HTTP** `POST /api/plugins/portal/:portalSlug/config`
**Capability** gateway

Shared portal config patch route.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| portalSlug | string | yes | Path param — portal slug. |
