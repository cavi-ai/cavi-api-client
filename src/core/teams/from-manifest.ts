import type {
  ManifestIdentity,
  ManifestMember,
  ManifestTeam,
  TeamManifest,
} from "../../contracts/team-manifest.js";
import { createTeamDirectory, type TeamDirectory } from "./directory.js";
import type { Team, TeamIdentity, TeamMember } from "./types.js";

/**
 * Derive a complete `TeamIdentity` from a manifest identity (all fields
 * optional) and the entity id. Missing tokens fall back down the chain
 * name→id, displayName→name, slug→id, code→slug.
 */
function identityFrom(id: string, identity: ManifestIdentity | null | undefined): TeamIdentity {
  const name = identity?.name ?? id;
  const slug = identity?.slug ?? id;
  return {
    name,
    displayName: identity?.displayName ?? name,
    slug,
    code: identity?.code ?? slug,
    aliases: [...(identity?.aliases ?? [])],
  };
}

function memberFrom(member: ManifestMember): TeamMember {
  return {
    id: member.id,
    identity: identityFrom(member.id, member.identity),
    capabilities: [...(member.capabilities ?? [])],
  };
}

/** Project a manifest team onto the provider-agnostic core `Team`. */
export function manifestTeamToTeam(team: ManifestTeam): Team {
  return {
    id: team.id,
    identity: identityFrom(team.id, team.identity),
    members: (team.members ?? []).map(memberFrom),
    capabilities: [...(team.capabilities ?? [])],
    ...(team.metadata ? { metadata: team.metadata } : {}),
  };
}

/** Build a resolution-only `TeamDirectory` from a resolved team manifest. */
export function teamDirectoryFromManifest(manifest: TeamManifest): TeamDirectory {
  return createTeamDirectory(manifest.teams.map(manifestTeamToTeam));
}
