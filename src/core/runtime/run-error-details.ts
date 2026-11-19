import type { RuntimeRunErrorDetails } from "./run.js";

function readOwnString(value: object, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const field = Object.getOwnPropertyDescriptor(value, key)?.value;
    if (typeof field === "string" && field.trim()) return field;
  }
  return undefined;
}

/** Internal projection of observed native error fields; never infer retry safety. */
export function readNativeRunErrorDetails(value: unknown): RuntimeRunErrorDetails | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const details: RuntimeRunErrorDetails = {};
  const providerCode = readOwnString(value, "code", "providerCode");
  const providerType = readOwnString(value, "type", "providerType", "kind");
  const reason = readOwnString(value, "reason");
  if (providerCode !== undefined) details.providerCode = providerCode;
  if (providerType !== undefined) details.providerType = providerType;
  if (reason !== undefined) details.reason = reason;
  return Object.keys(details).length ? details : undefined;
}
