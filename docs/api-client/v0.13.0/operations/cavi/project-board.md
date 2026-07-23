---
documentedVersion: 0.13.0
---

# Project Board operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

CAVI's Project Board is a REST-and-RPC hybrid over the cavi-control kanban plane.
Every helper here is a **divergence point**: it prefers native OpenClaw Workboard
RPC (`workboard.cards.*`) when a `workboardRpc` is supplied, falls back to the
cavi-control kanban REST surface (and a legacy compat aggregate on `404`), and
degrades to a `source: "mock"` `MutationResult` on backend failure. That
fallback ladder — plus the DTO normalization between the Workboard card shape and
the `ProjectBoard*` domain types — is the value-add. None of these are pure
pass-throughs.

Route literals: `cavi.projectBoard.{root,profile,sprint,backlog,call}` in
`extensions/cavi/contracts/surfaces.ts`;
the backlog-item path helper is `projectBoardBacklogItemPath(itemId)`. Workboard
RPC methods are owned by `providers/openclaw/workboard.ts`.

Source:
`extensions/cavi/project-board/`.

## Live loaders

### loadProjectBoardWorkspaceLive

**Signature** `helpers.loadProjectBoardWorkspaceLive(): Promise<ProjectBoardWorkspaceSnapshot>`
**HTTP** `gateway RPC workboard.cards.list` → fallback `GET` `resolveCaviPath("cavi.projectBoard.profile")` + `resolveCaviPath("cavi.projectBoard.sprint")` + `resolveCaviPath("cavi.projectBoard.backlog")` → compat `GET` `resolveCaviPath("cavi.projectBoard.root")`
**Capability** gateway
**Upstream equivalent** OpenClaw Workboard RPC `workboard.cards.list`
**CAVI value-add** Adapts native Workboard cards into the `ProjectBoardWorkspaceSnapshot` DTO; when no `workboardRpc` is wired, fans out to the three kanban REST sections and, on `404`, retries the legacy single-payload compat aggregate.

#### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| profile | `ProjectBoardProfile` | Board profile + notification emails. |
| sprint | `ProjectBoardSprint` | Current sprint columns/cards. |
| backlog | `ProjectBoardBacklogItem[]` | Normalized, sorted backlog rows. |

#### Example

```ts
const helpers = createProjectBoardLiveHelpers(requestJson, { workboardRpc });
const workspace = await helpers.loadProjectBoardWorkspaceLive();
console.log(workspace.backlog.length);
```

### loadProjectBoardProfileForEmailMutation

**Signature** `helpers.loadProjectBoardProfileForEmailMutation(): Promise<ProjectBoardProfile>`
**HTTP** `GET` `resolveCaviPath("cavi.projectBoard.profile")` → compat `GET` `resolveCaviPath("cavi.projectBoard.root")`
**Capability** gateway
**Upstream equivalent** cavi-control kanban REST profile section (no native RPC)
**CAVI value-add** Normalizes the raw profile payload to `ProjectBoardProfile` and applies the same `404`-to-compat fallback; the read backing the email mutations.

### persistProjectBoardEmails

**Signature** `helpers.persistProjectBoardEmails(emails: string[]): Promise<ProjectBoardProfile>`
**HTTP** `PUT` `resolveCaviPath("cavi.projectBoard.profile")` → compat `PUT` `resolveCaviPath("cavi.projectBoard.root")`
**Capability** gateway
**Upstream equivalent** cavi-control kanban REST profile section (no native RPC)
**CAVI value-add** De-duplicates and lowercases the email list before persisting, then re-normalizes the response; carries the compat fallback.

## Mutations

Each mutation is wrapped in `withMutationResult`, so a backend failure returns a
`MutationResult` with `source: "mock"` and a structured `contractGap` instead of
throwing (401/403 still throw).

### createProjectBoardEmail

