// Consumer-owned example for team/member/action registry edits.
// Shared HTTP, runtime, envelope, media, wiki, and transport behavior belongs
// to @cavi/api-client core/provider modules, not to manifest entries.
import {
  normalizeTeamManifest,
  type TeamActionContract,
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
      actions: [
        {
          id: "summarize",
          input: {
            mode: "json",
            params: [{ key: "documentId", type: "string", required: true }],
          },
          output: { mode: "json", contentType: "application/json" },
        },
      ],
      members: [
        {
          id: "default-agent",
          capabilities: ["kanban.read", "runs.read", "config.read"],
          actions: [
            {
              id: "summarize",
              defaults: { tone: "brief" },
            },
          ],
        },
      ],
    },
  ],
  bindings: [
    {
      id: "default-web",
      teamId: "default",
      memberId: "default-agent",
      source: "web",
      sessionKeyPattern: "agent:{memberId}:*",
      routeKey: "agent.config",
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
    actions: normalized.actions,
    bindings: normalized.bindings,
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
    actions: normalized.actions,
    bindings: normalized.bindings,
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

export function upsertTeamAction(
  manifest: TeamManifest,
  teamId: string,
  action: TeamActionContract,
): TeamManifest {
  const normalized = normalizeTeamManifest(manifest);
  return normalizeTeamManifest({
    version: normalized.version,
    actions: normalized.actions,
    bindings: normalized.bindings,
    teams: normalized.teams.map((team) =>
      team.id === teamId ? upsertActionOnTeam(team, action) : team,
    ),
  });
}

export function upsertAgentActionOverride(
  manifest: TeamManifest,
  teamId: string,
  agentId: string,
  action: TeamActionContract,
): TeamManifest {
  const normalized = normalizeTeamManifest(manifest);
  return normalizeTeamManifest({
    version: normalized.version,
    actions: normalized.actions,
    bindings: normalized.bindings,
    teams: normalized.teams.map((team) => {
      if (team.id !== teamId) {
        return team;
      }
      return {
        ...team,
        members: (team.members ?? []).map((member) =>
          member.id === agentId ? upsertActionOnMember(member, action) : member,
        ),
      };
    }),
  });
}

export function removeAgentActionOverride(
  manifest: TeamManifest,
  teamId: string,
  agentId: string,
  actionId: string,
): TeamManifest {
  const normalized = normalizeTeamManifest(manifest);
  return normalizeTeamManifest({
    version: normalized.version,
    actions: normalized.actions,
    bindings: normalized.bindings,
    teams: normalized.teams.map((team) => {
      if (team.id !== teamId) {
        return team;
      }
      return {
        ...team,
        members: (team.members ?? []).map((member) =>
          member.id === agentId
            ? {
                ...member,
                actions: (member.actions ?? []).filter(
                  (action) => action.id !== actionId,
                ),
              }
            : member,
        ),
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

function upsertActionOnTeam(
  team: TeamManifestTeam,
  action: TeamActionContract,
): TeamManifestTeam {
  return {
    ...team,
    actions: upsertAction(team.actions, action),
  };
}

function upsertActionOnMember(
  member: TeamManifestMember,
  action: TeamActionContract,
): TeamManifestMember {
  return {
    ...member,
    actions: upsertAction(member.actions, action),
  };
}

function upsertAction(
  actions: readonly TeamActionContract[] | null | undefined,
  action: TeamActionContract,
): TeamActionContract[] {
  const current = actions ?? [];
  return current.some((entry) => entry.id === action.id)
    ? current.map((entry) => (entry.id === action.id ? action : entry))
    : [...current, action];
}
