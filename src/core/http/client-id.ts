import { invalidConfigError } from "../error-factories.js";
import { PORTAL_CLIENT_ID_HEADER } from "./types.js";

export { PORTAL_CLIENT_ID_HEADER };

const PORTAL_CLIENT_ID_PATTERN = /^[a-z0-9._-]+$/u;

export function requirePortalClientId(
  value: string | null | undefined,
): string {
  if (typeof value !== "string") {
    throw invalidConfigError("Missing clientId. Pass a clientId explicitly.");
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    throw invalidConfigError("Missing clientId. Pass a clientId explicitly.");
  }
  if (!PORTAL_CLIENT_ID_PATTERN.test(normalized)) {
    throw invalidConfigError("Portal client id must be a lowercase slug.");
  }
  return normalized;
}

export function normalizePortalClientId(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized || !PORTAL_CLIENT_ID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export function isValidPortalClientId(
  value: string | null | undefined,
): boolean {
  return normalizePortalClientId(value) !== null;
}
