import { SURFACE_CONTRACTS } from "./surfaces.js";
import type { GatewayMode } from "./surfaces.js";

export function resolvePath(
  key: string,
  mode: GatewayMode = "legacy",
  params?: Record<string, string>,
): string {
  const contract = SURFACE_CONTRACTS[key];
  if (!contract) throw new Error(`resolvePath: unknown surface "${key}"`);
  if (mode === "canonical") return contract.canonicalPath(params);
  return contract.legacyPath
    ? contract.legacyPath(params)
    : contract.canonicalPath(params);
}
