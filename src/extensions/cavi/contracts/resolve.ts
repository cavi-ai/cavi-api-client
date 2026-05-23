import { resolvePath as resolveCorePath } from "../../../contracts/resolve.js";
import { CAVI_SURFACE_CONTRACTS } from "./surfaces.js";
import type { GatewayMode } from "./surfaces.js";

export function resolveCaviPath(
  key: string,
  mode: GatewayMode = "legacy",
  params?: Record<string, string>,
): string {
  const contract = CAVI_SURFACE_CONTRACTS[key];
  if (!contract) return resolveCorePath(key, mode, params);
  if (mode === "canonical") return contract.canonicalPath(params);
  return contract.legacyPath
    ? contract.legacyPath(params)
    : contract.canonicalPath(params);
}

export const resolvePath = resolveCaviPath;
