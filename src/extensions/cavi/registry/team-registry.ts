import type {
  OperatorRegistrySnapshot,
  OperatorRegistryTeam,
} from "../domain/index.js";
import type { PortalLibraryRef } from "../contracts/portals.js";
import {
  normalizeTeamManifest,
  type TeamManifest,
  type ManifestTeam,
} from "../../../contracts/team-manifest.js";

export type TeamRegistryProviderKind =
  | "gateway"
  | "hermes"
  | "openclaw"
  | (string & {});

export type TeamRegistryTeamConfig = Partial<OperatorRegistryTeam> & {
  id: string;
  name?: string | null;
};

export type TeamRegistryLibraryRefConfig = PortalLibraryRef & {
  lookupKeys?: readonly string[];
};

export type TeamRegistryLibraryConfig = {
  fleet?: TeamRegistryLibraryRefConfig | null;
  teams?: readonly TeamRegistryLibraryRefConfig[] | null;
};

export type TeamRegistryConfig = {
  provider?: TeamRegistryProviderKind | null;
  manifest?: Partial<TeamManifest> | null;
  teams?: readonly TeamRegistryTeamConfig[] | null;
  libraries?: TeamRegistryLibraryConfig | null;
  snapshot?: Pick<OperatorRegistrySnapshot, "teams"> | null;
};

export type CreateTeamRegistryOptions = {
  provider?: TeamRegistryProviderKind | null;
};

export interface TeamRegistry {
  readonly provider: TeamRegistryProviderKind;
  listTeams(): OperatorRegistryTeam[];
  listPortalIds(): string[];
  getTeamLookupKeys(team: OperatorRegistryTeam): string[];
  resolveTeam(identifier: string | null | undefined): OperatorRegistryTeam | null;
  requireTeam(identifier: string | null | undefined): OperatorRegistryTeam;
  getPortalTeam(portalId: string | null | undefined): OperatorRegistryTeam;
  getPortalTeamCode(portalId: string | null | undefined): string;
  getPortalTeamSlug(portalId: string | null | undefined): string;
  getPortalTeamSectorSlug(portalId: string | null | undefined): string;
  getFleetLibraryRef(): PortalLibraryRef | null;
  resolvePortalLibraryRef(portalId: string | null | undefined): PortalLibraryRef | null;
  resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null;
  listLibraryRefs(): PortalLibraryRef[];
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

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof value === "string") {
    return [value];
  }
  return [];
}

function toPortalLibraryRef(record: TeamRegistryLibraryRefConfig): PortalLibraryRef {
  return {
    scope: record.scope,
    libraryTeamId: record.libraryTeamId,
    ...(record.ownerPortalId ? { ownerPortalId: record.ownerPortalId } : {}),
  };
}

