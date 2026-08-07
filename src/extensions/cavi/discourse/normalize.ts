import type {
  DelegationNode,
  DiscourseEvent,
  TaskDiscourseAgent,
  TaskDiscourseSnapshot,
  TaskDiscourseSummary,
} from "../domain/index.js";
import {
  asBoolean,
  asNumber,
  asString,
  isRecord,
} from "../../../core/data/guards.js";
import {
  asBlockerSeverity,
  asCompletionOutcome,
  asDiscourseMessageText,
  asDiscourseScalarToken,
  asDiscourseSummaryOutcome,
  asResolutionMethod,
  coerceDiscourseDataRecord,
  isDiscourseEventType,
} from "./normalize-helpers.js";

const MAX_DISCOURSE_TREE_DEPTH = 64;
const MAX_DISCOURSE_NORMALIZATION_WORK = 10_000;

type DiscourseNormalizationBudget = {
  workItems: number;
};

export function normalizeDiscourseEvent(
  raw: unknown,
  fallbackTaskId: string,
): DiscourseEvent | null {
  const budget: DiscourseNormalizationBudget = { workItems: 0 };
  reserveDiscourseWork(budget, 1);
  return normalizeDiscourseEventWithBudget(raw, fallbackTaskId, budget);
}

function reserveDiscourseWork(
  budget: DiscourseNormalizationBudget,
  workItems: number,
  errorMessage = "Task discourse exceeds maximum normalization work.",
): void {
  if (
    workItems >
    MAX_DISCOURSE_NORMALIZATION_WORK - budget.workItems
  ) {
    throw new Error(errorMessage);
  }
  budget.workItems += workItems;
}

