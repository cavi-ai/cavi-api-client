import {
  normalizeGatewayBaseUrl,
  resolveGatewayRuntimeHttpBase,
  resolveGatewayRuntimeHttpUrl,
  resolveGatewayRuntimeWsUrl,
} from "../../core/gateway/runtime-targets.js";
import {
  getBrowserWindowOrigin,
  normalizeRuntimeBasePath,
  withRuntimeBasePath as withCoreRuntimeBasePath,
} from "../../core/runtime/paths.js";

type ImportMetaWithOptionalEnv = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

type GatewayConfigGlobal = typeof globalThis & {
  __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
  __OPENCLAW_GATEWAY_URL__?: string;
};

export function getRuntimeBasePath(): string {
  const rawBasePath =
    (globalThis as GatewayConfigGlobal).__OPENCLAW_CAVI_CONTROL_BASE_PATH__ ??
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

export function resolveDebAssetPath(fileName: string): string {
  return withRuntimeBasePath(`/deb/${fileName}`);
}

export function resolveSessionApiPath(pathname: string): string {
  return withRuntimeBasePath(pathname);
}

export function getConfiguredGatewayBaseUrl(): string | null {
  return normalizeGatewayBaseUrl(
    (globalThis as GatewayConfigGlobal).__OPENCLAW_GATEWAY_URL__,
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