function teamFromManifest(team: ManifestTeam): TeamRegistryTeamConfig {
  const identity = team.identity ?? {};
  const meta = (identity.metadata ?? {}) as Record<string, unknown>;
  const metaStr = (key: string): string | null => {
    const value = meta[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const name = identity.name ?? identity.displayName ?? team.id;
  const teamSlug = identity.slug ?? team.id;
  const teamCode = identity.code ?? teamSlug;
  const sectorSlug = metaStr("sectorSlug") ?? teamSlug;
  const sectorCode = metaStr("sectorCode") ?? teamCode;
  const members = team.members?.map((member) => member.id) ?? [];

  return {
    id: team.id,
    name,
    displayName: identity.displayName ?? name,
    teamSlug,
    teamCode,
    sectorSlug,
    sectorCode,
    portalId: metaStr("portalId"),
    legacyAliases: [...(identity.aliases ?? [])],
    members,
    memberIdentityIds: members,
    ownsCapabilities: [...(team.capabilities ?? [])],
    teamManifest: null,
  };
}

function configuredTeams(config: TeamRegistryConfig): readonly TeamRegistryTeamConfig[] {
  if (config.snapshot?.teams?.length) {
    return config.snapshot.teams;
  }
  if (config.manifest) {
    return normalizeTeamManifest(config.manifest).teams.map(teamFromManifest);
  }
  return config.teams ?? [];
}

function missingRegistryMessage(identifier: string | null | undefined): string {
  const suffix = identifier?.trim() ? ` for "${identifier.trim()}"` : "";
  return `Team registry is not configured${suffix}. Load TEAM_REGISTRY_CONFIG from the selected gateway/plugin before using registry-dependent APIs.`;
}

export function normalizeTeamLookupValue(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, "-");
}

export function getTeamLookupKeys(team: OperatorRegistryTeam): string[] {
  return uniqStrings([
    team.teamCode,
    team.teamSlug,
    team.id,
    team.portalId,
    ...coerceStringArray(team.legacyAliases),
  ]).map(normalizeTeamLookupValue);
}

export function matchesTeamIdentifier(
  team: OperatorRegistryTeam,
  identifier: string | null | undefined,
): boolean {
  if (!identifier?.trim()) {
    return false;
  }
  return getTeamLookupKeys(team).includes(normalizeTeamLookupValue(identifier));
}

export function normalizeTeamRegistryTeam(
  team: TeamRegistryTeamConfig,
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
      ...coerceStringArray(team.legacyAliases),
      ...coerceStringArray(fallback?.legacyAliases),
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

export function resolveTeamFromCollection(
  teams: readonly OperatorRegistryTeam[],
  identifier: string | null | undefined,
): OperatorRegistryTeam | null {
  if (!identifier?.trim()) {
    return null;
  }
  return (
    teams.find((team) => matchesTeamIdentifier(team, identifier)) ?? null
  );
}

function assertUniqueTeamRegistryLookups(teams: readonly OperatorRegistryTeam[]): void {
  const lookupOwners = new Map<string, string>();
  const portalOwners = new Map<string, string>();
  for (const team of teams) {
    if (team.portalId?.trim()) {
      const portalId = normalizeTeamLookupValue(team.portalId);
      const owner = portalOwners.get(portalId);
      if (owner && owner !== team.id) {
        throw new Error(
          `Team registry has duplicate portal id "${portalId}" for teams "${owner}" and "${team.id}".`,
        );
      }
      portalOwners.set(portalId, team.id);
    }
    for (const key of getTeamLookupKeys(team)) {
      const owner = lookupOwners.get(key);
      if (owner && owner !== team.id) {
        throw new Error(
          `Team registry has ambiguous lookup key "${key}" for teams "${owner}" and "${team.id}".`,
        );
      }
      lookupOwners.set(key, team.id);
    }
  }
}

export function createTeamRegistry(
  config: TeamRegistryConfig = {},
  options: CreateTeamRegistryOptions = {},
): TeamRegistry {
  const provider = options.provider ?? config.provider ?? "gateway";
  const teams = configuredTeams(config).map((team) =>
    normalizeTeamRegistryTeam(team, null),
  );
  assertUniqueTeamRegistryLookups(teams);
  const fleetLibrary = config.libraries?.fleet ?? null;
  const teamLibraries = config.libraries?.teams ?? [];

  function resolveTeam(identifier: string | null | undefined): OperatorRegistryTeam | null {
    return resolveTeamFromCollection(teams, identifier);
  }

  function requireTeam(identifier: string | null | undefined): OperatorRegistryTeam {
    const team = resolveTeam(identifier);
    if (!team) {
      throw new Error(missingRegistryMessage(identifier));
    }
    return team;
  }

  function getPortalTeam(portalId: string | null | undefined): OperatorRegistryTeam {
    if (!portalId?.trim()) {
      throw new Error(missingRegistryMessage(portalId));
    }
    const team =
      teams.find((entry) => entry.portalId === portalId) ??
      resolveTeam(portalId);
    if (!team) {
      throw new Error(missingRegistryMessage(portalId));
    }
    return team;
  }

  function buildLookupSet(
    portalId: string | null | undefined,
    record: TeamRegistryLibraryRefConfig,
  ): Set<string> {
    const team = portalId ? resolveTeam(portalId) : null;
    return new Set(
      [
        portalId,
        team?.id,
        team?.name,
        team?.displayName,
        team?.teamSlug,
        team?.teamCode,
        team?.sectorSlug,
        team?.department,
        ...(team?.legacyAliases ?? []),
        ...(record.lookupKeys ?? []),
        record.libraryTeamId,
      ]
        .flatMap((value) => {
          if (!value) {
            return [];
          }
          const normalized = normalizeTeamLookupValue(value);
          return normalized ? [normalized] : [];
        })
        .filter(Boolean),
    );
  }

  return {
    provider,
    listTeams() {
      return teams.slice();
    },
    listPortalIds() {
      return teams
        .map((team) => team.portalId)
        .filter((portalId): portalId is string => Boolean(portalId));
    },
    getTeamLookupKeys,
    resolveTeam,
    requireTeam,
    getPortalTeam,
    getPortalTeamCode(portalId: string | null | undefined): string {
      return getPortalTeam(portalId).teamCode;
    },
    getPortalTeamSlug(portalId: string | null | undefined): string {
      return getPortalTeam(portalId).teamSlug;
    },
    getPortalTeamSectorSlug(portalId: string | null | undefined): string {
      return getPortalTeam(portalId).sectorSlug;
    },
    getFleetLibraryRef(): PortalLibraryRef | null {
      return fleetLibrary ? toPortalLibraryRef(fleetLibrary) : null;
    },
    resolvePortalLibraryRef(portalId: string | null | undefined): PortalLibraryRef | null {
      if (!portalId?.trim()) {
        return null;
      }
      const normalizedPortalId = normalizeTeamLookupValue(portalId);
      if (
        fleetLibrary?.ownerPortalId &&
        normalizeTeamLookupValue(fleetLibrary.ownerPortalId) === normalizedPortalId
      ) {
        return toPortalLibraryRef(fleetLibrary);
      }
      const record = teamLibraries.find(
        (entry) =>
          (entry.ownerPortalId &&
            normalizeTeamLookupValue(entry.ownerPortalId) === normalizedPortalId) ||
          buildLookupSet(entry.ownerPortalId, entry).has(normalizedPortalId),
      );
      return record ? toPortalLibraryRef(record) : null;
    },
    resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null {
      const normalized = normalizeTeamLookupValue(value ?? "");
      if (!normalized) {
        return null;
      }
      if (fleetLibrary && buildLookupSet(fleetLibrary.ownerPortalId, fleetLibrary).has(normalized)) {
        return toPortalLibraryRef(fleetLibrary);
      }
      for (const record of teamLibraries) {
        if (buildLookupSet(record.ownerPortalId, record).has(normalized)) {
          return toPortalLibraryRef(record);
        }
      }
      return null;
    },
    listLibraryRefs(): PortalLibraryRef[] {
      return [
        ...(fleetLibrary ? [toPortalLibraryRef(fleetLibrary)] : []),
        ...teamLibraries.map(toPortalLibraryRef),
      ];
    },
  };
}

export function createTeamRegistryFromSnapshot(
  snapshot: OperatorRegistrySnapshot | null | undefined,
  options: CreateTeamRegistryOptions = {},
): TeamRegistry {
  return createTeamRegistry(
    {
      provider: options.provider,
      snapshot: snapshot ?? null,
    },
    options,
  );
}
