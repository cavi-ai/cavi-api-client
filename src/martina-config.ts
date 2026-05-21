/** Threshold keys that should use a remote-policy dropdown in settings. */
export const MARTINA_REMOTE_POLICY_KEYS = new Set([
  "global_remote",
  "us_remote",
  "country_flexible",
  "hybrid_flexible",
]);

/** Doctor / CLI-style commands surfaced as presets in settings dropdowns. */
export const MARTINA_DOCTOR_COMMAND_PRESETS = [
  "/top-10",
  "/status",
  "/digest",
  "/refresh",
  "/help",
] as const;

export function isMartinaCommandModifierKey(fieldKey: string): boolean {
  const k = fieldKey.toLowerCase();
  return (
    k === "command_modifier" ||
    k === "command_modifiers" ||
    k.endsWith("_command_modifier") ||
    k.includes("command_modifier")
  );
}

export function mergeDoctorCommandOptions(current: string): string[] {
  const trimmed = current.trim();
  return Array.from(
    new Set([trimmed, ...MARTINA_DOCTOR_COMMAND_PRESETS].filter((entry) => entry.length > 0)),
  );
}

function isTruthyString(raw: string): boolean {
  return raw === "true" || raw === "1" || raw.toLowerCase() === "yes";
}

function isFalsyString(raw: string): boolean {
  return raw === "false" || raw === "0" || raw.toLowerCase() === "no";
}

/** Stable string for picker value for remote-policy fields. */
export function serializeRemotePolicyValue(value: unknown): string {
  if (value === true) return "__bool_true__";
  if (value === false) return "__bool_false__";
  if (typeof value === "string") {
    if (isTruthyString(value)) return "__bool_true__";
    if (isFalsyString(value)) return "__bool_false__";
    return `__str__:${value}`;
  }
  return `__raw__:${JSON.stringify(value)}`;
}

export function deserializeRemotePolicyValue(token: string): string | boolean {
  if (token === "__bool_true__") return true;
  if (token === "__bool_false__") return false;
  if (token.startsWith("__str__:")) return token.slice("__str__:".length);
  if (token.startsWith("__raw__:")) {
    try {
      return JSON.parse(token.slice("__raw__:".length)) as string;
    } catch {
      return token;
    }
  }
  return token;
}

export function remotePolicySelectItems(value: unknown): { token: string; label: string }[] {
  const current = serializeRemotePolicyValue(value);
  const base: { token: string; label: string }[] = [
    { token: "__bool_true__", label: "Yes" },
    { token: "__bool_false__", label: "No" },
  ];
  if (current !== "__bool_true__" && current !== "__bool_false__") {
    const raw =
      typeof value === "string"
        ? value
        : typeof value === "number" || typeof value === "boolean"
          ? String(value)
          : JSON.stringify(value);
    base.push({ token: current, label: `Current: ${raw}` });
  }
  return base;
}

// ---------------------------------------------------------------------------
// Inference primitives (ported from ConfigRecordEditor.tsx:37-109)
// ---------------------------------------------------------------------------

export const ENUM_CANDIDATE_SETS = [
  ["auto", "manual", "disabled"],
  ["enabled", "disabled"],
  ["strict", "balanced", "relaxed"],
  ["high", "medium", "low"],
  ["remote", "hybrid", "onsite"],
  ["light", "standard", "heavy"],
] as const;

export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .replace(/\b\w/gu, (match) => match.toUpperCase());
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

export function isSimpleArray(value: unknown): value is Array<string | number> {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" || typeof entry === "number");
}

export function isEditableValue(
  value: unknown,
): value is string | number | boolean | null | Array<string | number> {
  return isPrimitive(value) || isSimpleArray(value);
}

export function parseListValue(raw: string, existing: Array<string | number>): Array<string | number> {
  const values = raw
    .split(/\r?\n/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (existing.every((entry) => typeof entry === "number")) {
    return values
      .map((entry) => Number(entry))
      .filter((entry) => Number.isFinite(entry));
  }
  return values;
}

export function isMultilineString(key: string, value: string): boolean {
  return (
    value.includes("\n") ||
    value.length > 72 ||
    /summary|prompt|message|description|notes?/iu.test(key)
  );
}

export function inferSelectOptions(value: string): string[] | null {
  const lower = value.toLowerCase();
  const matchedSet = ENUM_CANDIDATE_SETS.find((candidateSet) =>
    candidateSet.some((entry) => entry === lower),
  );
  if (!matchedSet) return null;
  const useUppercase = value === value.toUpperCase();
  const normalizedSet = matchedSet.map((entry) => (useUppercase ? entry.toUpperCase() : entry));
  return Array.from(new Set([value, ...normalizedSet]));
}

// ---------------------------------------------------------------------------
// Field kind inference
// ---------------------------------------------------------------------------

export type MartinaConfigFieldKind =
  | "bool"
  | "number"
  | "remotePolicy"
  | "commandModifier"
  | "enum"
  | "multiline"
  | "text"
  | "list"
  | "json";

export function inferMartinaConfigFieldKind(
  key: string,
  value: unknown,
): { kind: MartinaConfigFieldKind; enumOptions?: string[] } {
  // 1. boolean
  if (typeof value === "boolean") return { kind: "bool" };
  // 2. number
  if (typeof value === "number") return { kind: "number" };
  // 3. remotePolicy
  if (typeof value === "string" && MARTINA_REMOTE_POLICY_KEYS.has(key)) {
    return { kind: "remotePolicy" };
  }
  // 4. commandModifier
  if (typeof value === "string" && isMartinaCommandModifierKey(key)) {
    return { kind: "commandModifier" };
  }
  // 5. enum
  if (typeof value === "string") {
    const options = inferSelectOptions(value);
    if (options !== null) return { kind: "enum", enumOptions: options };
  }
  // 6. multiline string
  if (typeof value === "string" && isMultilineString(key, value)) {
    return { kind: "multiline" };
  }
  // 7. plain string
  if (typeof value === "string") return { kind: "text" };
  // 8. simple array
  if (isSimpleArray(value)) return { kind: "list" };
  // 9. record — callers branch on isRecord; return json for non-recursing callers
  if (isRecord(value)) return { kind: "json" };
  // 10. else
  return { kind: "json" };
}
