export type DiscourseEventType =
  | "discourse.dispatch"
  | "discourse.delegation"
  | "discourse.decision"
  | "discourse.blocker"
  | "discourse.resolution"
  | "discourse.status"
  | "discourse.escalation"
  | "discourse.completion"
  | "discourse.spawn.dedup"
  | "discourse.spawn.guard"
  | "discourse.spawn.budget";

type DiscourseEventBase = {
  id: string;
  ts: number;
  taskId: string;
  parentTaskId: string | null;
  agentId: string;
  sessionKey: string;
  runId: string;
};

export type DiscourseDispatchData = {
  targetAgentId: string;
  objective: string;
  tier: string;
  packetType: string;
  approachRationale?: string;
  alternativesConsidered?: string[];
};

export type DiscourseDelegationData = {
  targetAgentId: string;
  objective: string;
  teamId?: string;
  rationale?: string;
};

export type DiscourseDecisionData = {
  question: string;
  chosenApproach: string;
  rationale: string;
  alternatives: Array<{
    approach: string;
    reasonRejected: string;
  }>;
};

export type DiscourseBlockerData = {
  blockerCode: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  retryable: boolean;
};

export type DiscourseResolutionData = {
  originalBlockerEventId: string;
  resolution: string;
  method: "retry" | "workaround" | "escalate" | "skip";
};

export type DiscourseStatusData = {
  prevState: string;
  nextState: string;
  note?: string;
};

export type DiscourseEscalationData = {
  reason: string;
  target: string;
  severity?: "low" | "medium" | "high" | "critical";
};

export type DiscourseCompletionData = {
  outcome: "ok" | "error" | "timeout" | "partial";
  resultSummary: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
};

export type DiscourseSpawnDedupData = {
  targetAgentId: string;
  existingChildSessionKey: string;
  ttlMs: number;
};

export type DiscourseSpawnGuardData = {
  targetAgentId: string;
  failureCode: string;
  strikeCount: number;
  ttlMs: number;
};

export type DiscourseSpawnBudgetData = {
  recentFailureCount: number;
  blockStrikeCount: number;
  retryAfterMs: number;
};

export type DiscourseDispatchEvent = DiscourseEventBase & {
  type: "discourse.dispatch";
  data: DiscourseDispatchData;
};

export type DiscourseDelegationEvent = DiscourseEventBase & {
  type: "discourse.delegation";
  data: DiscourseDelegationData;
};

export type DiscourseDecisionEvent = DiscourseEventBase & {
  type: "discourse.decision";
  data: DiscourseDecisionData;
};

export type DiscourseBlockerEvent = DiscourseEventBase & {
  type: "discourse.blocker";
  data: DiscourseBlockerData;
};

export type DiscourseResolutionEvent = DiscourseEventBase & {
  type: "discourse.resolution";
  data: DiscourseResolutionData;
};

export type DiscourseStatusEvent = DiscourseEventBase & {
  type: "discourse.status";
  data: DiscourseStatusData;
};

export type DiscourseEscalationEvent = DiscourseEventBase & {
  type: "discourse.escalation";
  data: DiscourseEscalationData;
};

export type DiscourseCompletionEvent = DiscourseEventBase & {
  type: "discourse.completion";
  data: DiscourseCompletionData;
};

export type DiscourseSpawnDedupEvent = DiscourseEventBase & {
  type: "discourse.spawn.dedup";
  data: DiscourseSpawnDedupData;
};

export type DiscourseSpawnGuardEvent = DiscourseEventBase & {
  type: "discourse.spawn.guard";
  data: DiscourseSpawnGuardData;
};

export type DiscourseSpawnBudgetEvent = DiscourseEventBase & {
  type: "discourse.spawn.budget";
  data: DiscourseSpawnBudgetData;
};

export type DiscourseEvent =
  | DiscourseDispatchEvent
  | DiscourseDelegationEvent
  | DiscourseDecisionEvent
  | DiscourseBlockerEvent
  | DiscourseResolutionEvent
  | DiscourseStatusEvent
  | DiscourseEscalationEvent
  | DiscourseCompletionEvent
  | DiscourseSpawnDedupEvent
  | DiscourseSpawnGuardEvent
  | DiscourseSpawnBudgetEvent;

export type TaskDiscourseAgent = {
  agentId: string;
  role: string;
  eventCount: number;
  tokensUsed: number;
  costUsd: number;
};

export type DelegationNode = {
  taskId: string;
  agentId: string;
  objective: string;
  status: string;
  children: DelegationNode[];
  events: DiscourseEvent[];
  cost: {
    tokens: number;
    costUsd: number;
    durationMs: number | null;
  };
};

export type TaskDiscourseSummary = {
  totalAgents: number;
  totalEvents: number;
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number | null;
  blockerCount: number;
  decisionCount: number;
  outcome: "success" | "partial" | "fail" | "blocked" | "pending";
};

export type TaskDiscourseSnapshot = {
  rootTaskId: string;
  agents: TaskDiscourseAgent[];
  events: DiscourseEvent[];
  delegationTree: DelegationNode[];
  summary: TaskDiscourseSummary;
};
