import { describe, expect, it, vi } from "vitest";
import { ApiClientErrorCode, ApiClientErrorType } from "../../../core/errors.js";
import {
  TransportError,
  abortableSleep,
  computeBackoffDelay,
  createTransportLifecycle,
  runTransportAttempts,
} from "../../../core/transport/index.js";

describe("transport lifecycle", () => {
  it("retries only eligible failures and emits safe events", async () => {
    const events: unknown[] = [];
    const sleep = vi.fn(async () => undefined);
    let attempt = 0;
    const result = await runTransportAttempts({
      kind: "http",
      operation: "models.list",
      policy: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 10, jitterRatio: 0 },
      dependencies: { now: () => 0, random: () => 0.5, sleep },
      lifecycle: createTransportLifecycle((event) => events.push(event)),
      execute: async () => {
        attempt += 1;
        if (attempt === 1) throw new TransportError("temporary", {
          metadata: { kind: "http", phase: "request", operation: "models.list", retryable: true, attempt },
        });
        return "ok";
      },
    });
    expect(result).toBe("ok");
    expect(sleep).toHaveBeenCalledWith(10, undefined);
    expect(events).toMatchObject([{ state: "retrying", attempt: 1, delayMs: 10 }]);
    expect(JSON.stringify(events)).not.toContain("token");
  });

  it("does not retry ineligible failures", async () => {
    const execute = vi.fn(async () => { throw new TransportError("fatal", {
      metadata: { kind: "stdio", phase: "decode", operation: "read", retryable: false, attempt: 1 },
    }); });
    await expect(runTransportAttempts({
      kind: "stdio", operation: "read",
      policy: { maxAttempts: 3, baseDelayMs: 1, maxDelayMs: 2 },
      execute,
    })).rejects.toThrow("fatal");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("validates policy values and clamps retry-after delays", () => {
    expect(() => computeBackoffDelay({ maxAttempts: 0, baseDelayMs: 1, maxDelayMs: 1 }, 1, 0.5)).toThrow();
    expect(() => computeBackoffDelay({ maxAttempts: 1, baseDelayMs: -1, maxDelayMs: 1 }, 1, 0.5)).toThrow();
    expect(() => computeBackoffDelay({ maxAttempts: 1, baseDelayMs: 2, maxDelayMs: 1 }, 1, 0.5)).toThrow();
    expect(() => computeBackoffDelay({ maxAttempts: 1, baseDelayMs: 1, maxDelayMs: 1, jitterRatio: 2 }, 1, 0.5)).toThrow();
    expect(computeBackoffDelay({ maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 50 }, 1, 0.5, 1_000)).toBe(50);
  });

  it("stops when the next wait would exhaust the deadline", async () => {
    const sleep = vi.fn(async () => undefined);
    const error = new TransportError("temporary", {
      metadata: { kind: "http", phase: "request", operation: "x", retryable: true, attempt: 1 },
    });
    await expect(runTransportAttempts({
      kind: "http", operation: "x",
      policy: { maxAttempts: 2, baseDelayMs: 10, maxDelayMs: 10, deadlineMs: 9 },
      dependencies: { now: () => 0, random: () => 0.5, sleep },
      execute: async () => { throw error; },
    })).rejects.toBe(error);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("normalizes abort during wait and never starts another attempt", async () => {
    const controller = new AbortController();
    const execute = vi.fn(async () => {
      controller.abort();
      throw new TransportError("temporary", {
        metadata: { kind: "http", phase: "request", operation: "x", retryable: true, attempt: 1 },
      });
    });
    await expect(runTransportAttempts({
      kind: "http", operation: "x", signal: controller.signal,
      policy: { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 }, execute,
    })).rejects.toMatchObject({ type: ApiClientErrorType.Abort, code: ApiClientErrorCode.Aborted });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("supports abortable sleep", async () => {
    const controller = new AbortController();
    const pending = abortableSleep(10_000, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ type: ApiClientErrorType.Abort, code: ApiClientErrorCode.Aborted });
  });

  it("refreshes auth for every attempt", async () => {
    const resolver = vi.fn()
      .mockResolvedValueOnce({ headers: { Authorization: "one" } })
      .mockResolvedValueOnce({ headers: { Authorization: "two" } });
    const seen: string[] = [];
    await runTransportAttempts({
      kind: "http", operation: "x", auth: resolver,
      policy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
      execute: async ({ attempt, headers }) => {
        seen.push(headers.Authorization);
        if (attempt === 1) throw new TransportError("temporary", {
          metadata: { kind: "http", phase: "authenticate", operation: "x", retryable: true, attempt },
        });
        return "ok";
      },
    });
    expect(seen).toEqual(["one", "two"]);
  });

  it("unsubscribes lifecycle listeners", () => {
    const first = vi.fn();
    const second = vi.fn();
    const lifecycle = createTransportLifecycle(first);
    const unsubscribe = lifecycle.subscribe(second);
    unsubscribe();
    lifecycle.emit({ state: "closed", kind: "websocket", operation: "chat", attempt: 1 });
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });
});
