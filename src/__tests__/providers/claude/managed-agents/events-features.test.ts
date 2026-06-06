import { describe, expect, it } from "vitest";
import {
  isOutcomeEndEvent,
  isThreadEvent,
  isTerminalSessionEvent,
  parseSessionEvent,
} from "../../../../providers/claude/managed-agents/events";

// Frames mirror a live multiagent + outcome session (2026-06-06).
describe("parseSessionEvent — outcomes", () => {
  it("parses span.outcome_evaluation_start/_end", () => {
    expect(parseSessionEvent({ type: "span.outcome_evaluation_start", id: "sevt_a", iteration: 0, outcome_id: "outc_1" })).toEqual({
      kind: "outcome_start",
      id: "sevt_a",
      outcomeId: "outc_1",
      iteration: 0,
    });
    const end = parseSessionEvent({
      type: "span.outcome_evaluation_end",
      id: "sevt_b",
      iteration: 0,
      outcome_id: "outc_1",
      result: "satisfied",
      explanation: "all criteria met",
    })!;
    expect(end).toMatchObject({ kind: "outcome_end", outcomeId: "outc_1", result: "satisfied", explanation: "all criteria met" });
    expect(isOutcomeEndEvent(end)).toBe(true);
    expect(isTerminalSessionEvent(end)).toBe(false); // outcome end is not session-terminal
  });
});

describe("parseSessionEvent — multiagent threads", () => {
  it("parses thread_created with thread id + agent name", () => {
    const ev = parseSessionEvent({ type: "session.thread_created", id: "sevt_c", session_thread_id: "sthr_1", agent_name: "reviewer" })!;
    expect(ev).toEqual({ kind: "thread_created", id: "sevt_c", threadId: "sthr_1", agentName: "reviewer" });
    expect(isThreadEvent(ev)).toBe(true);
  });

  it("parses thread_status_idle (NOT session-terminal)", () => {
    const ev = parseSessionEvent({ type: "session.thread_status_idle", id: "sevt_d", session_thread_id: "sthr_0", agent_name: "coordinator", stop_reason: { type: "end_turn" } })!;
    expect(ev).toMatchObject({ kind: "thread_status", status: "idle", threadId: "sthr_0", agentName: "coordinator" });
    expect(isTerminalSessionEvent(ev)).toBe(false);
  });

  it("parses cross-thread messages with direction + correspondent", () => {
    expect(parseSessionEvent({ type: "agent.thread_message_sent", id: "sevt_e", to_session_thread_id: "sthr_1", to_agent_name: "reviewer", content: [{ type: "text", text: "review this" }] })).toEqual({
      kind: "thread_message",
      id: "sevt_e",
      direction: "sent",
      threadId: "sthr_1",
      agentName: "reviewer",
      text: "review this",
    });
    expect(parseSessionEvent({ type: "agent.thread_message_received", id: "sevt_f", from_session_thread_id: "sthr_1", from_agent_name: "reviewer", content: [{ type: "text", text: "APPROVED" }] })).toMatchObject({
      kind: "thread_message",
      direction: "received",
      agentName: "reviewer",
      text: "APPROVED",
    });
  });

  it("carries session_thread_id on a cross-posted tool_use (for the confirmation echo)", () => {
    const ev = parseSessionEvent({ type: "agent.tool_use", id: "sevt_g", name: "bash", input: {}, evaluated_permission: "ask", session_thread_id: "sthr_2" });
    expect(ev).toMatchObject({ kind: "tool_use", sessionThreadId: "sthr_2" });
  });
});
