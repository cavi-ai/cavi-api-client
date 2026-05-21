import {
  normalizeTeamManifest,
  type TeamManifest,
  type TeamManifestMember,
  type TeamManifestTeam,
  type TeamRegistryConfig,
} from "@cavi/api-client";

export const TEAM_MANIFEST = {
  version: 1,
  teams: [
    {
      id: "default",
      identity: {
        displayName: "Default Team",
        slug: "default",
        code: "DEFAULT",
      },
      workspace: {
        rootPath: "/teams/default/workspace",
        paths: [
          "config",
          "kanban",
          "runs",
          { key: "media.images", path: "media/images" },
          { key: "research.complete", path: "research/complete" },
        ],
      },
      members: [
        {
          id: "default-agent",
          capabilities: ["kanban.read", "runs.read", "config.read"],
        },
      ],
    },
  ],
} satisfies TeamManifest;

export function addAgentToManifest(
  manifest: TeamManifest,
  teamId: string,
  agent: TeamManifestMember,
): TeamManifest {
  const normalized = normalizeTeamManifest(manifest);
  const teams = normalized.teams.map((team) => {
    if (team.id !== teamId) {
      return team;
    }
    return upsertMember(team, agent);
  });

  if (!teams.some((team) => team.id === teamId)) {
    teams.push({
      id: teamId,
      identity: {
        displayName: teamId,
        slug: teamId,
        code: teamId,
      },
      members: [agent],
    });
  }

  return normalizeTeamManifest({
    version: normalized.version,
    teams,
  });
}

export function removeAgentFromManifest(
  manifest: TeamManifest,
  teamId: string,
  agentId: string,
): TeamManifest {
  const normalized = normalizeTeamManifest(manifest);
  return normalizeTeamManifest({
    version: normalized.version,
    teams: normalized.teams.map((team) => {
      if (team.id !== teamId) {
        return team;
      }
      return {
        ...team,
        members: team.members?.filter((member) => member.id !== agentId) ?? [],
      };
    }),
  });
}

export function createRegistryConfig(
  manifest: TeamManifest = TEAM_MANIFEST,
): TeamRegistryConfig {
  return {
    provider: "gateway",
    manifest: normalizeTeamManifest(manifest),
  };
}

function upsertMember(
  team: TeamManifestTeam,
  agent: TeamManifestMember,
): TeamManifestTeam {
  const members = team.members ?? [];
  const nextMembers = members.some((member) => member.id === agent.id)
    ? members.map((member) => (member.id === agent.id ? agent : member))
    : [...members, agent];
  return {
    ...team,
    members: nextMembers,
  };
}
