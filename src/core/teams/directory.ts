import { ApiClientError, ApiClientErrorCode } from "../errors.js";
import type { Team, TeamIdentity, TeamMember } from "./types.js";

/** Canonical identifier normalization. Verbatim copy of the CAVI registry rule. */
export function normalizeTeamLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function uniqNormalized(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = normalizeTeamLookupValue(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function identityTokens(id: string, identity: TeamIdentity): Array<string | null | undefined> {
  return [id, identity.slug, identity.code, ...identity.aliases];
}

export function getTeamLookupKeys(team: Team): string[] {
  return uniqNormalized(identityTokens(team.id, team.identity));
}

export function matchesTeamIdentifier(
  team: Team,
  identifier: string | null | undefined,
): boolean {
  if (!identifier?.trim()) return false;
  return getTeamLookupKeys(team).includes(normalizeTeamLookupValue(identifier));
}

export function resolveTeamFromCollection(
  teams: readonly Team[],
  identifier: string | null | undefined,
): Team | null {
  if (!identifier?.trim()) return null;
  return teams.find((team) => matchesTeamIdentifier(team, identifier)) ?? null;
}

/** Provider-agnostic team directory. Pure resolution over a fixed team set. */
export interface TeamDirectory {
  listTeams(): Team[];
  listMembers(teamId: string): TeamMember[];
  resolveTeam(identifier: string | null | undefined): Team | null;
  requireTeam(identifier: string | null | undefined): Team;
  resolveMember(teamId: string, memberIdentifier: string | null | undefined): TeamMember | null;
  getLookupKeys(team: Team): string[];
}

export function createTeamDirectory(teams: readonly Team[]): TeamDirectory {
  const list = teams.slice();

  const owners = new Map<string, string>();
  for (const team of list) {
    for (const key of getTeamLookupKeys(team)) {
      const owner = owners.get(key);
      if (owner && owner !== team.id) {
        throw new ApiClientError(
          `team directory: ambiguous lookup key "${key}" for teams "${owner}" and "${team.id}"`,
          { code: ApiClientErrorCode.Conflict },
        );
      }
      owners.set(key, team.id);
    }
  }

  function resolveTeam(identifier: string | null | undefined): Team | null {
    return resolveTeamFromCollection(list, identifier);
  }

  return {
    listTeams() {
      return list.slice();
    },
    listMembers(teamId: string) {
      const team = list.find((entry) => entry.id === teamId);
      return team ? team.members.slice() : [];
    },
    resolveTeam,
    requireTeam(identifier: string | null | undefined): Team {
      const team = resolveTeam(identifier);
      if (!team) {
        throw new ApiClientError(
          `team directory: unknown team "${identifier ?? ""}"`,
          { code: ApiClientErrorCode.ValidationFailed },
        );
      }
      return team;
    },
    resolveMember(teamId: string, memberIdentifier: string | null | undefined) {
      const team = list.find((entry) => entry.id === teamId);
      if (!team || !memberIdentifier?.trim()) return null;
      const needle = normalizeTeamLookupValue(memberIdentifier);
      return (
        team.members.find((member) =>
          uniqNormalized(identityTokens(member.id, member.identity)).includes(needle),
        ) ?? null
      );
    },
    getLookupKeys: getTeamLookupKeys,
  };
}
