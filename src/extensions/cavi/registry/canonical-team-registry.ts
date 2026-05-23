import type { OperatorRegistrySnapshot, OperatorRegistryTeam } from "../domain/index.js";
import {
  configureTeamRegistryConfig,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
} from "./team-registry-config.js";
import {
  getTeamLookupKeys,
  matchesTeamIdentifier,
  normalizeTeamLookupValue,
  normalizeTeamRegistryTeam,
  resolveTeamFromCollection as resolveTeamFromConfiguredCollection,
  type TeamRegistryConfig,
  type TeamRegistryTeamConfig,
} from "./team-registry.js";
import {
  DEFAULT_AGENT_SESSION_SUFFIX,
  normalizeSessionAgentId,
  normalizeSessionKeyPart,
} from "./session-keys.js";

export { normalizeTeamLookupValue };
export {
  buildAgentMainSessionKey,
  normalizeSessionAgentId,
  normalizeSessionKey,
  parseAgentSessionKey,
  sessionKeysEqual,
  type ParsedAgentSessionKey,
} from "./session-keys.js";

export type CaviTeamPortalId = string;

export function listCaviTeamPortalIds(): string[] {
  return getConfiguredTeamRegistry().listPortalIds();
}

export function configureCanonicalOperatorRegistry(
  snapshot: OperatorRegistrySnapshot | null | undefined,
): void {
  configureTeamRegistryConfig({
    provider: "gateway",
    snapshot: snapshot ?? null,
  });
}

export function configureCanonicalTeamRegistry(
  config: TeamRegistryConfig | null | undefined,
): void {
  configureTeamRegistryConfig(config);
}

export function resetCanonicalOperatorRegistry(): void {
  resetTeamRegistryConfig();
}

export function getOperatorTeamLookupKeys(
  team: OperatorRegistryTeam,
): string[] {
  return getTeamLookupKeys(team);
}

export function matchesOperatorTeamIdentifier(
  team: OperatorRegistryTeam,
  identifier: string | null | undefined,
): boolean {
  if (!identifier?.trim()) {
    return false;
  }
  return matchesTeamIdentifier(team, identifier);
}

export function resolveCompiledCanonicalTeam(
  identifier: string | null | undefined,
): OperatorRegistryTeam | null {
  return getConfiguredTeamRegistry().resolveTeam(identifier);
}

export function resolveTeamFromCollection(
  teams: OperatorRegistryTeam[],
  identifier: string | null | undefined,
): OperatorRegistryTeam | null {
  return resolveTeamFromConfiguredCollection(teams, identifier);
}

export function backfillCanonicalTeam(
  team: TeamRegistryTeamConfig,
): OperatorRegistryTeam {
  const runtimeLegacyAliases = Array.isArray(team.legacyAliases)
    ? team.legacyAliases
    : [];
  const aliasFallback =
    runtimeLegacyAliases.find(
      (alias) => resolveCompiledCanonicalTeam(alias) !== null,
    ) ?? null;
  const fallback =
    resolveCompiledCanonicalTeam(team.teamCode) ??
    resolveCompiledCanonicalTeam(team.teamSlug) ??
    resolveCompiledCanonicalTeam(team.portalId) ??
    resolveCompiledCanonicalTeam(team.id) ??
    resolveCompiledCanonicalTeam(aliasFallback) ??
    null;
  return normalizeTeamRegistryTeam(team, fallback);
}

export function matchesTaskTargetToTeam(
  target: { team_id?: string | null; team_slug?: string | null },
  team: OperatorRegistryTeam,
): boolean {
  const needles = new Set(getOperatorTeamLookupKeys(team));
  const teamId = target.team_id
    ? normalizeTeamLookupValue(target.team_id)
    : null;
  const teamSlug = target.team_slug
    ? normalizeTeamLookupValue(target.team_slug)
    : null;
  return Boolean(
    (teamId && needles.has(teamId)) || (teamSlug && needles.has(teamSlug)),
  );
}

export function getPortalTeamIdentity(
  portalId: CaviTeamPortalId,
): OperatorRegistryTeam {
  return getConfiguredTeamRegistry().getPortalTeam(portalId);
}

export function getPortalTeamCode(portalId: CaviTeamPortalId): string {
  return getConfiguredTeamRegistry().getPortalTeamCode(portalId);
}

export function resolveTeamSessionAgentId(params: {
  teamId?: string | null;
  operatorTeamId?: string | null;
  operatorTeamSlug?: string | null;
  agentAlias?: string | null;
}): string | null {
  const explicitAlias = normalizeSessionAgentId(params.agentAlias);
  if (explicitAlias) {
    return explicitAlias;
  }

  const team =
    resolveCompiledCanonicalTeam(params.operatorTeamSlug) ??
    resolveCompiledCanonicalTeam(params.operatorTeamId) ??
    resolveCompiledCanonicalTeam(params.teamId);
  if (!team) {
    return normalizeSessionAgentId(params.operatorTeamSlug ?? params.teamId);
  }

  return (
    normalizeSessionAgentId(team.lead) ??
    normalizeSessionAgentId(team.dispatchDefaultAlias) ??
    normalizeSessionAgentId(team.teamSlug)
  );
}

export function resolveTeamSessionKey(params: {
  teamId?: string | null;
  operatorTeamId?: string | null;
  operatorTeamSlug?: string | null;
  agentAlias?: string | null;
  suffix?: string | null;
}): string | null {
  const agentId = resolveTeamSessionAgentId(params);
  if (!agentId) {
    return null;
  }
  const suffix = normalizeSessionKeyPart(params.suffix) || DEFAULT_AGENT_SESSION_SUFFIX;
  return `agent:${agentId}:${suffix}`;
}

export function resolvePortalPrimarySessionKey(params: {
  portalId: CaviTeamPortalId;
  suffix?: string | null;
}): string | null {
  return resolveTeamSessionKey({
    teamId: params.portalId,
    suffix: params.suffix,
  });
}

export function getPortalTeamSlug(portalId: CaviTeamPortalId): string {
  return getConfiguredTeamRegistry().getPortalTeamSlug(portalId);
}

export function getPortalTeamSectorSlug(portalId: CaviTeamPortalId): string {
  return getConfiguredTeamRegistry().getPortalTeamSectorSlug(portalId);
}

export function listCompiledCanonicalTeams(): OperatorRegistryTeam[] {
  return getConfiguredTeamRegistry().listTeams();
}
