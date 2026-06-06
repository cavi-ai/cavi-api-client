import { describe, expect, it } from "vitest";
import {
  isCustomToolUseEvent,
  isTerminalSessionEvent,
  parseSessionEvent,
  parseSessionEventData,
  sessionEventNeedsConfirmation,
} from "../../../../providers/claude/managed-agents/events";

// Frames below mirror what a live session actually emitted (2026-06-06).
describe("parseSessionEvent", () => {
  it("parses agent.tool_use with evaluated_permission and flags it for confirmation", () => {
    const ev = parseSessionEvent({
      type: "agent.tool_use",
      id: "sevt_01K3jF",
      name: "bash",
      input: { command: "echo hello" },
      evaluated_permission: "ask",
    });
    expect(ev).toEqual({
      kind: "tool_use",
      id: "sevt_01K3jF",
      name: "bash",
      input: { command: "echo hello" },
      evaluatedPermission: "ask",
      source: "agent",
    });
    expect(sessionEventNeedsConfirmation(ev!)).toBe(true);
  });

  it("parses agent.custom_tool_use (no permission, needs a result)", () => {
    const ev = parseSessionEvent({
      type: "agent.custom_tool_use",
      id: "sevt_01DxEB",
      name: "get_secret_number",
      input: { hint: "" },
    });
    expect(ev).toEqual({
      kind: "custom_tool_use",
      id: "sevt_01DxEB",
      name: "get_secret_number",
      input: { hint: "" },
    });
    expect(isCustomToolUseEvent(ev!)).toBe(true);
    expect(sessionEventNeedsConfirmation(ev!)).toBe(false);
  });

  it("parses agent.message text", () => {
    const ev = parseSessionEvent({ type: "agent.message", id: "sevt_m", content: [{ type: "text", text: "hi" }] });
    expect(ev).toEqual({ kind: "message", id: "sevt_m", text: "hi" });
  });

  it("classifies idle terminality by stop_reason", () => {
    const end = parseSessionEvent({ type: "session.status_idle", stop_reason: { type: "end_turn" } })!;
    const wait = parseSessionEvent({ type: "session.status_idle", stop_reason: { type: "requires_action" } })!;
    expect(end.kind).toBe("status");
    expect(isTerminalSessionEvent(end)).toBe(true);
    expect(isTerminalSessionEvent(wait)).toBe(false); // transient — waiting on a tool answer
  });

  it("treats terminated as terminal and running as not", () => {
    expect(isTerminalSessionEvent(parseSessionEvent({ type: "session.status_terminated" })!)).toBe(true);
    expect(isTerminalSessionEvent(parseSessionEvent({ type: "session.status_running" })!)).toBe(false);
  });

  it("parses tool_result error and session.error", () => {
    expect(parseSessionEvent({ type: "agent.tool_result", id: "sevt_r", is_error: true })).toMatchObject({
      kind: "tool_result",
      isError: true,
      source: "agent",
    });
    expect(parseSessionEvent({ type: "session.error", error: { message: "boom" } })).toMatchObject({
      kind: "error",
      message: "boom",
    });
  });

  it("maps echoed user.* events and spans to 'other' (not message)", () => {
    expect(parseSessionEvent({ type: "user.message", id: "sevt_u" })).toEqual({ kind: "other", id: "sevt_u", type: "user.message" });
    expect(parseSessionEvent({ type: "span.model_request_end" })).toEqual({ kind: "other", type: "span.model_request_end" });
  });

  it("parseSessionEventData parses an SSE frame; bad json -> null", () => {
    expect(parseSessionEventData({ data: '{"type":"agent.message","content":[{"type":"text","text":"x"}]}' })).toMatchObject({ kind: "message", text: "x" });
    expect(parseSessionEventData({ data: "not json" })).toBeNull();
    expect(parseSessionEvent(null)).toBeNull();
  });
});
