import { describe, expect, it } from "vitest";
import { createCapabilityClient } from "../../../contracts/capability-client.js";
import { requireCompletedRun, requireCompletedStream } from "../../../core/runtime/run-results.js";
import type { RunStreamEvent } from "../../../core/runtime/run-stream.js";
import { mapOpenAIResponseToRunStatus } from "../../../providers/codex/response.js";
import { mapOpenAIResponseStreamEvent } from "../../../providers/codex/stream.js";
import { mapAnthropicStreamEvent } from "../../../providers/claude/stream.js";

const sse = (event: string, data: unknown) => ({ event, data: JSON.stringify(data) });

describe("structured execution failures", () => {
  it("retains observed Codex failure fields without copying arbitrary diagnostics", () => {
    const run = mapOpenAIResponseToRunStatus({ id: "run-1", status: "failed", error: {
      code: "server_error", type: "backend_error", message: "Private message", reason: "worker_unavailable",
      request: { authorization: "secret" }, retryable: true,
    } });
    expect(run).toEqual({ run_id: "run-1", status: "failed", error: "Private message",
      errorDetails: { providerCode: "server_error", providerType: "backend_error", reason: "worker_unavailable" },
    });
    let failure: unknown;
    try { requireCompletedRun(run); } catch (error) { failure = error; }
    expect(failure).toMatchObject({ code: "run_failed", cause: run });
    expect((failure as Error).cause).toBe(run);
  });

  it("retains an incomplete reason while preserving the existing failed lifecycle mapping", () => {
    const run = mapOpenAIResponseToRunStatus({ id: "run-1", status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
    expect(run).toEqual({ run_id: "run-1", status: "failed", error: "max_output_tokens",
      errorDetails: { reason: "max_output_tokens" },
    });
  });

  it.each([undefined, null, "Failure", {}, [], { code: 123, type: [], reason: {} }, { code: "", type: " ", reason: "" }])(
    "leaves details absent when the provider supplies no valid structured fields (%j)", (error) => {
      const run = mapOpenAIResponseToRunStatus({ id: "run-1", status: "failed", error });
      expect(run).not.toHaveProperty("errorDetails");
      expect(run.status).toBe("failed");
      expect(typeof run.error).toBe("string");
    },
  );

  it("keeps valid fields when another field is malformed", () => {
    expect(mapOpenAIResponseToRunStatus({ id: "run-1", status: "failed", error: {
      code: "server_error", type: 42, reason: " worker_unavailable ",
    } })).toMatchObject({ errorDetails: { providerCode: "server_error", reason: " worker_unavailable " } });
  });

  it.each(["completed", "running", "cancelled"])("does not attach failure details to a %s run", (status) => {
    const run = mapOpenAIResponseToRunStatus({ id: "run-1", status, error: { code: "server_error" } });
    expect(run).not.toHaveProperty("errorDetails");
    expect(run).not.toHaveProperty("error");
  });

  it.each([
    { event: "response.failed", data: { response: { error: { message: "Failed", code: "server_error" } } }, details: { providerCode: "server_error" }, message: "Failed" },
    { event: "response.incomplete", data: { response: { incomplete_details: { reason: "max_output_tokens" } } }, details: { reason: "max_output_tokens" }, message: "max_output_tokens" },
    { event: "error", data: { message: "Failed", code: "server_error" }, details: { providerCode: "server_error" }, message: "Failed" },
    { event: "error", data: { error: { message: "Failed", code: "server_error" } }, details: { providerCode: "server_error" }, message: "Failed" },
  ])("retains Codex $event details alongside the original error string", ({ event, data, details, message }) => {
    expect(mapOpenAIResponseStreamEvent(sse(event, data), "run-1")).toEqual({
      event: "run.failed", runId: "run-1", error: message, errorDetails: details,
    });
  });

  it("uses Claude's nested error type rather than the SSE envelope's type", () => {
    expect(mapAnthropicStreamEvent(sse("error", { type: "error", error: {
      type: "overloaded_error", message: "Overloaded", request: "secret",
    } }), "run-1")).toEqual({ event: "run.failed", runId: "run-1", error: "Overloaded",
      errorDetails: { providerType: "overloaded_error" },
    });
  });

  it("retains details in the facade outcome and typed error cause while forwarding the original event", async () => {
    const event = mapOpenAIResponseStreamEvent(sse("response.failed", {
      response: { error: { code: "server_error", message: "Failed" } },
    }), "run-1")!;
    let forwarded: RunStreamEvent | undefined;
    const client = createCapabilityClient({ providerKind: "fixture", fallbackSupports: { streaming: true }, runtime: {
      streamRun: async (_body, handlers) => { handlers.onEvent(event); },
    } });
    const result = await client.streamRun({ input: "hi" }, { onEvent: (value) => { forwarded = value; } });
    expect(result).toEqual({ ok: true, source: "live", data: {
      runId: "run-1", outcome: "failed", errorDetails: { providerCode: "server_error" },
    } });
    expect(forwarded).toBe(event);
    if (!result.ok) throw new Error("Expected a live stream result");
    expect(() => requireCompletedStream(result.data)).toThrowError(expect.objectContaining({
      code: "run_failed", cause: result.data,
    }));
    await client.dispose();
  });

  it.each(["run.completed", "run.cancelled"] as const)("clears stale details if the final event is %s", async (terminal) => {
    const failed = mapOpenAIResponseStreamEvent(sse("response.failed", {
      response: { error: { code: "server_error" } },
    }), "run-1")!;
    const client = createCapabilityClient({ providerKind: "fixture", fallbackSupports: { streaming: true }, runtime: {
      streamRun: async (_body, handlers) => {
        handlers.onEvent(failed);
        handlers.onEvent({ event: terminal, runId: "run-1" });
      },
    } });
    const result = await client.streamRun({ input: "hi" }, { onEvent: () => {} });
    expect(result).toEqual({ ok: true, source: "live", data: {
      runId: "run-1", outcome: terminal === "run.completed" ? "completed" : "cancelled",
    } });
    await client.dispose();
  });
});