function normalizeDiscourseStringArray(
  raw: unknown,
  budget: DiscourseNormalizationBudget,
): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  reserveDiscourseWork(budget, raw.length);
  return raw
    .map((entry) => asString(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeDecisionAlternatives(
  raw: unknown,
  budget: DiscourseNormalizationBudget,
): Array<{ approach: string; reasonRejected: string }> {
  if (!Array.isArray(raw)) {
    return [];
  }
  reserveDiscourseWork(budget, raw.length);
  return raw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      return {
        approach: asDiscourseMessageText(entry.approach, "unknown"),
        reasonRejected: asDiscourseMessageText(
          entry.reasonRejected,
          "Not provided",
        ),
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        approach: string;
        reasonRejected: string;
      } => entry !== null,
    );
}

function normalizeDiscourseEventWithBudget(
  raw: unknown,
  fallbackTaskId: string,
  budget: DiscourseNormalizationBudget,
): DiscourseEvent | null {
  const record = isRecord(raw) ? raw : null;
  if (!record) {
    return null;
  }

  const type = isDiscourseEventType(record.type) ? record.type : null;
  if (!type) {
    return null;
  }

  const data = coerceDiscourseDataRecord(record.data);
  const eventBase = {
    id: asString(record.id) ?? `discourse-${type}-${Date.now()}`,
    ts: asNumber(record.ts) ?? Date.now(),
    taskId: asString(record.taskId) ?? fallbackTaskId,
    parentTaskId:
      record.parentTaskId === null ? null : asString(record.parentTaskId),
    agentId: asString(record.agentId) ?? "unknown-agent",
    sessionKey: asString(record.sessionKey) ?? "unknown-session",
    runId: asString(record.runId) ?? "unknown-run",
  };

  switch (type) {
    case "discourse.dispatch":
      return {
        ...eventBase,
        type,
        data: {
          targetAgentId: asString(data.targetAgentId) ?? "unknown-agent",
          objective: asDiscourseMessageText(
            data.objective,
            "No objective recorded.",
          ),
          tier: asDiscourseScalarToken(data.tier, "STANDARD"),
          packetType: asDiscourseScalarToken(data.packetType, "L1_TASK_V1"),
          approachRationale: (() => {
            const text = asDiscourseMessageText(data.approachRationale, "");
            return text.trim().length > 0 ? text : undefined;
          })(),
          alternativesConsidered: normalizeDiscourseStringArray(
            data.alternativesConsidered,
            budget,
          ),
        },
      };
    case "discourse.delegation":
      return {
        ...eventBase,
        type,
        data: {
          targetAgentId: asString(data.targetAgentId) ?? "unknown-agent",
          objective: asDiscourseMessageText(
            data.objective,
            "No delegation objective recorded.",
          ),
          teamId: asString(data.teamId) ?? undefined,
          rationale: (() => {
            const text = asDiscourseMessageText(data.rationale, "");
            return text.trim().length > 0 ? text : undefined;
          })(),
        },
      };
    case "discourse.decision":
      return {
        ...eventBase,
        type,
        data: {
          question: asDiscourseMessageText(data.question, "Decision point"),
          chosenApproach: asDiscourseMessageText(
            data.chosenApproach,
            "unknown",
          ),
          rationale: asDiscourseMessageText(
            data.rationale,
            "No rationale recorded.",
          ),
          alternatives: normalizeDecisionAlternatives(
            data.alternatives,
            budget,
          ),
        },
      };
    case "discourse.blocker":
      return {
        ...eventBase,
        type,
        data: {
          blockerCode: asString(data.blockerCode) ?? "unknown_blocker",
          description: asDiscourseMessageText(
            data.description,
            "No blocker details provided.",
          ),
          severity: asBlockerSeverity(data.severity),
          retryable: asBoolean(data.retryable) ?? false,
        },
      };
    case "discourse.resolution":
      return {
        ...eventBase,
        type,
        data: {
          originalBlockerEventId:
            asString(data.originalBlockerEventId) ?? "unknown-blocker",
          resolution: asDiscourseMessageText(
            data.resolution,
            "No resolution details recorded.",
          ),
          method: asResolutionMethod(data.method),
        },
      };
    case "discourse.status":
      return {
        ...eventBase,
        type,
        data: {
          prevState: asString(data.prevState) ?? "unknown",
          nextState: asString(data.nextState) ?? "unknown",
          note: (() => {
            const text = asDiscourseMessageText(data.note, "");
            return text.trim().length > 0 ? text : undefined;
          })(),
        },
      };
    case "discourse.escalation":
      return {
        ...eventBase,
        type,
        data: {
          reason: asDiscourseMessageText(
            data.reason,
            "No escalation reason provided.",
          ),
          target: asString(data.target) ?? "unknown",
          severity: asString(data.severity) as
            | "low"
            | "medium"
            | "high"
            | "critical"
            | undefined,
        },
      };
    case "discourse.completion":
      return {
        ...eventBase,
        type,
        data: {
          outcome: asCompletionOutcome(data.outcome),
          resultSummary: asDiscourseMessageText(
            data.resultSummary,
            "No completion summary recorded.",
          ),
          tokensUsed: asNumber(data.tokensUsed) ?? 0,
          costUsd: asNumber(data.costUsd) ?? 0,
          durationMs: asNumber(data.durationMs) ?? 0,
        },
      };
    case "discourse.spawn.dedup":
      return {
        ...eventBase,
        type,
        data: {
          targetAgentId: asString(data.targetAgentId) ?? "unknown-agent",
          existingChildSessionKey:
            asString(data.existingChildSessionKey) ?? "unknown-session",
          ttlMs: asNumber(data.ttlMs) ?? 0,
        },
      };
    case "discourse.spawn.guard":
      return {
        ...eventBase,
        type,
        data: {
          targetAgentId: asString(data.targetAgentId) ?? "unknown-agent",
          failureCode: asString(data.failureCode) ?? "unknown_failure",
          strikeCount: asNumber(data.strikeCount) ?? 0,
          ttlMs: asNumber(data.ttlMs) ?? 0,
        },
      };
    case "discourse.spawn.budget":
      return {
        ...eventBase,
        type,
        data: {
          recentFailureCount: asNumber(data.recentFailureCount) ?? 0,
          blockStrikeCount: asNumber(data.blockStrikeCount) ?? 0,
          retryAfterMs: asNumber(data.retryAfterMs) ?? 0,
        },
      };
  }
}

function normalizeTaskDiscourseAgent(raw: unknown): TaskDiscourseAgent | null {
  const record = isRecord(raw) ? raw : null;
  if (!record) {
    return null;
  }

  const agentId = asString(record.agentId);
  if (!agentId) {
    return null;
  }

  return {
    agentId,
    role: asString(record.role) ?? "unknown-role",
    eventCount: asNumber(record.eventCount) ?? 0,
    tokensUsed: asNumber(record.tokensUsed) ?? 0,
    costUsd: asNumber(record.costUsd) ?? 0,
  };
}

function normalizeDiscourseEvents(
  rawEvents: unknown[],
  fallbackTaskId: string,
  budget: DiscourseNormalizationBudget,
): DiscourseEvent[] {
  reserveDiscourseWork(
    budget,
    rawEvents.length,
    "Task discourse snapshot exceeds maximum event count.",
  );
  return rawEvents
    .map((entry) =>
      normalizeDiscourseEventWithBudget(entry, fallbackTaskId, budget),
    )
    .filter((entry): entry is DiscourseEvent => entry !== null)
    .sort((left, right) => left.ts - right.ts);
}

function normalizeDelegationNodes(
  rawNodes: unknown[],
  fallbackTaskId: string,
  budget: DiscourseNormalizationBudget,
  depth: number,
): DelegationNode[] {
  reserveDiscourseWork(
    budget,
    rawNodes.length,
    "Task discourse delegation tree exceeds maximum node count.",
  );
  const nodes: DelegationNode[] = [];
  for (const rawNode of rawNodes) {
    const node = normalizeDelegationNode(
      rawNode,
      fallbackTaskId,
      budget,
      depth,
    );
    if (node) nodes.push(node);
  }
  return nodes;
}

function normalizeDelegationNode(
  raw: unknown,
  fallbackTaskId: string,
  budget: DiscourseNormalizationBudget,
  depth = 1,
): DelegationNode | null {
  if (depth > MAX_DISCOURSE_TREE_DEPTH) {
    throw new Error("Task discourse delegation tree exceeds maximum depth.");
  }
  const record = isRecord(raw) ? raw : null;
  if (!record) {
    return null;
  }

  const childrenRaw = Array.isArray(record.children) ? record.children : [];
  const eventsRaw = Array.isArray(record.events) ? record.events : [];
  const costRaw = isRecord(record.cost) ? record.cost : {};

  return {
    taskId: asString(record.taskId) ?? fallbackTaskId,
    agentId: asString(record.agentId) ?? "unknown-agent",
    objective: asString(record.objective) ?? "No objective recorded.",
    status: asString(record.status) ?? "unknown",
    children: normalizeDelegationNodes(
      childrenRaw,
      fallbackTaskId,
      budget,
      depth + 1,
    ),
    events: normalizeDiscourseEvents(eventsRaw, fallbackTaskId, budget),
    cost: {
      tokens: asNumber(costRaw.tokens) ?? 0,
      costUsd: asNumber(costRaw.costUsd) ?? 0,
      durationMs: asNumber(costRaw.durationMs),
    },
  };
}

function inferDiscourseOutcome(
  events: DiscourseEvent[],
): TaskDiscourseSummary["outcome"] {
  const completionEvents = events.filter(
    (event) => event.type === "discourse.completion",
  );
  if (
    completionEvents.some(
      (event) =>
        event.type === "discourse.completion" &&
        (event.data.outcome === "error" || event.data.outcome === "timeout"),
    )
  ) {
    return "fail";
  }
  if (
    completionEvents.some(
      (event) =>
        event.type === "discourse.completion" &&
        event.data.outcome === "partial",
    )
  ) {
    return "partial";
  }
  if (
    completionEvents.some(
      (event) =>
        event.type === "discourse.completion" && event.data.outcome === "ok",
    )
  ) {
    return "success";
  }
  if (events.some((event) => event.type === "discourse.blocker")) {
    return "blocked";
  }
  return "pending";
}

function resolveDiscourseDuration(events: DiscourseEvent[]): number | null {
  if (events.length < 2) {
    return null;
  }
  let count = 0;
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const event of events) {
    if (event.ts <= 0) continue;
    count += 1;
    minTs = Math.min(minTs, event.ts);
    maxTs = Math.max(maxTs, event.ts);
  }
  if (count < 2) {
    return null;
  }
  return maxTs > minTs ? maxTs - minTs : null;
}

