import { describe, expect, expectTypeOf, it } from "vitest";
import { ApiClientError, isApiClientError, serializeError } from "../../../core/errors.js";
import * as runtime from "../../../core/runtime/index.js";
import * as root from "../../../index.js";

describe("opt-in run result helpers", () => {
  it("returns the original completed run and narrows its status without losing extensions", () => {
    const run = Object.freeze({
      run_id: "complete-1", status: "completed" as string, output: "An answer",
      sessionKey: "session-1", tokens: { inputTokens: 3, outputTokens: 4 },
    });
    const completed = runtime.requireCompletedRun(run);
    expect(completed).toBe(run);
    expectTypeOf(completed.status).toEqualTypeOf<"completed">();
    expectTypeOf(completed.sessionKey).toEqualTypeOf<string>();
    expect(runtime.requireRunText(run)).toBe("An answer");
  });

  it.each([
    ["failed", "run_failed"],
    ["cancelled", "run_cancelled"],
    ["started", "run_incomplete"],
    ["running", "run_incomplete"],
    ["stopping", "run_incomplete"],
    ["dry_run", "run_incomplete"],
    ["provider-new-state", "run_incomplete"],
  ])("rejects %s with %s even when partial text is present", (status, code) => {
    const run = Object.freeze({ run_id: "incomplete-1", status, output: "Partial", error: "private details" });
    for (const helper of [runtime.requireCompletedRun, runtime.requireRunText]) {
      let error: unknown;
      try { helper(run); } catch (caught) { error = caught; }
      expect(isApiClientError(error)).toBe(true);
      expect(error).toMatchObject({ type: "run", code, cause: run });
      expect((error as ApiClientError).cause).toBe(run);
      expect(serializeError(error)).not.toHaveProperty("cause");
      expect(serializeError(error).message).not.toContain("private details");
    }
  });

  it.each([
    [{ output: "Primary", response: "Legacy" }, "Primary"],
    [{ response: "Legacy" }, "Legacy"],
    [{ output: "", response: "Legacy" }, ""],
    [{ response: "" }, ""],
    [{ output: "  " }, "  "],
  ])("preserves supplied text without trimming or replacing explicit empty output", (fields, text) => {
    expect(runtime.requireRunText({ run_id: "text-1", status: "completed", ...fields })).toBe(text);
  });

  it("accepts a completed tool-only run but rejects it when text is required", () => {
    const run = Object.freeze({ run_id: "tool-1", status: "completed", model: "fixture-model" });
    expect(runtime.requireCompletedRun(run)).toBe(run);
    expect(() => runtime.requireRunText(run)).toThrowError(expect.objectContaining({
      type: "run", code: "run_output_missing", cause: run,
    }));
  });

  it("returns the original completed stream while preserving diagnostics and nullable identity", () => {
    const stream = Object.freeze({ runId: null, outcome: "completed" as string | null, tokens: { totalTokens: 7 } });
    const completed = runtime.requireCompletedStream(stream);
    expect(completed).toBe(stream);
    expectTypeOf(completed.outcome).toEqualTypeOf<"completed">();
    expectTypeOf(completed.runId).toEqualTypeOf<null>();
    expectTypeOf(completed.tokens.totalTokens).toEqualTypeOf<number>();
  });

  it.each([
    ["failed", "run_failed"],
    ["cancelled", "run_cancelled"],
    [null, "run_incomplete"],
    ["unknown", "run_incomplete"],
  ])("rejects stream outcome %s with %s and retains the original diagnostics", (outcome, code) => {
    const transportError = new ApiClientError("private transport details", { code: "socket_closed" });
    const stream = Object.freeze({ runId: "stream-1", outcome, error: "private execution details", transportError });
    for (const helper of [runtime.requireCompletedStream, runtime.requireStreamText]) {
      let error: unknown;
      try { helper(stream); } catch (caught) { error = caught; }
      expect(isApiClientError(error)).toBe(true);
      expect(error).toMatchObject({ type: "run", code });
      expect((error as ApiClientError).cause).toBe(stream);
      expect(serializeError(error).message).not.toContain("private");
    }
  });

  it.each(["Terminal text", "", "  "])("preserves supplied completed stream output %j", (output) => {
    expect(runtime.requireStreamText({ runId: "stream-2", outcome: "completed", output })).toBe(output);
  });

  it("rejects completed streams without collected text while retaining nullable identity", () => {
    const stream = Object.freeze({ runId: null, outcome: "completed" });
    expect(() => runtime.requireStreamText(stream)).toThrowError(expect.objectContaining({
      type: "run", code: "run_output_missing", cause: stream,
    }));
  });

  it("offers the same helpers from the root and runtime subpath", () => {
    expect(root.requireCompletedRun).toBe(runtime.requireCompletedRun);
    expect(root.requireRunText).toBe(runtime.requireRunText);
    expect(root.requireCompletedStream).toBe(runtime.requireCompletedStream);
    expect(root.requireStreamText).toBe(runtime.requireStreamText);
    expect(root.requireCompletedRun).toBeTypeOf("function");
  });
});
