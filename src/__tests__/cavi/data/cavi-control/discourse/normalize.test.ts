import { describe, expect, it } from "vitest";
import {
  normalizeDiscourseEvent,
  normalizeTaskDiscourseSnapshot,
} from "../../../../../cavi/data/cavi-control/discourse/normalize";

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
});
