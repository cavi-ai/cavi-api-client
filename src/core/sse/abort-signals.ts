export type CombinedAbortSignal = Readonly<{
  signal: AbortSignal;
  dispose: () => void;
}>;

export function combineAbortSignalsWithCleanup(
  a: AbortSignal,
  b: AbortSignal | undefined,
): CombinedAbortSignal {
  if (!b) return { signal: a, dispose: () => undefined };

  const controller = new AbortController();
  if (a.aborted || b.aborted) {
    controller.abort();
    return { signal: controller.signal, dispose: () => undefined };
  }

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    a.removeEventListener("abort", onAbort);
    b.removeEventListener("abort", onAbort);
  };
  const onAbort = (): void => {
    dispose();
    controller.abort();
  };

  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  return { signal: controller.signal, dispose };
}
