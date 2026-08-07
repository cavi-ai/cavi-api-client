import { describe, expect, it } from "vitest";
import {
  normalizeDiscourseEvent,
  normalizeTaskDiscourseSnapshot,
} from "../../../../extensions/cavi/discourse/normalize";

describe("normalizeDiscourseEvent", () => {
  it("unwraps stringified JSON data payloads", () => {
    const raw = {
      id: "e1",
      ts: 1,
      type: "discourse.dispatch",
      taskId: "t1",
      parentTaskId: null,
      agentId: "a1",
      sessionKey: "s1",
      runId: "r1",
      data: JSON.stringify({
        targetAgentId: "bob",
        objective: "Do the thing",
        tier: "CONTRACT_SMALL",
        packetType: "martina_run_request",
      }),
    };
    const event = normalizeDiscourseEvent(raw, "t1");
    expect(event).not.toBeNull();
    expect(event?.type).toBe("discourse.dispatch");
    if (event?.type === "discourse.dispatch") {
      expect(event.data.objective).toBe("Do the thing");
      expect(event.data.tier).toBe("CONTRACT_SMALL");
      expect(event.data.packetType).toBe("martina_run_request");
    }
  });

  it("coerces nested objective objects into text", () => {
    const raw = {
      id: "e1",
      ts: 1,
      type: "discourse.dispatch",
      taskId: "t1",
      parentTaskId: null,
      agentId: "a1",
      sessionKey: "s1",
      runId: "r1",
      data: {
        targetAgentId: "bob",
        objective: { message: "Nested hello" },
        tier: "STANDARD",
        packetType: "L1_TASK_V1",
      },
    };
    const event = normalizeDiscourseEvent(raw, "t1");
    expect(event?.type).toBe("discourse.dispatch");
    if (event?.type === "discourse.dispatch") {
      expect(event.data.objective).toBe("Nested hello");
    }
  });

  it("rejects a standalone event whose nested list exceeds the work ceiling", () => {
    expect(() =>
      normalizeDiscourseEvent(
        {
          type: "discourse.dispatch",
          data: {
            alternativesConsidered: Array.from(
              { length: 10_001 },
              () => "alternative",
            ),
          },
        },
        "t1",
      ),
    ).toThrow(/exceeds maximum normalization work/u);
  });

  it("preserves ordinary nested alternative lists", () => {
    const dispatch = normalizeDiscourseEvent(
      {
        type: "discourse.dispatch",
        data: { alternativesConsidered: [" first ", null, "second"] },
      },
      "t1",
    );
    expect(dispatch?.type).toBe("discourse.dispatch");
    if (dispatch?.type === "discourse.dispatch") {
      expect(dispatch.data.alternativesConsidered).toEqual([
        "first",
        "second",
      ]);
    }

    const decision = normalizeDiscourseEvent(
      {
        type: "discourse.decision",
        data: {
          alternatives: [
            { approach: "one", reasonRejected: "too slow" },
            { approach: "two", reasonRejected: "too costly" },
          ],
        },
      },
      "t1",
    );
    expect(decision?.type).toBe("discourse.decision");
    if (decision?.type === "discourse.decision") {
      expect(decision.data.alternatives).toEqual([
        { approach: "one", reasonRejected: "too slow" },
        { approach: "two", reasonRejected: "too costly" },
      ]);
    }
  });
});

describe("normalizeTaskDiscourseSnapshot", () => {
  it("normalizes events with string data in snapshot", () => {
    const snapshot = normalizeTaskDiscourseSnapshot(
      {
        rootTaskId: "t1",
        events: [
          {
            id: "e1",
            ts: 1,
            type: "discourse.delegation",
            taskId: "t1",
            parentTaskId: null,
            agentId: "a1",
            sessionKey: "s1",
            runId: "r1",
            data: JSON.stringify({
              targetAgentId: "bob",
              objective: "Hello delegation",
            }),
          },
        ],
        agents: [],
        delegationTree: [],
      },
      "t1",
    );
    expect(snapshot.events).toHaveLength(1);
    const first = snapshot.events[0]!;
    expect(first.type).toBe("discourse.delegation");
    if (first.type === "discourse.delegation") {
      expect(first.data.objective).toBe("Hello delegation");
    }
  });

  it("rejects delegation trees deeper than the normalization ceiling", () => {
    const root: Record<string, unknown> = {
      taskId: "root",
      children: [],
      events: [],
    };
    let cursor = root;
    for (let depth = 1; depth < 65; depth += 1) {
      const child: Record<string, unknown> = {
        taskId: `task-${depth}`,
        children: [],
        events: [],
      };
      cursor.children = [child];
      cursor = child;
    }

    expect(() =>
      normalizeTaskDiscourseSnapshot(
        {
          rootTaskId: "root",
          events: [],
          agents: [],
          delegationTree: [root],
        },
        "root",
      ),
    ).toThrow(/delegation tree exceeds maximum depth/u);
  });

  it("rejects delegation trees that exceed the node-processing ceiling", () => {
    const nodes = Array.from({ length: 10_001 }, (_, index) => ({
      taskId: `task-${index}`,
      children: [],
      events: [],
    }));

    expect(() =>
      normalizeTaskDiscourseSnapshot(
        {
          rootTaskId: "root",
          events: [],
          agents: [],
          delegationTree: nodes,
        },
        "root",
      ),
    ).toThrow(/delegation tree exceeds maximum node count/u);
  });

  it("rejects snapshots that exceed the event-processing ceiling", () => {
    expect(() =>
      normalizeTaskDiscourseSnapshot(
        {
          rootTaskId: "root",
          events: Array.from({ length: 10_001 }, () => null),
          agents: [],
          delegationTree: [],
        },
        "root",
      ),
    ).toThrow(/exceeds maximum event count/u);
  });

  it("rejects snapshots that exceed the agent-processing ceiling", () => {
    expect(() =>
      normalizeTaskDiscourseSnapshot(
        {
          rootTaskId: "root",
          events: [],
          agents: Array.from({ length: 10_001 }, (_, index) => ({
            agentId: `agent-${index}`,
          })),
          delegationTree: [],
        },
        "root",
      ),
    ).toThrow(/exceeds maximum normalization work/u);
  });

  it("applies one cumulative work budget across mixed nested lists", () => {
    expect(() =>
      normalizeTaskDiscourseSnapshot(
        {
          rootTaskId: "root",
          events: [
            {
              type: "discourse.decision",
              data: {
                alternatives: Array.from({ length: 5_000 }, () => ({
                  approach: "alternative",
                  reasonRejected: "not selected",
                })),
              },
            },
          ],
          agents: Array.from({ length: 5_000 }, (_, index) => ({
            agentId: `agent-${index}`,
          })),
          delegationTree: [],
        },
        "root",
      ),
    ).toThrow(/exceeds maximum normalization work/u);
  });
});
