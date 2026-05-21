import {
  CAVI_TEAM_PORTAL_IDS,
  getPortalTeamIdentity,
  normalizeTeamLookupValue,
  type CaviTeamPortalId,
} from "./canonical-team-registry.js";
import type { PortalLibraryRef } from "./portal-api-contract.js";

type PortalLibraryRecord = PortalLibraryRef & {
  lookupKeys: readonly string[];
};

const FLEET_LIBRARY_RECORD: PortalLibraryRecord = {
  scope: "fleet",
  libraryTeamId: "library",
  lookupKeys: ["library", "fleet", "fleet-library", "grand-library", "sigmund"],
};

const TEAM_LIBRARY_RECORDS: Partial<Record<CaviTeamPortalId, PortalLibraryRecord>> = {
  angela: {
    scope: "team",
    libraryTeamId: "angels",
    ownerPortalId: "angela",
    lookupKeys: ["angels", "marketing"],
  },
  scout: {
    scope: "team",
    libraryTeamId: "scout-school",
    ownerPortalId: "scout",
    lookupKeys: ["scout-school", "research"],
  },
  machine: {
    scope: "team",
    libraryTeamId: "griselda",
    ownerPortalId: "machine",
    lookupKeys: ["griselda", "media"],
  },
  martina: {
    scope: "team",
    libraryTeamId: "headhunter",
    ownerPortalId: "martina",
    lookupKeys: ["headhunter", "career-ops", "career"],
  },
  "wu-tang": {
    scope: "team",
    libraryTeamId: "wu-tang",
    ownerPortalId: "wu-tang",
    lookupKeys: ["wu-tang", "development", "engineering"],
  },
  "run-dmc": {
    scope: "team",
    libraryTeamId: "run-dmc",
    ownerPortalId: "run-dmc",
    lookupKeys: ["run-dmc", "dev-ops", "system-ops"],
  },
  deb: {
    scope: "team",
    libraryTeamId: "paw-and-order",
    ownerPortalId: "deb",
    lookupKeys: ["paw-and-order", "paw and order", "project-ops"],
  },
};

function toPortalLibraryRef(record: PortalLibraryRecord): PortalLibraryRef {
  return {
    scope: record.scope,
    libraryTeamId: record.libraryTeamId,
    ...(record.ownerPortalId ? { ownerPortalId: record.ownerPortalId } : {}),
  };
}

function buildLookupSet(portalId: CaviTeamPortalId, record: PortalLibraryRecord): Set<string> {
  if (portalId === "front-door") {
    return new Set(
      [...record.lookupKeys, portalId]
        .map((value) => normalizeTeamLookupValue(value))
        .filter(Boolean),
    );
  }
  const team = getPortalTeamIdentity(portalId);
  return new Set(
    [
      portalId,
      team.id,
      team.name,
      team.displayName,
      team.teamSlug,
      team.teamCode,
      team.sectorSlug,
      team.department,
      ...(team.legacyAliases ?? []),
      ...record.lookupKeys,
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

export function getFleetLibraryRef(): PortalLibraryRef {
  return toPortalLibraryRef(FLEET_LIBRARY_RECORD);
}

export function resolvePortalLibraryRef(portalId: CaviTeamPortalId): PortalLibraryRef | null {
  if (portalId === "front-door") {
    return getFleetLibraryRef();
  }
  const record = TEAM_LIBRARY_RECORDS[portalId];
  return record ? toPortalLibraryRef(record) : null;
}

export function resolveLibraryRefByTeamIdentity(value: string | null | undefined): PortalLibraryRef | null {
  const normalized = normalizeTeamLookupValue(value ?? "");
  if (!normalized) {
    return null;
  }
  if (buildLookupSet("front-door", FLEET_LIBRARY_RECORD).has(normalized)) {
    return getFleetLibraryRef();
  }
  for (const portalId of CAVI_TEAM_PORTAL_IDS) {
    if (portalId === "front-door") {
      continue;
    }
    const record = TEAM_LIBRARY_RECORDS[portalId];
    if (!record) {
      continue;
    }
    if (buildLookupSet(portalId, record).has(normalized)) {
      return toPortalLibraryRef(record);
    }
  }
  return null;
}

export function listPortalLibraryRefs(): PortalLibraryRef[] {
  return [
    getFleetLibraryRef(),
    ...CAVI_TEAM_PORTAL_IDS.filter((portalId) => portalId !== "front-door")
      .map((portalId) => TEAM_LIBRARY_RECORDS[portalId])
      .filter((value): value is PortalLibraryRecord => Boolean(value))
      .map((record) => toPortalLibraryRef(record)),
  ];
}
