import { ApiClientErrorCode, getErrorCode } from "../core/errors.js";
import {
  normalizeTeamLookupValue,
  type Team,
  type TeamDirectory,
} from "../core/teams/index.js";

export interface TeamDirectoryConformanceCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface TeamDirectoryConformanceReport {
  ok: boolean;
  checks: TeamDirectoryConformanceCheck[];
}

/** Return human-readable errors for a team that violates the canonical shape. */
export function validateTeam(team: Team): string[] {
  const errors: string[] = [];
  if (typeof team.id !== "string" || team.id.length === 0) errors.push("id must be a non-empty string");
  if (!team.identity || typeof team.identity.slug !== "string") errors.push("identity.slug must be a string");
  if (typeof team.identity?.code !== "string") errors.push("identity.code must be a string");
  if (!Array.isArray(team.identity?.aliases)) errors.push("identity.aliases must be an array");
  if (!Array.isArray(team.members)) errors.push("members must be an array");
  if (!Array.isArray(team.capabilities)) errors.push("capabilities must be an array");
  return errors;
}

/** Exercise a TeamDirectory's resolution contract. Read-only (no mutation). */
export function inspectTeamDirectoryConformance(
  directory: TeamDirectory,
): TeamDirectoryConformanceReport {
  const checks: TeamDirectoryConformanceCheck[] = [];
  const record = (name: string, ok: boolean, detail?: string): void => {
    checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) });
  };

  const teams = directory.listTeams();
  const shapeErrors = teams.flatMap(validateTeam);
  record("listTeams returns canonical teams", shapeErrors.length === 0, shapeErrors.join("; ") || undefined);

  for (const team of teams) {
    const tokens = [team.id, team.identity.slug, team.identity.code, ...team.identity.aliases];
    const resolvedAll = tokens.every((token) => directory.resolveTeam(token)?.id === team.id);
    record(`resolveTeam by every identity token → "${team.id}"`, resolvedAll);

    const keys = directory.getLookupKeys(team);
    const canonical = keys.every((key) => key === normalizeTeamLookupValue(key));
    record(`getLookupKeys canonical vocabulary for "${team.id}"`, canonical);
  }

  let threwValidation = false;
  try {
    directory.requireTeam("__no_such_team__");
  } catch (error) {
    threwValidation = getErrorCode(error) === ApiClientErrorCode.ValidationFailed;
  }
  record("requireTeam throws ValidationFailed on miss", threwValidation);

  return { ok: checks.every((check) => check.ok), checks };
}
