import {
  normalizeGatewayBaseUrl,
  resolveGatewayRuntimeHttpBase,
  resolveGatewayRuntimeHttpUrl,
  resolveGatewayRuntimeWsUrl,
} from "../../../core/gateway/client/runtime-targets.js";
import {
  getBrowserWindowOrigin,
  normalizeRuntimeBasePath,
  withRuntimeBasePath as withCoreRuntimeBasePath,
} from "../../../core/runtime/paths.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "../contracts/paths.js";

/** Ordered cost-history routes: released plugin route first, current CAVI route second. */
export const CAVI_COST_HISTORY_API_PATHS = [
  CAVI_CONTROL_API_ENDPOINTS.costHistory,
  "/cavi-control/api/cost/history",
] as const;

type ImportMetaWithOptionalEnv = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

type GatewayConfigGlobal = typeof globalThis & {
  __CAVI_CONTROL_BASE_PATH__?: string;
  __CAVI_GATEWAY_URL__?: string;
  __CAVI_PROJECT_BOARD_ASSET_DIR__?: string;
};

/** Default project-board asset directory — neutral, not a fleet-agent slug. */
export const DEFAULT_PROJECT_BOARD_ASSET_DIR = "project-board";

export function getRuntimeBasePath(): string {
  const rawBasePath =
    (globalThis as GatewayConfigGlobal).__CAVI_CONTROL_BASE_PATH__ ??
    (import.meta as ImportMetaWithOptionalEnv).env?.BASE_URL;
  return normalizeRuntimeBasePath(rawBasePath);
}

export function withRuntimeBasePath(pathname: string): string {
  return withCoreRuntimeBasePath(pathname, getRuntimeBasePath());
}

/** Static files under `public/` (`/agents`, `/angels`, …) for Vite `base` deployments. */
export function resolvePublicAsset(pathname: string): string {
  return withRuntimeBasePath(pathname);
}

/**
 * Project-board asset directory. Defaults to a neutral folder; a host can point
 * it at its own deployment's directory by setting `__CAVI_PROJECT_BOARD_ASSET_DIR__`.
 */
export function getProjectBoardAssetDir(): string {
  const dir = (globalThis as GatewayConfigGlobal).__CAVI_PROJECT_BOARD_ASSET_DIR__;
  const trimmed = typeof dir === "string" ? dir.trim().replace(/^\/+|\/+$/g, "") : "";
  return trimmed || DEFAULT_PROJECT_BOARD_ASSET_DIR;
}

export function resolveProjectBoardAssetPath(fileName: string): string {
  return withRuntimeBasePath(`/${getProjectBoardAssetDir()}/${fileName}`);
}

export function resolveSessionApiPath(pathname: string): string {
  return withRuntimeBasePath(pathname);
}

export function getConfiguredGatewayBaseUrl(): string | null {
  return normalizeGatewayBaseUrl(
    (globalThis as GatewayConfigGlobal).__CAVI_GATEWAY_URL__,
  );
}

export function resolveGatewayHttpBase(gatewayBaseUrl: string): string {
  return resolveGatewayRuntimeHttpBase(gatewayBaseUrl, {
    configuredGatewayBaseUrl: getConfiguredGatewayBaseUrl(),
    windowOrigin: getBrowserWindowOrigin(),
  });
}

export function resolveGatewayWsUrl(gatewayBaseUrl: string): string {
  return resolveGatewayRuntimeWsUrl(gatewayBaseUrl, {
    configuredGatewayBaseUrl: getConfiguredGatewayBaseUrl(),
    windowOrigin: getBrowserWindowOrigin(),
  });
}

export function resolveGatewayHttpUrl(
  gatewayBaseUrl: string,
  pathname: string,
): string {
  return resolveGatewayRuntimeHttpUrl(gatewayBaseUrl, pathname, {
    configuredGatewayBaseUrl: getConfiguredGatewayBaseUrl(),
    windowOrigin: getBrowserWindowOrigin(),
  });
}
