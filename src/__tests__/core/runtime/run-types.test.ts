import { describe, expect, it } from "vitest";
import {
  isRuntimeRunStartBody,
  type RuntimeRunStartBody,
  type RuntimeRunStatus,
} from "../../../core/runtime/run";

describe("runtime run types", () => {
  it("accepts a minimal claude-shaped run body (no gateway fields)", () => {
    const body: RuntimeRunStartBody = {
      input: [{ role: "user", content: "hi" }],
      instructions: "You are helpful",
      model: "claude-opus-4-8",
      tools: [],
    };
    expect(isRuntimeRunStartBody(body)).toBe(true);
  });

  it("accepts a string input", () => {
    expect(isRuntimeRunStartBody({ input: "hello" })).toBe(true);
  });

  it("rejects a non-object / missing input", () => {
    expect(isRuntimeRunStartBody(null)).toBe(false);
    expect(isRuntimeRunStartBody({})).toBe(false);
  });

  it("represents a minimal run status", () => {
    const status: RuntimeRunStatus = {
      run_id: "msg_123",
      status: "completed",
      output: "hello",
      usage: { input_tokens: 4, output_tokens: 2 },
    };
    expect(status.run_id).toBe("msg_123");
  });
});
