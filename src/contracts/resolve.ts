import { SURFACE_CONTRACTS } from "./surfaces.js";
import type { GatewayMode, SurfaceContract } from "./surfaces.js";

export type SurfaceContractMap = Record<string, SurfaceContract>;

export type SurfacePathResolver = (
  key: string,
  mode?: GatewayMode,
  params?: Record<string, string>,
) => string;

export function resolveSurfaceContractPath(
  contract: SurfaceContract,
  mode: GatewayMode = "legacy",
  params?: Record<string, string>,
): string {
  if (mode === "canonical") return contract.canonicalPath(params);
  return contract.legacyPath
    ? contract.legacyPath(params)
    : contract.canonicalPath(params);
}

export function createSurfacePathResolver(
  extensionContracts: SurfaceContractMap = {},
  baseResolver: SurfacePathResolver = resolvePath,
): SurfacePathResolver {
  return (key, mode = "legacy", params) => {
    const contract = extensionContracts[key];
    if (contract) return resolveSurfaceContractPath(contract, mode, params);
    return baseResolver(key, mode, params);
  };
}

export function resolvePath(
  key: string,
  mode: GatewayMode = "legacy",
  params?: Record<string, string>,
): string {
  const contract = SURFACE_CONTRACTS[key];
  if (!contract) throw new Error(`resolvePath: unknown surface "${key}"`);
  return resolveSurfaceContractPath(contract, mode, params);
}
