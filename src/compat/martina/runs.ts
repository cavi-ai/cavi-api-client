/** Canonical Martina run status types and helpers. Consumed by mobile and (future) web. */

export type MartinaRunStatus = "running" | "completed" | "failed" | "canceled";

/**
 * Normalizes a raw gateway run status into a canonical MartinaRunStatus.
 * Mirrors the mobile + web copies — treats alias statuses, pending/queued→running,
 * and finishedAt presence as completion signal.
 * Returns null when the status cannot be resolved.
 */
export function normalizeMartinaRunStatus(
  raw: unknown,
  finishedAt: string | null,
): MartinaRunStatus | null {
  if (typeof raw !== "string") return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/gu, "_");
  const aliases: Record<string, MartinaRunStatus> = {
    running: "running",
    completed: "completed",
    complete: "completed",
    success: "completed",
    succeeded: "completed",
    done: "completed",
    ok: "completed",
    failed: "failed",
    failure: "failed",
    error: "failed",
    canceled: "canceled",
    cancelled: "canceled",
  };
  if (aliases[s]) return aliases[s]!;
  if (
    s === "pending" ||
    s === "queued" ||
    s === "queue" ||
    s === "dispatching" ||
    s === "starting" ||
    s === "in_progress" ||
    s === "working" ||
    s === "active"
  ) {
    return "running";
  }
  if (
    finishedAt &&
    finishedAt.length > 0 &&
    !Number.isNaN(Date.parse(finishedAt))
  ) {
    return "completed";
  }
  return null;
}

export const MARTINA_RUN_DISPATCH_LABEL: Record<MartinaRunStatus, string> = {
  running: "In progress",
  completed: "Delivered",
  failed: "Blocked",
  canceled: "Canceled",
};

/**
 * Returns a human dispatch label for a run status string.
 * Falls back to the raw status if it is not a known MartinaRunStatus.
 */
export function martinaRunDispatchLabel(status: string): string {
  return MARTINA_RUN_DISPATCH_LABEL[status as MartinaRunStatus] ?? status;
}
