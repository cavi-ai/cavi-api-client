// Map a runtime-native agent/team name onto its canonical memory scope. The team manifest is
// the single source of truth — members are nested under their team, so the structure itself
// encodes the primary domain (a member listed under one team resolves to that team). Lives in
// the extension layer because it depends on TeamManifest; the MemoryScope shape it returns is
// core.

import type { MemoryScope } from "../../../core/memory/index.js";
import type {
  TeamManifest,
  ManifestIdentity,
  ManifestMember,
  ManifestTeam,
} from "../../../contracts/team-manifest.js";

function identityAliases(identity: ManifestIdentity | null | undefined): string[] {
  if (!identity) {
    return [];
  }
  const out: string[] = [];
  for (const value of [identity.slug, identity.name, identity.displayName, identity.code]) {
    if (typeof value === "string" && value.trim()) {
      out.push(value);
    }
  }
  for (const alias of identity.aliases ?? []) {
    if (typeof alias === "string" && alias.trim()) {
      out.push(alias);
    }
  }
  return out;
}

function matchesName(
  name: string,
  id: string,
  identity: ManifestIdentity | null | undefined,
): boolean {
  const needle = name.trim().toLowerCase();
  if (!needle) {
    return false;
  }
  if (id.trim().toLowerCase() === needle) {
    return true;
  }
  return identityAliases(identity).some((value) => value.trim().toLowerCase() === needle);
}

/**
 * Resolve a harness-native agent/team name to its canonical memory scope:
 *   - matches a member → `{ domain: team.id, member: member.id }`
 *   - matches a team   → `{ domain: team.id }`
 *   - no match         → `undefined` (caller skips that name)
 *
 * Member matches win over team matches (more specific). Matching is case-insensitive across
 * the canonical id plus the identity's slug/name/displayName/code/aliases.
 */
export function resolveMemoryScope(
  manifest: TeamManifest,
  name: string,
): MemoryScope | undefined {
  const teams: readonly ManifestTeam[] = manifest.teams ?? [];

  for (const team of teams) {
    const members: readonly ManifestMember[] = team.members ?? [];
    for (const member of members) {
      if (matchesName(name, member.id, member.identity)) {
        return { domain: team.id, member: member.id };
      }
    }
  }
  for (const team of teams) {
    if (matchesName(name, team.id, team.identity)) {
      return { domain: team.id };
    }
  }
  return undefined;
}
