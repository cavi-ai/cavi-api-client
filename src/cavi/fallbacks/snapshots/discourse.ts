import type { TaskDiscourseSnapshot } from "../../domain/index.js";
import { fallbackSnapshotNow as now } from "./shared.js";

export function fallbackTaskDiscourse(taskId: string): TaskDiscourseSnapshot {
  const rootTaskId = taskId.trim() || "task-operator-1";
  const baseTs = now - 18 * 60_000;
  const blockerEventId = `${rootTaskId}-blocker-1`;

  const events: TaskDiscourseSnapshot["events"] = [
    {
      id: `${rootTaskId}-dispatch-1`,
      ts: baseTs + 5_000,
      taskId: rootTaskId,
      parentTaskId: null,
      agentId: "tonya",
      sessionKey: "session-tonya-main",
      runId: "task-run-1",
      type: "discourse.dispatch",
      data: {
        targetAgentId: "bobby-digital",
        objective: "Implement operator task lifecycle dashboard updates.",
        tier: "STANDARD",
        packetType: "L1_TASK_V1",
        approachRationale:
          "UI + orchestration visibility both require delegated specialist execution.",
        alternativesConsidered: [
          "single-agent execution",
          "defer UI until gateway parity",
        ],
      },
    },
    {
      id: `${rootTaskId}-status-dispatch`,
      ts: baseTs + 8_000,
      taskId: rootTaskId,
      parentTaskId: null,
      agentId: "tonya",
      sessionKey: "session-tonya-main",
      runId: "task-run-1",
      type: "discourse.status",
      data: {
        prevState: "queued",
        nextState: "started",
        note: "Bobby accepted dispatch. Monitoring delegation chain.",
      },
    },
    {
      id: `${rootTaskId}-decision-1`,
      ts: baseTs + 12_000,
      taskId: rootTaskId,
      parentTaskId: null,
      agentId: "bobby-digital",
      sessionKey: "session-bobby-main",
      runId: "task-run-1",
      type: "discourse.decision",
      data: {
        question:
          "How should implementation be split across frontend and backend constraints?",
        chosenApproach: "parallel_frontend_backend",
        rationale:
          "Parallel tracks reduce lead time while preserving ownership boundaries.",
        alternatives: [
          {
            approach: "single_frontend_pass",
            reasonRejected:
              "Could not validate operator API behavior end-to-end.",
          },
          {
            approach: "backend_only_then_ui",
            reasonRejected:
              "Would leave operators without immediate visibility improvements.",
          },
        ],
      },
    },
    {
      id: `${rootTaskId}-delegation-1`,
      ts: baseTs + 18_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "bobby-digital",
      sessionKey: "session-bobby-main",
      runId: "task-run-1",
      type: "discourse.delegation",
      data: {
        targetAgentId: "method-man",
        objective: "Implement Task Discourse timeline UI and filters.",
        teamId: "execution-fleet",
        rationale:
          "Frontend specialization with existing context on Cavi Control components.",
      },
    },
    {
      id: `${rootTaskId}-status-method-started`,
      ts: baseTs + 22_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "method-man",
      sessionKey: "session-method-man-ui",
      runId: "task-run-1",
      type: "discourse.status",
      data: {
        prevState: "queued",
        nextState: "started",
        note: "Reading existing discourse components. Assessing current layout against chat pattern.",
      },
    },
    {
      id: `${rootTaskId}-decision-method`,
      ts: baseTs + 35_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "method-man",
      sessionKey: "session-method-man-ui",
      runId: "task-run-1",
      type: "discourse.decision",
      data: {
        question: "Should timeline use virtual scrolling for large event sets?",
        chosenApproach: "deferred_virtualization",
        rationale:
          "Most discourse sessions have <100 events. Adding react-window now adds complexity without measurable benefit. Easy to retrofit later.",
        alternatives: [
          {
            approach: "immediate_virtualization",
            reasonRejected:
              "Over-engineering for current data volumes. No perf issue observed.",
          },
        ],
      },
    },
    {
      id: blockerEventId,
      ts: baseTs + 46_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "method-man",
      sessionKey: "session-method-man-ui",
      runId: "task-run-1",
      type: "discourse.blocker",
      data: {
        blockerCode: "missing_discourse_rpc",
        description:
          "Gateway does not expose the discourse tree RPC yet in this environment.",
        severity: "medium",
        retryable: true,
      },
    },
    {
      id: `${rootTaskId}-resolution-1`,
      ts: baseTs + 71_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "method-man",
      sessionKey: "session-method-man-ui",
      runId: "task-run-1",
      type: "discourse.resolution",
      data: {
        originalBlockerEventId: blockerEventId,
        resolution:
          "Enabled adapter fallback path with mock discourse payload. UI renders correctly with mock data; will switch to live when RPC lands.",
        method: "workaround",
      },
    },
    {
      id: `${rootTaskId}-spawn-dedup-1`,
      ts: baseTs + 88_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "tonya",
      sessionKey: "session-tonya-main",
      runId: "task-run-1",
      type: "discourse.spawn.dedup",
      data: {
        targetAgentId: "method-man",
        existingChildSessionKey: "session-method-man-ui",
        ttlMs: 60_000,
      },
    },
    {
      id: `${rootTaskId}-delegation-2`,
      ts: baseTs + 95_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "bobby-digital",
      sessionKey: "session-bobby-main",
      runId: "task-run-1",
      type: "discourse.delegation",
      data: {
        targetAgentId: "ghostface",
        objective:
          "Write integration tests for discourse adapter normalization layer.",
        teamId: "execution-fleet",
        rationale:
          "Test coverage needed before shipping. Ghostface has normalization test patterns from cost adapter.",
      },
    },
    {
      id: `${rootTaskId}-status-ghost-started`,
      ts: baseTs + 100_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "ghostface",
      sessionKey: "session-ghost-test",
      runId: "task-run-1",
      type: "discourse.status",
      data: {
        prevState: "queued",
        nextState: "started",
        note: "Reviewing normalize.ts and mock data. Planning edge case coverage.",
      },
    },
    {
      id: `${rootTaskId}-completion-ghost`,
      ts: baseTs + 130_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "ghostface",
      sessionKey: "session-ghost-test",
      runId: "task-run-1",
      type: "discourse.completion",
      data: {
        outcome: "ok",
        resultSummary:
          "12 test cases covering all event types, malformed payloads, and empty snapshots. All passing.",
        tokensUsed: 6_240,
        costUsd: 0.09,
        durationMs: 30_000,
      },
    },
    {
      id: `${rootTaskId}-completion-1`,
      ts: baseTs + 153_000,
      taskId: rootTaskId,
      parentTaskId: rootTaskId,
      agentId: "method-man",
      sessionKey: "session-method-man-ui",
      runId: "task-run-1",
      type: "discourse.completion",
      data: {
        outcome: "ok",
        resultSummary:
          "Timeline and delegation tree shipped with live-refresh hooks. Chat layout with agent avatars, per-message cost, and conversation grouping.",
        tokensUsed: 12_480,
        costUsd: 0.19,
        durationMs: 128_000,
      },
    },
    {
      id: `${rootTaskId}-completion-bobby`,
      ts: baseTs + 158_000,
      taskId: rootTaskId,
      parentTaskId: null,
      agentId: "bobby-digital",
      sessionKey: "session-bobby-main",
      runId: "task-run-1",
      type: "discourse.completion",
      data: {
        outcome: "ok",
        resultSummary:
          "All delegated tracks complete. Frontend shipped, tests passing. Handing back to operator.",
        tokensUsed: 3_200,
        costUsd: 0.05,
        durationMs: 146_000,
      },
    },
    {
      id: `${rootTaskId}-status-1`,
      ts: baseTs + 161_000,
      taskId: rootTaskId,
      parentTaskId: null,
      agentId: "tonya",
      sessionKey: "session-tonya-main",
      runId: "task-run-1",
      type: "discourse.status",
      data: {
        prevState: "started",
        nextState: "completed",
        note: "All acceptance criteria met. 4 agents participated, 0 unresolved blockers.",
      },
    },
  ];

  return {
    rootTaskId,
    agents: [
      {
        agentId: "tonya",
        role: "primary-operator",
        eventCount: 4,
        tokensUsed: 4_320,
        costUsd: 0.07,
      },
      {
        agentId: "bobby-digital",
        role: "execution-lead",
        eventCount: 4,
        tokensUsed: 11_190,
        costUsd: 0.17,
      },
      {
        agentId: "method-man",
        role: "frontend-specialist",
        eventCount: 5,
        tokensUsed: 12_480,
        costUsd: 0.19,
      },
      {
        agentId: "ghostface",
        role: "test-engineer",
        eventCount: 2,
        tokensUsed: 6_240,
        costUsd: 0.09,
      },
    ],
    events,
    delegationTree: [
      {
        taskId: rootTaskId,
        agentId: "tonya",
        objective: "Route and monitor operator task execution",
        status: "completed",
        children: [
          {
            taskId: `${rootTaskId}/child-ui`,
            agentId: "bobby-digital",
            objective: "Lead implementation split and delegate frontend work.",
            status: "completed",
            children: [
              {
                taskId: `${rootTaskId}/child-ui/frontend`,
                agentId: "method-man",
                objective:
                  "Build discourse page, timeline, and filter interactions.",
                status: "completed",
                children: [],
                events: events.filter(
                  (event) => event.agentId === "method-man",
                ),
                cost: {
                  tokens: 12_480,
                  costUsd: 0.19,
                  durationMs: 128_000,
                },
              },
              {
                taskId: `${rootTaskId}/child-ui/tests`,
                agentId: "ghostface",
                objective:
                  "Integration tests for discourse adapter normalization.",
                status: "completed",
                children: [],
                events: events.filter((event) => event.agentId === "ghostface"),
                cost: {
                  tokens: 6_240,
                  costUsd: 0.09,
                  durationMs: 30_000,
                },
              },
            ],
            events: events.filter((event) => event.agentId === "bobby-digital"),
            cost: {
              tokens: 11_190,
              costUsd: 0.17,
              durationMs: 149_000,
            },
          },
        ],
        events: events.filter((event) => event.agentId === "tonya"),
        cost: {
          tokens: 4_320,
          costUsd: 0.07,
          durationMs: 161_000,
        },
      },
    ],
    summary: {
      totalAgents: 4,
      totalEvents: events.length,
      totalTokens: 34_230,
      totalCostUsd: 0.52,
      durationMs: 161_000,
      blockerCount: 1,
      decisionCount: 2,
      outcome: "success",
    },
  };
}
