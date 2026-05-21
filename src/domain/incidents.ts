export type IncidentSeverity = "critical" | "high" | "medium" | "low";

export type IncidentStatus = "open" | "investigating" | "blocked" | "resolved";

/** Optional extended fields; backend may not provide until synced. */
export type IncidentRecord = {
  id: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  firstSeenAt: number;
  lastSeenAt: number;
  count: number;
  owner: string;
  /** Repeated across multiple agents → flag for immediate fix */
  repeatedAcrossAgents?: boolean;
  /** Blocker-level; needs urgent triage */
  flaggedForImmediateFix?: boolean;
  /** Planning/bad-planning related */
  planningRelated?: boolean;
  /** Work task ID or title if assigned */
  workTaskAssigned?: string;
  /** Scope (e.g. "cavi-control", "gateway", "bloktix") */
  scope?: string;
  /** Agent IDs that saw this incident */
  agentIds?: string[];
};

export type IncidentsSnapshot = {
  incidents: IncidentRecord[];
  blockers: IncidentRecord[];
};
