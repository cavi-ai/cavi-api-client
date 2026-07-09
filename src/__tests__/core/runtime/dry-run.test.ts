import { describe, expect, it } from "vitest";
import { buildDryRunStatus, buildDryRunStreamEvent } from "../../../core/runtime/dry-run";
import { RUN_STREAM_EVENT_NAMES } from "../../../core/runtime/run-stream";

describe("buildDryRunStatus / buildDryRunStreamEvent (A3)", () => {
  it("builds a dry_run status with a synthesized run_id and no tokens/output", () => {
    const status = buildDryRunStatus("claude-opus-4-8");
    expect(status.status).toBe("dry_run");
    expect(status.model).toBe("claude-opus-4-8");
    expect(status.run_id).toMatch(/^dryrun-/);
    expect(status.tokens).toBeUndefined();
    expect(status.output).toBeUndefined();
  });

  it("omits model when none is resolved", () => {
    expect(buildDryRunStatus().model).toBeUndefined();
  });

  it("two calls synthesize distinct run_ids", () => {
    expect(buildDryRunStatus().run_id).not.toBe(buildDryRunStatus().run_id);
  });

  it("builds a single terminal dry_run stream event", () => {
    const event = buildDryRunStreamEvent("gpt-5-codex");
    expect(event.event).toBe(RUN_STREAM_EVENT_NAMES.RUN_COMPLETED);
    expect(event.status).toBe("dry_run");
    expect(event.runId).toMatch(/^dryrun-/);
    expect(event.usage).toBeUndefined();
    expect(event.output).toBeUndefined();
  });
});
