import type { FleetLibrarySnapshot, TeamLibraryStatus } from "../../domain/index.js";
import type { JsonHttpRequest } from "../../../../core/http/json-client.js";
import { requestLibraryApiJson } from "../../library/api.js";
import type { PortalLibraryRef } from "../../contracts/portals.js";
import { getPortalTeamIdentity } from "../../registry/canonical-team-registry.js";
import { listPortalLibraryRefs } from "../../registry/portal-library-registry.js";

function listTeamLibraryRefs(): PortalLibraryRef[] {
  return listPortalLibraryRefs().filter(
    (ref) => ref.scope === "team" && ref.ownerPortalId,
  );
}

function resolveTeamMeta(ref: PortalLibraryRef): {
  name: string;
  lead: string;
} {
  if (ref.ownerPortalId) {
    const team = getPortalTeamIdentity(ref.ownerPortalId);
    return {
      name: team.displayName || team.name || ref.libraryTeamId,
      lead: team.lead ?? team.dispatchDefaultAlias ?? ref.ownerPortalId,
    };
  }

  return { name: ref.libraryTeamId, lead: "unknown" };
}

type LibrarianStatusResponse = {
  status: string;
  inbox: number;
  inbox_count: number;
  pending: number;
  pending_count: number;
  processed: number;
  rejected: number;
  sigmund_status?: string;
  last_ingest_at?: number | null;
  total_processed?: number;
};

function numberFromStatus(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildTeamStatus(
  ref: PortalLibraryRef,
  fleetStatus: LibrarianStatusResponse,
): TeamLibraryStatus {
  const meta = resolveTeamMeta(ref);
  return {
    teamId: ref.libraryTeamId,
    teamName: meta.name,
    lead: meta.lead,
    inboxCount: 0,
    candidatesCount: 0,
    promotedCount: 0,
    rejectedCount: 0,
    recentPromotions: [],
    qmdHealth: {
      lastIndexedAt: fleetStatus.last_ingest_at ?? null,
      collectionSize: numberFromStatus(
        fleetStatus.total_processed,
        numberFromStatus(fleetStatus.processed),
      ),
      healthy: fleetStatus.status === "ok",
    },
  };
}

async function fetchFleetStatus(
  requestJson: JsonHttpRequest,
): Promise<LibrarianStatusResponse> {
  return await requestLibraryApiJson<LibrarianStatusResponse>(
    requestJson,
    "/fleet-status",
  );
}

function buildSigmundStatus(
  data: LibrarianStatusResponse,
): FleetLibrarySnapshot["sigmund"] {
  const status =
    data.sigmund_status === "online"
      ? "online"
      : data.sigmund_status === "offline"
        ? "offline"
      : data.status === "ok"
        ? "online"
        : "unknown";
  return {
    status: status as "online" | "offline" | "unknown",
    lastIngestAt: data.last_ingest_at ?? null,
    totalProcessed: numberFromStatus(
      data.total_processed,
      numberFromStatus(data.processed),
    ),
  };
}

export async function loadFleetLibraryLive(
  requestJson: JsonHttpRequest,
): Promise<FleetLibrarySnapshot> {
  const teamLibraryRefs = listTeamLibraryRefs();
  if (teamLibraryRefs.length === 0) {
    throw new Error(
      "Team registry config does not define team library refs. Load TEAM_REGISTRY_CONFIG before loading fleet library status.",
    );
  }
  const fleetStatus = await fetchFleetStatus(requestJson);

  return {
    generatedAt: Date.now(),
    teams: teamLibraryRefs.map((ref) => buildTeamStatus(ref, fleetStatus)),
    sigmund: buildSigmundStatus(fleetStatus),
  };
}
