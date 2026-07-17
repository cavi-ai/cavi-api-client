---
documentedVersion: 0.12.0
---

# Gateway teams, kanban & vault operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Vault and kanban compatibility routes are owned by `SURFACE_CONTRACTS`
(`src/contracts/surfaces.ts`) and resolved with `resolvePath(key)`. Team routes
are assembled by the team-manifest resolvers (`resolveTeamRoutePath`,
`resolveTeamActionApiPath` in `src/contracts/team-manifest.ts`) from the team
identity — there is no static `/api/teams/...` literal in `paths.ts`, so those
`**HTTP**` lines name the resolver and give the concrete path in the description.
Operator-dispatch routes are owned by `OPERATOR_DISPATCH_ENDPOINTS`
(`src/extensions/cavi/contracts/paths.ts`).

## vault.tree

**HTTP** `GET` `resolvePath("vault.tree")`
**Capability** gateway (`gap` — no native gateway route identified yet)

Obsidian vault tree at path `/api/obsidian/tree`.

## vault.read

**HTTP** `GET` `resolvePath("vault.read")`
**Capability** gateway (`gap` — no native gateway route identified yet)

Obsidian file read at path `/api/obsidian/read?path=:path`; the query string is
appended by the caller.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| path | string | yes | Query param — file path within the vault. |

## kanban.tasks

**HTTP** `POST` `resolvePath("kanban.tasks")`
**Capability** gateway (`hard` — required for core compat)

Legacy/unknown kanban compatibility route at path `/api/plugins/kanban/tasks`.
No native OpenClaw Workboard REST owner is mirrored here.

## kanban.board

**HTTP** `GET` `resolvePath("kanban.board")`
**Capability** gateway (`hard` — required for core compat)

Legacy/unknown board compatibility route at path `/api/plugins/kanban/board`.
Prefer native Workboard RPC when available (see [rpc-methods](rpc-methods.md)).

## team.kanban

**HTTP** `GET` `resolveTeamRoutePath("kanban", { teamId })`
**Capability** gateway (`hard` — required for core compat)

Team-shaped compatibility route at path `/api/teams/:teamId/kanban`. CAVI
adapters map `teamId` to Workboard `boardId` only in compatibility code.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |

## team.runs

**HTTP** `GET` `resolveTeamRoutePath("runs", { teamId })`
**Capability** gateway (`hard` — required for core compat)

Team runs route at path `/api/teams/:teamId/runs`, derived from the team
manifest identity.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |

## team.config

**HTTP** `GET` `resolveTeamRoutePath("config", { teamId })`
**Capability** gateway (`hard` — required for core compat)

Team config route at path `/api/teams/:teamId/config`, derived from the team
manifest identity.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |

## team.workspace

**HTTP** `GET` `resolveTeamRoutePath("workspace", { teamId, workspacePath })`
**Capability** gateway (`hard` — required for core compat)

Whitelisted team workspace route at path
`/api/teams/:teamId/workspace/:workspacePath`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |
| workspacePath | string | yes | Whitelisted relative workspace path. |

## team.action

**HTTP** `POST` `resolveTeamActionApiPath(manifest, teamId, actionId)`
**Capability** gateway (`hard` — required for core compat)

Team action route at path `/api/teams/:teamId/actions/:actionId`, derived from a
manifest action contract.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |
| actionId | string | yes | Manifest action id. |

## team.agent.config

**HTTP** `GET` `resolveTeamRoutePath("agent.config", { teamId, agentId })`
**Capability** gateway (`hard` — required for core compat)

Team member config route at path `/api/teams/:teamId/agents/:agentId/config`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |
| agentId | string | yes | Team member agent id. |

## team.agent.action

**HTTP** `POST` `resolveTeamActionApiPath(manifest, teamId, actionId, { agentId })`
**Capability** gateway (`hard` — required for core compat)

Team member action route at path
`/api/teams/:teamId/agents/:agentId/actions/:actionId`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |
| agentId | string | yes | Team member agent id. |
| actionId | string | yes | Manifest action id. |

## team.agent.workspace

**HTTP** `GET` `resolveTeamRoutePath("agent.workspace", { teamId, agentId, workspacePath })`
**Capability** gateway (`hard` — required for core compat)

Whitelisted team-member workspace route at path
`/api/teams/:teamId/agents/:agentId/workspace/:workspacePath`.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| teamId | string | yes | Team identity from the team manifest. |
| agentId | string | yes | Team member agent id. |
| workspacePath | string | yes | Whitelisted relative workspace path. |

## operatorDispatch.message

**HTTP** `POST /api/message`
**Capability** gateway

Operator dispatch message endpoint.

## operatorDispatch.operatorEvents

**HTTP** `GET /operator/events`
**Capability** gateway

Operator event stream endpoint.

## operatorDispatch.taskReceiptsTemplate

**HTTP** `GET /cavi-control/api/tasks/:taskId/receipts`
**Capability** gateway

Operator task receipt template.

### Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| taskId | string | yes | Path param — operator task id. |
