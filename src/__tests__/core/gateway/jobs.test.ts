import { describe, expect, it } from "vitest";
import {
  GatewayJobAbortError,
  GatewayJobTimeoutError,
  isGatewayJobSuccessfulStatus,
  isGatewayJobTerminalStatus,
  waitForGatewayJob,
} from "../../../core/gateway/jobs";

describe("gateway job lifecycle helpers", () => {
  it("polls until a terminal status and reports updates", async () => {
    let calls = 0;
    const updates: string[] = [];

    const job = await waitForGatewayJob({
      intervalMs: 1,
      fetchJob: async () => {
        calls += 1;
        return {
          id: "job_1",
          status: calls === 1 ? "running" : "completed",
        };
      },
      sleep: async () => undefined,
      onUpdate: ({ job: update }) => updates.push(String(update.status)),
    });

    expect(job).toEqual({ id: "job_1", status: "completed" });
    expect(calls).toBe(2);
    expect(updates).toEqual(["running", "completed"]);
  });

  it("times out after the configured attempt budget", async () => {
    await expect(
      waitForGatewayJob({
        intervalMs: 1,
        maxAttempts: 2,
        fetchJob: async () => ({ status: "running" }),
        sleep: async () => undefined,
      }),
    ).rejects.toMatchObject({
      name: "GatewayJobTimeoutError",
      attempts: 2,
      lastJob: { status: "running" },
    } satisfies Partial<GatewayJobTimeoutError<{ status: string }>>);
  });

  it("honors abort signals before polling", async () => {
    const controller = new AbortController();
    controller.abort("stop");

    await expect(
      waitForGatewayJob({
        fetchJob: async () => ({ status: "running" }),
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: "GatewayJobAbortError",
      reason: "stop",
    } satisfies Partial<GatewayJobAbortError>);
  });

  it("normalizes success and terminal statuses", () => {
    expect(isGatewayJobSuccessfulStatus("succeeded")).toBe(true);
    expect(isGatewayJobSuccessfulStatus("failed")).toBe(false);
    expect(isGatewayJobTerminalStatus("cancelled")).toBe(true);
    expect(isGatewayJobTerminalStatus("running")).toBe(false);
  });
});
