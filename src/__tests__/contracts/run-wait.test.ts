import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, type CapabilityResult, type RuntimeRunStatus } from "../../index.js";
import * as contracts from "../../contracts/index.js";
import * as root from "../../index.js";

const initial = Object.freeze({ run_id: "run-1", status: "running" });
const live = (run: RuntimeRunStatus): CapabilityResult<RuntimeRunStatus> => ({ ok: true, source: "live", data: run });

describe("waitForRun", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["completed", "failed", "cancelled"])("returns an observed %s run without retrieving it", async (status) => {
    const run = Object.freeze({ run_id: "run-1", status });
    const getRun = vi.fn();
    const result = await contracts.waitForRun({ getRun }, run);
    expect(result).toEqual({ reason: "terminal", run, polls: 0 });
    expect(result.run).toBe(run);
    expect(getRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["unknown", "provider-new-state", "dry_run"])("does not infer completion or poll forever for %s", async (status) => {
    const run = { run_id: "run-1", status };
    const getRun = vi.fn();
    expect(await contracts.waitForRun({ getRun }, run)).toEqual({ reason: "state-not-pollable", run, polls: 0 });
    expect(getRun).not.toHaveBeenCalled();
  });

  it("retrieves sequentially and returns the original terminal observation", async () => {
    const finished = Object.freeze({ run_id: "run-1", status: "completed", output: "Answer" });
    const getRun = vi.fn()
      .mockResolvedValueOnce(live({ run_id: "run-1", status: "stopping" }))
      .mockResolvedValueOnce(live(finished));
    const pending = contracts.waitForRun({ getRun }, initial, { pollIntervalMs: 10 });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toEqual({ reason: "terminal", run: finished, polls: 2 });
    expect((await pending).run).toBe(finished);
    expect(getRun.mock.calls).toEqual([["run-1"], ["run-1"]]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("returns the latest observation at the poll limit without cancelling or resubmitting", async () => {
    const latest = Object.freeze({ run_id: "run-1", status: "running", output: "Partial" });
    const client = { getRun: vi.fn().mockResolvedValue(live(latest)), cancelRun: vi.fn(), startRun: vi.fn(), dispose: vi.fn() };
    const pending = contracts.waitForRun(client, initial, { maxPolls: 2, pollIntervalMs: 10 });
    await vi.advanceTimersByTimeAsync(20);
    expect(await pending).toEqual({ reason: "poll-limit", run: latest, polls: 2 });
    expect((await pending).run).toBe(latest);
    expect(client.getRun).toHaveBeenCalledTimes(2);
    expect(client.cancelRun).not.toHaveBeenCalled();
    expect(client.startRun).not.toHaveBeenCalled();
    expect(client.dispose).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows a zero poll budget without a retrieval", async () => {
    const getRun = vi.fn();
    expect(await contracts.waitForRun({ getRun }, initial, { maxPolls: 0 })).toEqual({ reason: "poll-limit", run: initial, polls: 0 });
    expect(getRun).not.toHaveBeenCalled();
  });

  it("bounds the delay by a deadline shorter than the poll interval", async () => {
    const getRun = vi.fn();
    const pending = contracts.waitForRun({ getRun }, initial, { maxWaitMs: 5, pollIntervalMs: 10 });
    await vi.advanceTimersByTimeAsync(5);
    expect(await pending).toEqual({ reason: "timeout", run: initial, polls: 0 });
    expect(getRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds an in-flight retrieval and safely ignores its late rejection", async () => {
    let reject!: (error: unknown) => void;
    const getRun = vi.fn(() => new Promise<CapabilityResult<RuntimeRunStatus>>((_resolve, rejectRequest) => { reject = rejectRequest; }));
    const pending = contracts.waitForRun({ getRun }, initial, { maxWaitMs: 10, pollIntervalMs: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toEqual({ reason: "timeout", run: initial, polls: 1 });
    reject(new Error("Late transport rejection"));
    await vi.advanceTimersByTimeAsync(100);
    expect(getRun).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("retains the latest retrieved state when the following request times out", async () => {
    const latest = Object.freeze({ run_id: "run-1", status: "stopping" });
    const getRun = vi.fn().mockResolvedValueOnce(live(latest)).mockImplementationOnce(() => new Promise(() => {}));
    const pending = contracts.waitForRun({ getRun }, initial, { maxWaitMs: 10, pollIntervalMs: 1 });
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toEqual({ reason: "timeout", run: latest, polls: 2 });
    expect((await pending).run).toBe(latest);
  });

  it("returns immediately for an already-aborted caller without any retrieval", async () => {
    const getRun = vi.fn();
    expect(await contracts.waitForRun({ getRun }, initial, { signal: AbortSignal.abort() })).toEqual({ reason: "aborted", run: initial, polls: 0 });
    expect(getRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the polling delay when the caller aborts", async () => {
    const controller = new AbortController();
    const getRun = vi.fn();
    const pending = contracts.waitForRun({ getRun }, initial, { signal: controller.signal, pollIntervalMs: 10 });
    controller.abort();
    expect(await pending).toEqual({ reason: "aborted", run: initial, polls: 0 });
    await vi.advanceTimersByTimeAsync(100);
    expect(getRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ends an in-flight local wait without cancelling backend work or accepting a late result", async () => {
    const controller = new AbortController();
    let resolve!: (result: CapabilityResult<RuntimeRunStatus>) => void;
    const client = { getRun: vi.fn(() => new Promise<CapabilityResult<RuntimeRunStatus>>((complete) => { resolve = complete; })), cancelRun: vi.fn() };
    const pending = contracts.waitForRun(client, initial, { signal: controller.signal, pollIntervalMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    expect(await pending).toEqual({ reason: "aborted", run: initial, polls: 1 });
    resolve(live({ run_id: "run-1", status: "completed", output: "Late" }));
    await vi.advanceTimersByTimeAsync(100);
    expect(client.getRun).toHaveBeenCalledTimes(1);
    expect(client.cancelRun).not.toHaveBeenCalled();
    expect((await pending).run).toBe(initial);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles caller abort inside a retrieval that subsequently rejects", async () => {
    const controller = new AbortController();
    const getRun = vi.fn(() => { controller.abort(); return Promise.reject(new Error("Late rejection")); });
    const pending = contracts.waitForRun({ getRun }, initial, { signal: controller.signal, pollIntervalMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ reason: "aborted", run: initial, polls: 1 });
    await vi.advanceTimersByTimeAsync(0);
  });

  it("preserves a retrieval gap and the last observed run", async () => {
    const gap = { area: "runtime", expectedContract: "getRun", note: "Unavailable", reason: "backend-unavailable" as const };
    const getRun = vi.fn().mockResolvedValue({ ok: false, data: null, gap });
    const pending = contracts.waitForRun({ getRun }, initial, { pollIntervalMs: 1 });
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toEqual({ reason: "gap", run: initial, polls: 1, gap });
    const result = await pending;
    if (result.reason !== "gap") throw new Error("Expected a retrieval gap");
    expect(result.gap).toBe(gap);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    new ApiClientError("Auth", { type: "auth", code: "auth_required" }),
    new Error("Unknown failure"),
  ])("propagates client exceptions unchanged and cleans up the local wait", async (error) => {
    const getRun = vi.fn().mockRejectedValue(error);
    const pending = contracts.waitForRun({ getRun }, initial, { pollIntervalMs: 1 });
    const assertion = expect(pending).rejects.toBe(error);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { maxPolls: -1 }, { maxPolls: 1.5 }, { maxPolls: Infinity }, { maxPolls: Number.MAX_SAFE_INTEGER + 1 },
    { pollIntervalMs: -1 }, { pollIntervalMs: NaN }, { pollIntervalMs: 2 ** 31 },
    { maxWaitMs: -1 }, { maxWaitMs: Infinity }, { maxWaitMs: 2 ** 31 },
  ])("rejects invalid budgets before retrieving (%j)", async (options) => {
    const getRun = vi.fn();
    await expect(contracts.waitForRun({ getRun }, initial, options)).rejects.toMatchObject({ type: "validation", code: "invalid_request" });
    expect(getRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("allows a zero time budget and zero interval without retrieving", async () => {
    const getRun = vi.fn();
    expect(await contracts.waitForRun({ getRun }, initial, { maxWaitMs: 0, pollIntervalMs: 0 })).toEqual({ reason: "timeout", run: initial, polls: 0 });
    expect(getRun).not.toHaveBeenCalled();
  });

  it("exports the same helper from the root and contracts subpath", () => {
    expect(root.waitForRun).toBe(contracts.waitForRun);
    expect(root.waitForRun).toBeTypeOf("function");
  });
});
