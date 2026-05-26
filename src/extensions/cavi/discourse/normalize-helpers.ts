import type {
  DiscourseEventType,
  TaskDiscourseSummary,
} from "../domain/index.js";
import { asString, isRecord } from "../../../core/data/guards.js";

function tryParseJsonRecord(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Gateway occasionally double-encodes `event.data` as a JSON string — unwrap before field reads. */
export function coerceDiscourseDataRecord(
  raw: unknown,
): Record<string, unknown> {
  if (isRecord(raw)) {
    return raw;
  }
  if (typeof raw === "string") {
    const parsed = tryParseJsonRecord(raw);
    if (parsed) {
      return parsed;
    }
  }
  return {};
}

export function asDiscourseMessageText(
  value: unknown,
  fallback: string,
): string {
  const direct = asString(value);
  if (direct) {
    return direct;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }
  if (isRecord(value)) {
    const nested =
      asString(value.message) ??
      asString(value.text) ??
      asString(value.body) ??
      asString(value.content) ??
      asString(value.summary) ??
      asString(value.markdown) ??
      asString(value.objective);
    if (nested) {
      return nested;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function asDiscourseScalarToken(
  value: unknown,
  fallback: string,
): string {
  const direct = asString(value);
  if (direct) {
    return direct;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === "object") {
    try {
      const text = JSON.stringify(value);
      return text.length > 160 ? `${text.slice(0, 157)}…` : text;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

const DISCOURSE_EVENT_TYPES = new Set<DiscourseEventType>([
  "discourse.dispatch",
  "discourse.delegation",
  "discourse.decision",
  "discourse.blocker",
  "discourse.resolution",
  "discourse.status",
  "discourse.escalation",
  "discourse.completion",
  "discourse.spawn.dedup",
  "discourse.spawn.guard",
  "discourse.spawn.budget",
]);

const DISCOURSE_SUMMARY_OUTCOMES = new Set<TaskDiscourseSummary["outcome"]>([
  "success",
  "partial",
  "fail",
  "blocked",
  "pending",
]);

const DISCOURSE_BLOCKER_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;
const DISCOURSE_RESOLUTION_METHODS = [
  "retry",
  "workaround",
  "escalate",
  "skip",
] as const;
const DISCOURSE_COMPLETION_OUTCOMES = [
  "ok",
  "error",
  "timeout",
  "partial",
] as const;

export function isDiscourseEventType(
  value: unknown,
): value is DiscourseEventType {
  return (
    typeof value === "string" &&
    DISCOURSE_EVENT_TYPES.has(value as DiscourseEventType)
  );
}

export function asDiscourseSummaryOutcome(
  value: unknown,
): TaskDiscourseSummary["outcome"] | null {
  if (
    typeof value === "string" &&
    DISCOURSE_SUMMARY_OUTCOMES.has(value as TaskDiscourseSummary["outcome"])
  ) {
    return value as TaskDiscourseSummary["outcome"];
  }
  return null;
}

export function asBlockerSeverity(
  value: unknown,
): "low" | "medium" | "high" | "critical" {
  if (
    typeof value === "string" &&
    DISCOURSE_BLOCKER_SEVERITIES.includes(
      value as (typeof DISCOURSE_BLOCKER_SEVERITIES)[number],
    )
  ) {
    return value as "low" | "medium" | "high" | "critical";
  }
  return "medium";
}

export function asResolutionMethod(
  value: unknown,
): "retry" | "workaround" | "escalate" | "skip" {
  if (
    typeof value === "string" &&
    DISCOURSE_RESOLUTION_METHODS.includes(
      value as (typeof DISCOURSE_RESOLUTION_METHODS)[number],
    )
  ) {
    return value as "retry" | "workaround" | "escalate" | "skip";
  }
  return "workaround";
}

export function asCompletionOutcome(
  value: unknown,
): "ok" | "error" | "timeout" | "partial" {
  if (
    typeof value === "string" &&
    DISCOURSE_COMPLETION_OUTCOMES.includes(
      value as (typeof DISCOURSE_COMPLETION_OUTCOMES)[number],
    )
  ) {
    return value as "ok" | "error" | "timeout" | "partial";
  }
  return "partial";
}
