---
documentedVersion: 0.11.0
---

# Memory operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The memory folder holds a single manifest-aware helper that maps a
harness-native agent/team name onto its canonical `MemoryScope`. The `MemoryScope`
shape and the `MemoryStore` contract (`remember`/`recall`) are **core**
(`core/memory`); this helper lives in the extension layer because the mapping
depends on the CAVI `TeamManifest`. It resolves names — it does not read or write
memory — so it extends the core contract rather than duplicating it.

Source: `extensions/cavi/memory/`.

## Operation

### resolveMemoryScope

**Signature** `resolveMemoryScope(manifest: TeamManifest, name: string): MemoryScope | undefined`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** core `MemoryScope` type / `MemoryStore` contract (`core/memory`) — which store/read memory but do not resolve names
**CAVI value-add** Resolves a name to `{ domain: teamId, member?: memberId }` by walking the `TeamManifest` — member matches win over team matches, and matching is case-insensitive across the canonical id plus the identity's slug/name/displayName/code/aliases. Returns `undefined` when nothing matches so callers can skip the name. This manifest-driven resolution is exactly the CAVI-specific glue the core memory contract leaves to the extension.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| manifest | `TeamManifest` | yes | Source of truth for teams and members. |
| name | `string` | yes | Harness-native agent or team name. |

#### Response

| Field | Type | Description |
| ----- | ---- | ----------- |
| domain | `string` | Resolved team id (present on any match). |
| member | `string` | Member id (present only on a member match). |

#### Example

```ts
const scope = resolveMemoryScope(manifest, "sigmund");
// { domain: "research", member: "sigmund" } | { domain: "research" } | undefined
if (scope) {
  await memoryStore.recall({ query: "release notes", scope });
}
```
