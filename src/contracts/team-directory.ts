import {
  createTeamDirectory,
  type Team,
  type TeamDirectory,
  type TeamMember,
} from "../core/teams/index.js";
import {
  normalizeTeamManifest,
  type ManifestMember,
  type ManifestTeam,
  type TeamManifest,
} from "./team-manifest.js";

function memberFromManifest(member: ManifestMember): TeamMember {
  const identity = member.identity ?? {};
  const name = identity.name ?? identity.displayName ?? member.id;
  const slug = identity.slug ?? member.id;
  const code = identity.code ?? slug;
  return {
    id: member.id,
    identity: {
      name,
      displayName: identity.displayName ?? name,
      slug,
      code,
      aliases: [...(identity.aliases ?? [])],
    },
    capabilities: [...(member.capabilities ?? [])],
  };
}

function teamFromManifest(team: ManifestTeam): Team {
  const identity = team.identity ?? {};
  const name = identity.name ?? identity.displayName ?? team.id;
  const slug = identity.slug ?? team.id;
  const code = identity.code ?? slug;
  return {
    id: team.id,
    identity: {
      name,
      displayName: identity.displayName ?? name,
      slug,
      code,
      aliases: [...(identity.aliases ?? [])],
    },
    members: (team.members ?? []).map(memberFromManifest),
    capabilities: [...(team.capabilities ?? [])],
    ...(team.metadata ? { metadata: team.metadata } : {}),
  };
}

/** Project a `TeamManifest` into a canonical, provider-agnostic `TeamDirectory`. */
export function createTeamDirectoryFromManifest(manifest: TeamManifest): TeamDirectory {
  const normalized = normalizeTeamManifest(manifest);
  return createTeamDirectory(normalized.teams.map(teamFromManifest));
}
