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
    expect(() => createStdioTransport({
      command: "codex",
      spawnImpl: () => { throw new Error("token=top-secret"); },
    })).toThrow(/stdio process spawn failed/iu);

    const child = fakeChild();
    const channel = createStdioTransport({ command: "codex", spawnImpl: () => child.process });
    child.stderr(new TextEncoder().encode("token=top-secret"));
    child.emit("exit", 7, null);
    const error = await channel.closed.catch((value) => value);
    expect(String(error)).not.toContain("top-secret");
    expect(getTransportErrorMetadata(error)).toMatchObject({ kind: "stdio", phase: "close", code: 7 });
  });

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
