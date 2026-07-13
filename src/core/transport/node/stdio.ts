import { spawn } from "node:child_process";
import process from "node:process";
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../errors.js";
import { normalizeTransportAbort } from "../backoff.js";
import type { TransportByteChannel } from "../channel.js";
import { TransportError } from "../error.js";

export type StdioTransportOptions = Readonly<{
  command: string;
  args?: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string>>;
  stderr?: "ignore" | "inherit" | ((chunk: Uint8Array) => void);
  signal?: AbortSignal;
  spawnImpl?: StdioSpawn;
}>;

export interface StdioChildLike {
  readonly stdin: {
    write(chunk: Uint8Array): boolean;
    end(): void;
    once(event: "drain", listener: () => void): void;
  };
  readonly stdout: { on(event: "data", listener: (chunk: Uint8Array) => void): void };
  readonly stderr: { on(event: "data", listener: (chunk: Uint8Array) => void): void } | null;
  once(event: "error" | "exit", listener: (...args: unknown[]) => void): void;
  kill(signal?: string): boolean;
}

export type StdioSpawn = (
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: Readonly<Record<string, string>> },
) => StdioChildLike;

function validationError(message: string): ApiClientError {
  return new ApiClientError(message, {
    type: ApiClientErrorType.Validation,
    code: ApiClientErrorCode.ValidationFailed,
  });
}

function defaultSpawn(
  command: string,
  args: readonly string[],
  options: { cwd?: string; env?: Readonly<Record<string, string>> },
): StdioChildLike {
  return spawn(command, [...args], {
    ...options,
    env: options.env === undefined ? undefined : { ...options.env },
    stdio: ["pipe", "pipe", "pipe"],
  }) as unknown as StdioChildLike;
}

export function createStdioTransport(
  options: StdioTransportOptions,
): TransportByteChannel & Readonly<{ closed: Promise<void> }> {
  const command = options.command.trim();
  if (command.length === 0) throw validationError("stdio command must be non-empty");
  const args = options.args ?? [];
  if (args.some((arg) => typeof arg !== "string" || arg.length === 0)) {
    throw validationError("stdio args must contain non-empty strings");
  }

  let child: StdioChildLike;
  try {
    child = (options.spawnImpl ?? defaultSpawn)(command, args, {
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      ...(options.env === undefined ? {} : { env: options.env }),
    });
  } catch {
    throw new TransportError("stdio process spawn failed", {
      metadata: { kind: "stdio", phase: "connect", operation: "spawn", retryable: false, attempt: 1 },
    });
  }

  const listeners = new Set<(chunk: Uint8Array) => void>();
  const closeListeners = new Set<(error?: unknown) => void>();
  const drainWaiters = new Set<{ reject: (error: unknown) => void }>();
  let terminal = false;
  let closeError: unknown;
  let resourcesClosed = false;
  let resolveClosed!: () => void;
  let rejectClosed!: (error: unknown) => void;
  const closed = new Promise<void>((resolve, reject) => {
    resolveClosed = resolve;
    rejectClosed = reject;
  });
  void closed.catch(() => undefined);

  const error = (message: string, phase: "request" | "close", code?: string | number) =>
    new TransportError(message, {
      metadata: {
        kind: "stdio", phase, operation: phase === "request" ? "write" : "process",
        retryable: false, attempt: 1, ...(code === undefined ? {} : { code }),
      },
    });

  const release = (): void => {
    if (resourcesClosed) return;
    resourcesClosed = true;
    try { child.stdin.end(); } catch { /* Best effort. */ }
    try { child.kill(); } catch { /* Best effort. */ }
  };
  const finish = (failure?: unknown, owned = false): void => {
    if (terminal) return;
    terminal = true;
    closeError = failure;
    options.signal?.removeEventListener("abort", onAbort);
    if (owned) release();
    const writeFailure = failure ?? error("stdio process is closed", "request");
    for (const waiter of drainWaiters) waiter.reject(writeFailure);
    drainWaiters.clear();
    listeners.clear();
    const current = [...closeListeners];
    closeListeners.clear();
    for (const listener of current) {
      try { listener(failure); } catch { /* Close observers are isolated. */ }
    }
    if (failure) rejectClosed(failure);
    else resolveClosed();
  };
  function onAbort(): void { finish(undefined, true); }

  child.stdout.on("data", (chunk) => {
    if (terminal) return;
    const bytes = Uint8Array.from(chunk);
    for (const listener of [...listeners]) {
      try { listener(bytes); } catch { /* Data observers are isolated. */ }
    }
  });
  if (child.stderr && typeof options.stderr === "function") {
    child.stderr.on("data", (chunk) => {
      try { options.stderr instanceof Function && options.stderr(Uint8Array.from(chunk)); } catch { /* Isolated. */ }
    });
  } else if (child.stderr && options.stderr === "inherit") {
    child.stderr.on("data", (chunk) => { process.stderr.write(chunk); });
  }
  child.once("error", () => finish(error("stdio process failed", "close")));
  child.once("exit", (...values) => {
    const code = typeof values[0] === "number" ? values[0] : undefined;
    const signal = typeof values[1] === "string" ? values[1] : undefined;
    if (terminal) return;
    if (code === 0) finish();
    else finish(error("stdio process exited unsuccessfully", "close", code ?? signal));
  });
  if (options.signal?.aborted) onAbort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  return {
    closed,
    async write(chunk, signal) {
      if (signal?.aborted) throw normalizeTransportAbort(signal);
      if (terminal) throw error("stdio process is closed", "request");
      let writable: boolean;
      try { writable = child.stdin.write(chunk); }
      catch { throw error("stdio write failed", "request"); }
      if (writable) return;
      if (terminal) throw closeError ?? error("stdio process is closed", "request");
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
          drainWaiters.delete(waiter);
          signal?.removeEventListener("abort", abort);
        };
        const fail = (failure: unknown): void => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(failure);
        };
        const abort = (): void => fail(normalizeTransportAbort(signal));
        const waiter = { reject: fail };
        drainWaiters.add(waiter);
        signal?.addEventListener("abort", abort, { once: true });
        child.stdin.once("drain", () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        });
        if (signal?.aborted) abort();
      });
    },
    subscribe(listener) {
      if (!terminal) listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeClose(listener) {
      if (terminal) {
        try { listener(closeError); } catch { /* Isolated. */ }
        return () => {};
      }
      closeListeners.add(listener);
      return () => closeListeners.delete(listener);
    },
    async close() { finish(undefined, true); },
  };
}
