import { describe, expect, it, vi } from "vitest";
import { CodexApiClient } from "../../../providers/codex/client";
import { RUN_STREAM_EVENT_NAMES, type RunStreamEvent } from "../../../core/runtime/run-stream";

describe("CodexApiClient.streamRun — dryRun short-circuit (A3)", () => {
  it("dryRun:true makes zero network calls and emits one terminal dry_run event", async () => {
    const fetchImpl = vi.fn();
    const client = new CodexApiClient({ apiKey: "sk-test", fetchImpl: fetchImpl as unknown as typeof fetch });
    const events: RunStreamEvent[] = [];
    let completed = false;

    await client.streamRun(
      { input: "hi", model: "gpt-5-codex", dryRun: true },
      { onEvent: (e) => events.push(e), onComplete: () => { completed = true; } },
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, status: "dry_run" });
    expect(completed).toBe(true);
  });
});