**Signature** `mutations.createProjectBoardEmail(draft: ProjectBoardEmailDraft): Promise<MutationResult<{ id: string; email: string }>>`
**HTTP** `PUT` `resolveCaviPath("cavi.projectBoard.profile")`
**Capability** gateway
**Upstream equivalent** cavi-control kanban profile PUT (email list is CAVI-only; no Workboard RPC)
**CAVI value-add** Validates and normalizes the address, reads-modifies-writes the profile email set idempotently, and degrades to a deterministic mock id on failure.

### updateProjectBoardEmail

**Signature** `mutations.updateProjectBoardEmail(emailId: string, draft: ProjectBoardEmailDraft): Promise<MutationResult<{ id: string; email: string }>>`
**HTTP** `PUT` `resolveCaviPath("cavi.projectBoard.profile")`
**Capability** gateway
**Upstream equivalent** cavi-control kanban profile PUT (no native RPC)
**CAVI value-add** Locates the existing recipient, swaps it in place across the email list, re-persists, and degrades to mock.

### removeProjectBoardEmail

**Signature** `mutations.removeProjectBoardEmail(emailId: string): Promise<MutationResult<{ id: string }>>`
**HTTP** `PUT` `resolveCaviPath("cavi.projectBoard.profile")`
**Capability** gateway
**Upstream equivalent** cavi-control kanban profile PUT (no native RPC)
**CAVI value-add** Filters the recipient out of the list, guards against no-op deletes, and degrades to mock.

### createProjectBoardBacklogItem

**Signature** `mutations.createProjectBoardBacklogItem(draft: ProjectBoardBacklogDraft): Promise<MutationResult<ProjectBoardBacklogItem>>`
**HTTP** `gateway RPC workboard.cards.create` → fallback `POST` `resolveCaviPath("cavi.projectBoard.backlog")`
**Capability** gateway
**Upstream equivalent** OpenClaw Workboard RPC `workboard.cards.create`
**CAVI value-add** Maps the backlog draft into a Workboard create payload (or the REST body), normalizes the returned card to `ProjectBoardBacklogItem`, and degrades to a mock item.

### updateProjectBoardBacklogItem

**Signature** `mutations.updateProjectBoardBacklogItem(itemId: string, draft: ProjectBoardBacklogDraft): Promise<MutationResult<ProjectBoardBacklogItem>>`
**HTTP** `gateway RPC workboard.cards.update` + `workboard.cards.move` → fallback `PATCH` `projectBoardBacklogItemPath(itemId)`
**Capability** gateway
**Upstream equivalent** OpenClaw Workboard RPC `workboard.cards.update` / `workboard.cards.move`
**CAVI value-add** Splits a single board edit into the Workboard patch+move pair (or one REST `PATCH`), maps status/priority enums both directions, and degrades to a mock item.

### callProjectBoard

**Signature** `mutations.callProjectBoard(request: ProjectBoardCallRequest): Promise<MutationResult<ProjectBoardCallResult>>`
**HTTP** `gateway RPC workboard.cards.{dispatch,promote,reassign,reclaim,unblock}` → fallback `POST` `resolveCaviPath("cavi.projectBoard.call")` (with legacy `{ instruction }` compat on `404`/`422`)
**Capability** gateway
**Upstream equivalent** OpenClaw Workboard RPC card-action methods (`workboard.cards.dispatch`, …)
**CAVI value-add** Routes known board actions to the matching Workboard RPC, otherwise POSTs the cavi-control call endpoint with a generated trace id, parses the ack, and on total failure returns a queued local-fallback ack describing storage limitations.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| action | `string` | yes | Board action (e.g. `dispatch`, `promote`). |
| requestedBy | `string` | no | Operator id; defaults to `cavi-control-ui`. |
| metadata | `Record<string, unknown>` | no | Action metadata forwarded to the RPC/endpoint. |

#### Example

```ts
const mutations = createProjectBoardMutations(requestJson, helpers);
const ack = await mutations.callProjectBoard({
  action: "dispatch",
  requestedBy: "operator@cavi",
  metadata: { cardId: "card_123" },
});
console.log(ack.data.status); // "queued" | ...
```
