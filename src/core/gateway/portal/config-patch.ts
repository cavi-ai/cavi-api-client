import { PORTAL_CLIENT_ID_HEADER } from "../../http/types.js";
import { GATEWAY_PORTAL_API_ENDPOINTS } from "../../../contracts/paths.js";

/**
 * Shared HTTP contract for portal dashboard config updates (POST).
 * Any client (mobile, web, scripts) may call {@link postPortalConfigPatch} against
 * the portal config surface once the gateway implements the route.
 */

export const PORTAL_CONFIG_PATCH_CONTRACT = "PORTAL_CONFIG_PATCH_V1" as const;
export const PORTAL_CONFIG_PATCH_CONTRACT_VERSION = 1 as const;

/** Optional header some gateways require for audit / routing. */
export const PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER = PORTAL_CLIENT_ID_HEADER;

const UNSAFE_CONFIG_PATH_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

export type PortalConfigPatchRequestBody = {
  contract: typeof PORTAL_CONFIG_PATCH_CONTRACT;
  v: typeof PORTAL_CONFIG_PATCH_CONTRACT_VERSION;
  /** Gateway-defined scope (e.g. `readiness`, `snapshot.thresholds`). */
  scope: string;
  /** Nested object; build from flat UI keys with {@link unflattenPortalConfigPatchKeys}. */
  patch: Record<string, unknown>;
};

export type PostPortalConfigPatchParams = {
  httpBase: string;
  /** Bearer secret without the `Bearer ` prefix. */
  authToken: string;
  /** URL segment only, e.g. `portal-a`. */
  portalSlug: string;
  scope: string;
  patch: Record<string, unknown>;
  /** Sent as {@link PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER} when non-empty. */
  clientId?: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export class PortalConfigPatchError extends Error {
  readonly status: number;
  readonly responseBody: string | null;

  constructor(status: number, message: string, responseBody: string | null) {
    super(message);
    this.name = "PortalConfigPatchError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function portalConfigPatchPath(portalSlug: string): string {
  const slug = portalSlug.trim().replace(/^\/+/u, "").replace(/\/+$/u, "");
  if (!slug || slug.includes("/")) {
    throw new Error(`portalConfigPatchPath: invalid portal slug "${portalSlug}"`);
  }
  return GATEWAY_PORTAL_API_ENDPOINTS.config(slug);
}

/**
 * Turns flat keys like `foo › bar` into `{ foo: { bar: value } }`.
 */
export function unflattenPortalConfigPatchKeys(
  flat: Record<string, unknown>,
  separator = " › ",
): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(flat)) {
    const parts = path
      .split(separator)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (!parts.length) continue;
    const unsafeSegment = parts.find((part) => UNSAFE_CONFIG_PATH_SEGMENTS.has(part));
    if (unsafeSegment) {
      throw new Error(
        `unflattenPortalConfigPatchKeys: unsafe path segment "${unsafeSegment}"`,
      );
    }
    let cur: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]!;
      const next = cur[p];
      if (next && typeof next === "object" && !Array.isArray(next)) {
        cur = next as Record<string, unknown>;
      } else {
        const nested: Record<string, unknown> = {};
        cur[p] = nested;
        cur = nested;
      }
    }
    const leaf = parts[parts.length - 1]!;
    cur[leaf] = value;
  }
  return root;
}

export async function postPortalConfigPatch(
  params: PostPortalConfigPatchParams,
): Promise<unknown> {
  const base = params.httpBase.trim().replace(/\/+$/u, "");
  const url = `${base}${portalConfigPatchPath(params.portalSlug)}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${params.authToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const cid = params.clientId?.trim();
  if (cid) {
    headers[PORTAL_CONFIG_PATCH_CLIENT_ID_HEADER] = cid;
  }
  const body: PortalConfigPatchRequestBody = {
    contract: PORTAL_CONFIG_PATCH_CONTRACT,
    v: PORTAL_CONFIG_PATCH_CONTRACT_VERSION,
    scope: params.scope,
    patch: params.patch,
  };
  const fetchFn = params.fetchImpl ?? fetch;
  const res = await fetchFn(url, {
    method: "POST",
    signal: params.signal,
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 404 || res.status === 501
        ? " (gateway may not expose the portal.config surface yet)"
        : "";
    throw new PortalConfigPatchError(
      res.status,
      `Portal config PATCH failed: HTTP ${res.status}${hint}`,
      text.length ? text : null,
    );
  }
  if (!text) return { ok: true as const };
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { ok: true as const, raw: text };
  }
}
