import { SURFACE_CONTRACTS } from "./surfaces.js";
import type { SurfaceContract } from "./surfaces.js";

export type SurfaceContractMap = Record<string, SurfaceContract>;

export type SurfacePathResolver = (
  key: string,
  params?: Record<string, string>,
) => string;

export function resolveSurfaceContractPath(
  contract: SurfaceContract,
  params?: Record<string, string>,
): string {
  return contract.path(params);
}

export function createSurfacePathResolver(
  extensionContracts: SurfaceContractMap = {},
  baseResolver: SurfacePathResolver = resolvePath,
): SurfacePathResolver {
  return (key, params) => {
    const contract = extensionContracts[key];
    if (contract) return resolveSurfaceContractPath(contract, params);
    return baseResolver(key, params);
  };
}

export function resolvePath(
  key: string,
  params?: Record<string, string>,
): string {
  const contract = SURFACE_CONTRACTS[key];
  if (!contract) throw new Error(`resolvePath: unknown surface "${key}"`);
  return resolveSurfaceContractPath(contract, params);
}
