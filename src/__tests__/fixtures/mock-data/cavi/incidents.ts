import type {
  IncidentRecord,
  IncidentsSnapshot,
} from "../../../../core/gateway/snapshots/contracts.js";
import { mockNow as now } from "./shared.js";

const incidents: IncidentRecord[] = [
  {
    id: "inc-logs-1",
    title: "CI remediator timeout",
    summary: "Subagent cleanup exceeded 30s timeout window.",
    severity: "high",
    status: "investigating",
    firstSeenAt: now - 6 * 60 * 60_000,
    lastSeenAt: now - 5 * 60_000,
    count: 4,
    owner: "inspectah-deck-qa",
    repeatedAcrossAgents: true,
    flaggedForImmediateFix: true,
    scope: "cavi-control",
    agentIds: ["inspectah-deck-qa", "tony", "raekwon"],
    workTaskAssigned: "fix-ci-cleanup-timeout",
  },
  {
    id: "inc-logs-2",
    title: "Gateway auth retry spike",
    summary: "Burst of unauthorized ws connect attempts from non-paired browser clients.",
    severity: "medium",
    status: "open",
    firstSeenAt: now - 4 * 60 * 60_000,
    lastSeenAt: now - 24 * 60_000,
    count: 7,
    owner: "tony",
    scope: "gateway",
    agentIds: ["tony"],
  },
  {
    id: "inc-logs-3",
    title: "Bad planning: scope creep on Deb sync",
    summary: "Agent repeatedly extended task scope without re-estimating. Led to stalled PR.",
    severity: "medium",
    status: "blocked",
    firstSeenAt: now - 2 * 24 * 60 * 60_000,
    lastSeenAt: now - 3 * 60 * 60_000,
    count: 2,
    owner: "method-man-frontend",
    planningRelated: true,
    scope: "bloktix",
    agentIds: ["method-man-frontend", "inspectah-deck"],
  },
];

export const mockIncidents: IncidentsSnapshot = {
  incidents: [...incidents],
  blockers: incidents.filter((incident) => incident.status === "blocked"),
};
