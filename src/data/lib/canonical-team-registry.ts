import type { OperatorRegistrySnapshot, OperatorRegistryTeam } from "../../domain/index.js";

export const CAVI_TEAM_PORTAL_IDS = [
  "angela",
  "deb",
  "front-door",
  "machine",
  "martina",
  "run-dmc",
  "scout",
  "wu-tang",
] as const;

export type CaviTeamPortalId = (typeof CAVI_TEAM_PORTAL_IDS)[number];

export function normalizeTeamLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

function uniqStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    if (!value) {
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }
    const key = normalizeTeamLookupValue(trimmed);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(trimmed);
  }
  return unique;
}

function coerceLegacyAliases(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((alias): alias is string => typeof alias === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function asCanonicalTeam(
  team: Partial<OperatorRegistryTeam> & { id: string; name?: string | null },
  fallback?: OperatorRegistryTeam | null,
): OperatorRegistryTeam {
  const name = team.name?.trim() || fallback?.name || team.id;
  const displayName = team.displayName?.trim() || fallback?.displayName || name;
  const teamSlug = team.teamSlug?.trim() || fallback?.teamSlug || team.id;
  const teamCode = team.teamCode?.trim() || fallback?.teamCode || team.id;
  const sectorSlug =
    team.sectorSlug?.trim() ||
    fallback?.sectorSlug ||
    team.department?.trim() ||
    team.kind?.trim() ||
    teamSlug;
  const sectorCode =
    team.sectorCode?.trim() || fallback?.sectorCode || teamCode;

  return {
    id: team.id,
    name,
    teamSlug,
    teamCode,
    sectorSlug,
    sectorCode,
    portalId: team.portalId ?? fallback?.portalId ?? null,
    displayName,
    legacyAliases: uniqStrings([
      ...coerceLegacyAliases(team.legacyAliases),
      ...coerceLegacyAliases(fallback?.legacyAliases),
    ]),
    department: team.department ?? fallback?.department ?? sectorSlug,
    kind: team.kind ?? fallback?.kind ?? null,
    parentTeamId: team.parentTeamId ?? fallback?.parentTeamId ?? null,
    lead: team.lead ?? fallback?.lead ?? null,
    leadKind: team.leadKind ?? fallback?.leadKind ?? null,
    routeViaLead: team.routeViaLead ?? fallback?.routeViaLead ?? false,
    mission: team.mission ?? fallback?.mission ?? null,
    members: team.members ?? fallback?.members ?? [],
    runtimeIds: team.runtimeIds ?? fallback?.runtimeIds ?? [],
    memberIdentityIds:
      team.memberIdentityIds ?? fallback?.memberIdentityIds ?? [],
    ownsCapabilities: team.ownsCapabilities ?? fallback?.ownsCapabilities ?? [],
    maxParallel: team.maxParallel ?? fallback?.maxParallel ?? null,
    dispatchTransport:
      team.dispatchTransport ?? fallback?.dispatchTransport ?? null,
    dispatchEndpointEnv:
      team.dispatchEndpointEnv ?? fallback?.dispatchEndpointEnv ?? null,
    dispatchPath: team.dispatchPath ?? fallback?.dispatchPath ?? null,
    dispatchAuthScheme:
      team.dispatchAuthScheme ?? fallback?.dispatchAuthScheme ?? null,
    dispatchAuthEnv: team.dispatchAuthEnv ?? fallback?.dispatchAuthEnv ?? null,
    dispatchDefaultAlias:
      team.dispatchDefaultAlias ?? fallback?.dispatchDefaultAlias ?? null,
    routingPolicy: team.routingPolicy ?? fallback?.routingPolicy ?? null,
    notes: team.notes ?? fallback?.notes ?? null,
    ancestorTeamIds: team.ancestorTeamIds ?? fallback?.ancestorTeamIds ?? [],
    descendantTeamIds:
      team.descendantTeamIds ?? fallback?.descendantTeamIds ?? [],
    teamManifest: team.teamManifest ?? fallback?.teamManifest ?? null,
    headOwnedAliases: team.headOwnedAliases ?? fallback?.headOwnedAliases ?? [],
    runtimeMembers: team.runtimeMembers ?? fallback?.runtimeMembers ?? [],
  };
}

const DEFAULT_CANONICAL_TEAMS = CAVI_TEAM_PORTAL_IDS.map((portalId) =>
  asCanonicalTeam(
    {
      id: portalId,
      name: portalId,
      portalId,
      teamSlug: portalId,
      teamCode: portalId,
      legacyAliases: [portalId],
    },
    null,
  ),
);

let configuredCanonicalTeams: OperatorRegistryTeam[] | null = null;

function getCanonicalTeams(): OperatorRegistryTeam[] {
  return configuredCanonicalTeams ?? DEFAULT_CANONICAL_TEAMS;
}

export function configureCanonicalOperatorRegistry(
  snapshot: OperatorRegistrySnapshot | null | undefined,
): void {
  configuredCanonicalTeams = snapshot?.teams?.length
    ? snapshot.teams.map((team) => asCanonicalTeam(team, null))
    : null;
}

export function resetCanonicalOperatorRegistry(): void {
  configuredCanonicalTeams = null;
}

export function getOperatorTeamLookupKeys(
  team: OperatorRegistryTeam,
): string[] {
  return uniqStrings([
    team.teamCode,
    team.teamSlug,
    team.id,
    team.portalId,
    ...coerceLegacyAliases(team.legacyAliases),
  ]).map(normalizeTeamLookupValue);
}

export function matchesOperatorTeamIdentifier(
  team: OperatorRegistryTeam,
  identifier: string | null | undefined,
): boolean {
  if (!identifier?.trim()) {
    return false;
  }
  return getOperatorTeamLookupKeys(team).includes(
    normalizeTeamLookupValue(identifier),
  );
}

export function resolveCompiledCanonicalTeam(
  identifier: string | null | undefined,
): OperatorRegistryTeam | null {
  if (!identifier?.trim()) {
    return null;
  }
  const lookup = normalizeTeamLookupValue(identifier);
  return (
    getCanonicalTeams().find((team) =>
      matchesOperatorTeamIdentifier(team, lookup),
    ) ?? null
  );
}

export function resolveTeamFromCollection(
  teams: OperatorRegistryTeam[],
  identifier: string | null | undefined,
): OperatorRegistryTeam | null {
  if (!identifier?.trim()) {
    return null;
  }
  return (
    teams.find((team) => matchesOperatorTeamIdentifier(team, identifier)) ??
    null
  );
}

export function backfillCanonicalTeam(
  team: Partial<OperatorRegistryTeam> & { id: string; name?: string | null },
): OperatorRegistryTeam {
  const runtimeLegacyAliases = coerceLegacyAliases(team.legacyAliases);
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
  return asCanonicalTeam(team, fallback);
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
  const team = getCanonicalTeams().find(
    (entry) => entry.portalId === portalId,
  );
  if (!team) {
    throw new Error(`Missing canonical portal team for ${portalId}`);
  }
  return team;
}

export function getPortalTeamCode(portalId: CaviTeamPortalId): string {
  return getPortalTeamIdentity(portalId).teamCode;
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
  return getPortalTeamIdentity(portalId).teamSlug;
}

export function getPortalTeamSectorSlug(portalId: CaviTeamPortalId): string {
  return getPortalTeamIdentity(portalId).sectorSlug;
}

export function listCompiledCanonicalTeams(): OperatorRegistryTeam[] {
  return getCanonicalTeams().slice();
}