function normalizeTaskDiscourseSummary(params: {
  raw: unknown;
  agents: TaskDiscourseAgent[];
  events: DiscourseEvent[];
}): TaskDiscourseSummary {
  const record = isRecord(params.raw) ? params.raw : {};
  const totalTokensFallback = params.agents.reduce(
    (sum, agent) => sum + agent.tokensUsed,
    0,
  );
  const totalCostFallback = params.agents.reduce(
    (sum, agent) => sum + agent.costUsd,
    0,
  );
  const blockerCountFallback = params.events.filter(
    (event) => event.type === "discourse.blocker",
  ).length;
  const decisionCountFallback = params.events.filter(
    (event) => event.type === "discourse.decision",
  ).length;

  return {
    totalAgents: asNumber(record.totalAgents) ?? params.agents.length,
    totalEvents: asNumber(record.totalEvents) ?? params.events.length,
    totalTokens: asNumber(record.totalTokens) ?? totalTokensFallback,
    totalCostUsd: asNumber(record.totalCostUsd) ?? totalCostFallback,
    durationMs:
      asNumber(record.durationMs) ?? resolveDiscourseDuration(params.events),
    blockerCount: asNumber(record.blockerCount) ?? blockerCountFallback,
    decisionCount: asNumber(record.decisionCount) ?? decisionCountFallback,
    outcome:
      asDiscourseSummaryOutcome(record.outcome) ??
      inferDiscourseOutcome(params.events),
  };
}

export function normalizeTaskDiscourseSnapshot(
  raw: unknown,
  fallbackTaskId: string,
): TaskDiscourseSnapshot {
  const record = isRecord(raw) ? raw : {};
  const rootTaskId = asString(record.rootTaskId) ?? fallbackTaskId;
  const eventsRaw = Array.isArray(record.events) ? record.events : [];
  const agentsRaw = Array.isArray(record.agents) ? record.agents : [];
  const treeRaw = Array.isArray(record.delegationTree)
    ? record.delegationTree
    : [];

  const budget: DiscourseNormalizationBudget = { workItems: 0 };
  const events = normalizeDiscourseEvents(eventsRaw, rootTaskId, budget);

  reserveDiscourseWork(budget, agentsRaw.length);
  const agents = agentsRaw
    .map((entry) => normalizeTaskDiscourseAgent(entry))
    .filter((entry): entry is TaskDiscourseAgent => entry !== null);

  const delegationTree = normalizeDelegationNodes(
    treeRaw,
    rootTaskId,
    budget,
    1,
  );

  const summary = normalizeTaskDiscourseSummary({
    raw: record.summary,
    agents,
    events,
  });

  return {
    rootTaskId,
    agents,
    events,
    delegationTree,
    summary,
  };
}
