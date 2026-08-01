---
documentedVersion: 0.15.0
---

# Registry operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The registry folder is CAVI's **team registry** — it turns a runtime-supplied
`TeamManifest` (or explicit team config) into lookup, resolution, and
portal/library/session helpers. Everything here is client-side (`n/a`
capability): there is no network call and no gateway RPC. The upstream primitive
is the core `TeamManifest` / `MemoryScope` contracts; the registry extends them
with identity resolution, alias matching, portal↔team mapping, and session-key
derivation. The package ships `TEAM_REGISTRY_CONFIG.teams` **empty** — data is
runtime-supplied (enforced by the hardening tests) — so none of this is a baked
duplicate of upstream data.

Source: `extensions/cavi/registry/`.

## Construction

### createTeamRegistry

**Signature** `createTeamRegistry(config?: TeamRegistryConfig, options?: CreateTeamRegistryOptions): TeamRegistry`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** core `TeamManifest` (`contracts/team-manifest.ts`)
**CAVI value-add** Normalizes manifest/snapshot/team config into `OperatorRegistryTeam[]`, asserts unique lookup keys, and returns a registry with team resolution (`resolveTeam`/`requireTeam`), portal→team mapping (`getPortalTeam*`), and library-ref resolution. This is aggregation/normalization over the raw manifest, not a pass-through.

#### Example

```ts
const registry = createTeamRegistry({ manifest });
const team = registry.resolveTeam("sigmund");
console.log(team?.teamSlug);
```

### createTeamRegistryFromSnapshot

**Signature** `createTeamRegistryFromSnapshot(snapshot: OperatorRegistrySnapshot | null, options?: CreateTeamRegistryOptions): TeamRegistry`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** core `OperatorRegistrySnapshot`
**CAVI value-add** Builds a registry directly from a fetched operator registry snapshot; convenience over `createTeamRegistry`.

## Team lookup helpers

**Signature** `getTeamLookupKeys(team)`, `matchesTeamIdentifier(team, id)`, `normalizeTeamLookupValue(value)`, `resolveTeamFromCollection(teams, id)`, `normalizeTeamRegistryTeam(team, fallback?)`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none (registry-internal identity matching)
**CAVI value-add** Case/underscore/space-insensitive identity matching across id, slug, code, portal id, and legacy aliases — the resolution logic the registry is built on.

## Config / canonical registry

**Signature** `configureTeamRegistryConfig(config)`, `resetTeamRegistryConfig()`, `getConfiguredTeamRegistry(options?)`, `configureCanonicalTeamRegistry(...)`, `resolveCompiledCanonicalTeam(...)`, `listCompiledCanonicalTeams()`, `listCaviTeamPortalIds()`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none (runtime-supplied registry state)
**CAVI value-add** Holds and compiles the runtime-supplied `TEAM_REGISTRY_CONFIG` (ships empty) into the canonical operator registry used across CAVI surfaces.

## Portal library refs

**Signature** `getFleetLibraryRef()`, `resolvePortalLibraryRef(portalId)`, `resolveLibraryRefByTeamIdentity(value)`, `listPortalLibraryRefs()`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none
**CAVI value-add** Thin, throwing accessors over `getConfiguredTeamRegistry()` that resolve a portal or team identity to its `PortalLibraryRef` — the fleet-vs-team library routing CAVI portals depend on.

## Session keys

**Signature** `buildAgentMainSessionKey(params)`, `parseAgentSessionKey(value)`, `normalizeSessionKey(value)`, `sessionKeysEqual(a, b)`, `resolveTeamSessionKey(params)`, `resolvePortalPrimarySessionKey(params)`, `resolveTeamSessionAgentId(params)`
**HTTP** `n/a (client-side)`
**Capability** n/a
**Upstream equivalent** none
**CAVI value-add** Derives and compares canonical agent/team session keys from portal + team identity — CAVI session-addressing logic with no upstream counterpart.
