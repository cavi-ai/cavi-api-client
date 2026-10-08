import type { RuntimeRunErrorDetails } from "./run.js";

/** Internal projection of observed native error fields; never infer retry safety. */
export function readNativeRunErrorDetails(value: unknown): RuntimeRunErrorDetails | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const details: RuntimeRunErrorDetails = {};
  for (const [native, normalized] of [
    ["code", "providerCode"], ["type", "providerType"], ["reason", "reason"],
  ] as const) {
    const field = Object.getOwnPropertyDescriptor(value, native)?.value;
    if (typeof field === "string" && field.trim()) details[normalized] = field;
  }
  return Object.keys(details).length ? details : undefined;
}
