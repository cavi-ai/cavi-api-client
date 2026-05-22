import {
  normalizeGatewayBaseUrl,
  resolveGatewayRuntimeHttpBase,
  resolveGatewayRuntimeHttpUrl,
  resolveGatewayRuntimeWsUrl,
} from "../../../core/gateway/runtime-targets.js";

type ImportMetaWithOptionalEnv = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

type GatewayConfigGlobal = typeof globalThis & {
  __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
  __OPENCLAW_GATEWAY_URL__?: string;
};

function normalizeBasePath(rawBasePath: string | undefined): string {
  const trimmed = rawBasePath?.trim() ?? "/";
  if (!trimmed || trimmed === "/" || trimmed === "./") {
    return "";
  }
  const stripped = trimmed.replace(/^\/+|\/+$/g, "");
  return stripped ? `/${stripped}` : "";
}

export function getRuntimeBasePath(): string {
  const rawBasePath =
    (globalThis as GatewayConfigGlobal).__OPENCLAW_CAVI_CONTROL_BASE_PATH__ ??
    (import.meta as ImportMetaWithOptionalEnv).env?.BASE_URL;
  return normalizeBasePath(rawBasePath);
}

function getWindowOrigin(): string | null {
  return typeof window === "undefined" ? null : window.location.origin;
}

function resolveSameOriginRuntimeBase(): string {
  // Gateway APIs are mounted at origin root (`/api/plugins/*`, `/v1/*`),
  // even when the UI itself is served from a base path like `/cavi-control/`.
  return getWindowOrigin() ?? "";
}

export function withRuntimeBasePath(pathname: string): string {
  if (
    /^https?:\/\//i.test(pathname) ||
    pathname.startsWith("data:") ||
    pathname.startsWith("blob:")
  ) {
    return pathname;
  }
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const basePath = getRuntimeBasePath();
  if (
    !basePath ||
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`)
  ) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
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
    windowOrigin: getWindowOrigin(),
  });
}

export function resolveGatewayWsUrl(gatewayBaseUrl: string): string {
  return resolveGatewayRuntimeWsUrl(gatewayBaseUrl, {
    configuredGatewayBaseUrl: getConfiguredGatewayBaseUrl(),
    windowOrigin: getWindowOrigin(),
  });
}

export function resolveGatewayHttpUrl(
  gatewayBaseUrl: string,
  pathname: string,
): string {
  return resolveGatewayRuntimeHttpUrl(gatewayBaseUrl, pathname, {
    configuredGatewayBaseUrl: getConfiguredGatewayBaseUrl(),
    windowOrigin: getWindowOrigin(),
  });
}
