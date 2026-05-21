import type { OperatorRegistrySnapshot, OperatorRegistryTeam } from "../../domain/index.js";
import {
  configureTeamRegistryConfig,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
} from "../../registry/team-registry-config.js";
import {
  getTeamLookupKeys,
  matchesTeamIdentifier,
  normalizeTeamLookupValue,
  normalizeTeamRegistryTeam,
  resolveTeamFromCollection as resolveTeamFromConfiguredCollection,
  type TeamRegistryConfig,
  type TeamRegistryTeamConfig,
} from "../../registry/team-registry.js";

export { normalizeTeamLookupValue };

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

const DEFAULT_AGENT_ID = "main";
const DEFAULT_MAIN_KEY = "main";
const VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

function normalizeLowercaseStringOrEmpty(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeSessionAgentId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeLowercaseStringOrEmpty(trimmed);
  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return normalized;
  }
  return (
    normalized
      .replace(INVALID_AGENT_ID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_ID
  );
}

export function parseAgentSessionKey(
  sessionKey: string | null | undefined,
): ParsedAgentSessionKey | null {
  const raw = normalizeLowercaseStringOrEmpty(sessionKey);
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "agent") {
    return null;
  }
  const agentId = normalizeSessionAgentId(parts[1]);
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function buildAgentMainSessionKey(params: {
  agentId: string | null | undefined;
  mainKey?: string | null | undefined;
}): string {
  const agentId = normalizeSessionAgentId(params.agentId) ?? DEFAULT_AGENT_ID;
  const mainKey = normalizeLowercaseStringOrEmpty(params.mainKey) || DEFAULT_MAIN_KEY;
  return `agent:${agentId}:${mainKey}`;
}

export function normalizeSessionKey(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const lowered = normalizeLowercaseStringOrEmpty(raw);
  if (lowered === DEFAULT_MAIN_KEY) {
    return buildAgentMainSessionKey({ agentId: DEFAULT_AGENT_ID });
  }
  const parsed = parseAgentSessionKey(raw);
  if (parsed) {
    return `agent:${parsed.agentId}:${parsed.rest}`;
  }
  if (lowered.startsWith("agent:")) {
    return lowered;
  }
  return lowered;
}

export function sessionKeysEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeSessionKey(left);
  const normalizedRight = normalizeSessionKey(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
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
  const suffix = normalizeLowercaseStringOrEmpty(params.suffix) || DEFAULT_MAIN_KEY;
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
