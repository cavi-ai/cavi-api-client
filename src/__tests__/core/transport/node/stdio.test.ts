import { describe, expect, it, vi } from "vitest";
import {
  createStdioTransport,
  type StdioChildLike,
} from "../../../../core/transport/node/index.js";
import { getTransportErrorMetadata } from "../../../../core/transport/error.js";

function fakeChild() {
  const events = new Map<string, Array<(...args: unknown[]) => void>>();
  const streamEvents = new Map<string, Array<(chunk: Uint8Array) => void>>();
  const stdinEvents = new Map<string, Array<() => void>>();
  const write = vi.fn(() => true);
  const end = vi.fn();
  const kill = vi.fn(() => true);
  const process: StdioChildLike = {
    stdin: {
      write,
      end,
      once: (event, listener) => {
        stdinEvents.set(event, [...(stdinEvents.get(event) ?? []), listener]);
      },
    },
    stdout: {
      on: (event, listener) => {
        streamEvents.set(`stdout:${event}`, [...(streamEvents.get(`stdout:${event}`) ?? []), listener]);
      },
    },
    stderr: {
      on: (event, listener) => {
        streamEvents.set(`stderr:${event}`, [...(streamEvents.get(`stderr:${event}`) ?? []), listener]);
      },
    },
    once: (event, listener) => events.set(event, [...(events.get(event) ?? []), listener]),
    kill,
  };
  return {
    process, write, end, kill,
    emit: (event: "error" | "exit", ...args: unknown[]) => events.get(event)?.forEach((fn) => fn(...args)),
    stdout: (chunk: Uint8Array) => streamEvents.get("stdout:data")?.forEach((fn) => fn(chunk)),
    stderr: (chunk: Uint8Array) => streamEvents.get("stderr:data")?.forEach((fn) => fn(chunk)),
    drain: () => stdinEvents.get("drain")?.forEach((fn) => fn()),
  };
}

function trackedAbortSignal() {
  const listeners = new Set<() => void>();
  let aborted = false;
  const signal = {
    get aborted() { return aborted; },
    get reason() { return aborted ? new Error("later abort") : undefined; },
    addEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      listeners.add(typeof listener === "function" ? listener as () => void : () => listener.handleEvent(new Event("abort")));
    }),
    removeEventListener: vi.fn((_event: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener === "function") listeners.delete(listener as () => void);
    }),
  } as unknown as AbortSignal;
  return {
    signal,
    active: () => listeners.size,
    abort: () => {
      aborted = true;
      for (const listener of [...listeners]) listener();
    },
  };
}

describe("Node stdio transport", () => {
  it("validates before spawning", () => {
    const spawnImpl = vi.fn();
    expect(() => createStdioTransport({ command: "  ", spawnImpl })).toThrow(/command/u);
    expect(() => createStdioTransport({ command: "codex", args: ["ok", ""], spawnImpl })).toThrow(/args/u);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("delivers stdout chunks and applies the selected stderr policy", () => {
    const child = fakeChild();
    const stderr = vi.fn();
    const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process, stderr });
    const received: Uint8Array[] = [];
    channel.subscribe((chunk) => received.push(chunk));
    child.stdout(Uint8Array.of(1, 2));
    child.stdout(Uint8Array.of(3));
    child.stderr(Uint8Array.of(9));
    expect(received).toEqual([Uint8Array.of(1, 2), Uint8Array.of(3)]);
    expect(stderr).toHaveBeenCalledWith(Uint8Array.of(9));
  });

  it("waits for stdin drain and rejects an aborted write", async () => {
    const child = fakeChild();
    child.write.mockReturnValueOnce(false);
    const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process });
    let settled = false;
    const writing = channel.write(Uint8Array.of(1)).then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);
    child.drain();
    await writing;
    const controller = new AbortController();
    controller.abort();
    await expect(channel.write(Uint8Array.of(2), controller.signal)).rejects.toMatchObject({ code: "aborted" });
  });

  it("normalizes spawn and nonzero-exit failures without stderr text", async () => {
    let spawnError: unknown;
    try {
      createStdioTransport({
        command: "codex",
        spawnImpl: () => { throw new Error("token=top-secret"); },
      });
    } catch (error) {
      spawnError = error;
    }
    expect(spawnError).toMatchObject({ message: "stdio process spawn failed" });
    expect((spawnError as { cause?: unknown }).cause).toBeUndefined();
    expect(JSON.stringify(spawnError)).not.toContain("top-secret");

    const child = fakeChild();
    const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process });
    child.stderr(new TextEncoder().encode("token=top-secret"));
    child.emit("exit", 7, null);
    const error = await channel.closed.catch((value) => value);
    expect(String(error)).not.toContain("top-secret");
    expect(getTransportErrorMetadata(error)).toMatchObject({ kind: "stdio", phase: "close", code: 7 });
  });

  it("rejects backpressure when exit occurs synchronously inside stdin.write", async () => {
    const child = fakeChild();
    child.write.mockImplementationOnce(() => {
      child.emit("exit", 1, null);
      return false;
    });
    const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process });
    await expect(channel.write(Uint8Array.of(1))).rejects.toThrow(/closed|exited/iu);
  });

  it.each(["exit", "close"] as const)(
    "removes a pending write abort listener before terminal %s settlement",
    async (terminal) => {
      const child = fakeChild();
      const tracked = trackedAbortSignal();
      child.write.mockReturnValueOnce(false);
      const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process });
      let settlements = 0;
      const writing = channel.write(Uint8Array.of(1), tracked.signal).catch((error) => {
        settlements += 1;
        throw error;
      });
      expect(tracked.active()).toBe(1);
      if (terminal === "exit") child.emit("exit", 1, null);
      else await channel.close();
      await expect(writing).rejects.toThrow(/closed|exited/iu);
      expect(tracked.active()).toBe(0);
      tracked.abort();
      await Promise.resolve();
      expect(settlements).toBe(1);
    },
  );

  it("ends and terminates an owned child exactly once on abort or close", async () => {
    const child = fakeChild();
    const controller = new AbortController();
    const channel = createStdioTransport({
      command: "codex", spawnImpl: () => child.process, signal: controller.signal,
    });
    controller.abort();
    await channel.closed;
    await channel.close();
    controller.abort();
    expect(child.end).toHaveBeenCalledTimes(1);
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
