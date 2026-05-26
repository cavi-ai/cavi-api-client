import type {
  IncidentRecord,
  IncidentsSnapshot,
} from "../../../../core/gateway/snapshots/contracts.js";
import { fallbackSnapshotNow as now } from "./shared.js";

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
    owner: "qa-operator-qa",
    repeatedAcrossAgents: true,
    flaggedForImmediateFix: true,
    scope: "cavi-control",
    agentIds: ["qa-operator-qa", "primary-operator", "backend-operator"],
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
    owner: "primary-operator",
    scope: "gateway",
    agentIds: ["primary-operator"],
  },
  {
    id: "inc-logs-3",
    title: "Bad planning: scope creep on Project Board sync",
    summary: "Agent repeatedly extended task scope without re-estimating. Led to stalled PR.",
    severity: "medium",
    status: "blocked",
    firstSeenAt: now - 2 * 24 * 60 * 60_000,
    lastSeenAt: now - 3 * 60 * 60_000,
    count: 2,
    owner: "ui-operator",
    planningRelated: true,
    scope: "bloktix",
    agentIds: ["ui-operator", "qa-operator"],
  },
];

export const fallbackIncidents: IncidentsSnapshot = {
  incidents: [...incidents],
  blockers: incidents.filter((incident) => incident.status === "blocked"),
};
