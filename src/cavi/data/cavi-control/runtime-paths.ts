import { resolveGatewayTargets } from "../../../core/gateway/rpc.js";

type ImportMetaWithOptionalEnv = ImportMeta & {
  env?: {
    BASE_URL?: string;
  };
};

type GatewayConfigGlobal = typeof globalThis & {
  __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
  __OPENCLAW_GATEWAY_URL__?: string;
};

function normalizeGatewayBaseUrl(
  rawGatewayBaseUrl: string | null | undefined,
): string | null {
  const trimmed = rawGatewayBaseUrl?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/u, "");
}

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function loopbackEquivalenceKey(url: URL): string | null {
  const proto = url.protocol.toLowerCase();
  if (proto !== "http:" && proto !== "https:") {
    return null;
  }
  if (!LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())) {
    return null;
  }
  const effectivePort = url.port || (proto === "https:" ? "443" : "80");
  return `${proto}//loopback:${effectivePort}`;
}

/**
 * Stored gateway URL vs `config.js` gateway must match before we route HTTP/WS via the UI
 * origin (Vite/nginx proxy). A common mismatch is `localhost` vs `127.0.0.1` — same daemon,
 * but strict string equality skips same-origin routing and triggers cross-origin gateway
 * fetch + silent empty data when CORS blocks the browser.
 */
function sameConfiguredGatewayDaemon(
  normalizedStored: string | null,
  normalizedConfigured: string | null,
): boolean {
  if (!normalizedStored || !normalizedConfigured) {
    return false;
  }
  if (normalizedStored === normalizedConfigured) {
    return true;
  }

  let storedUrl: URL;
  let configuredUrl: URL;
  try {
    storedUrl = new URL(normalizedStored);
    configuredUrl = new URL(normalizedConfigured);
  } catch {
    return false;
  }

  const a = loopbackEquivalenceKey(storedUrl);
  const b = loopbackEquivalenceKey(configuredUrl);
  if (a !== null && b !== null && a === b) {
    return true;
  }

  return false;
}

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

function resolveSameOriginRuntimeBase(): string {
  if (typeof window === "undefined") {
    return "";
  }
  // Gateway APIs are mounted at origin root (`/api/plugins/*`, `/v1/*`),
  // even when the UI itself is served from a base path like `/cavi-control/`.
  return window.location.origin;
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
  const normalizedGatewayBaseUrl = normalizeGatewayBaseUrl(gatewayBaseUrl);
  const configuredGatewayBaseUrl = getConfiguredGatewayBaseUrl();

  if (
    normalizedGatewayBaseUrl &&
    configuredGatewayBaseUrl &&
    typeof window !== "undefined" &&
    sameConfiguredGatewayDaemon(
      normalizedGatewayBaseUrl,
      configuredGatewayBaseUrl,
    )
  ) {
    return resolveSameOriginRuntimeBase();
  }

  if (!normalizedGatewayBaseUrl) {
    return resolveSameOriginRuntimeBase();
  }

  return resolveGatewayTargets(normalizedGatewayBaseUrl).httpBase;
}

export function resolveGatewayWsUrl(gatewayBaseUrl: string): string {
  const normalizedGatewayBaseUrl = normalizeGatewayBaseUrl(gatewayBaseUrl);
  const configuredGatewayBaseUrl = getConfiguredGatewayBaseUrl();

  if (
    normalizedGatewayBaseUrl &&
    configuredGatewayBaseUrl &&
    typeof window !== "undefined" &&
    sameConfiguredGatewayDaemon(
      normalizedGatewayBaseUrl,
      configuredGatewayBaseUrl,
    )
  ) {
    const origin = window.location.origin;
    const wsProtocol = origin.startsWith("https") ? "wss:" : "ws:";
    const url = new URL(origin);
    return `${wsProtocol}//${url.host}/ws`;
  }

  if (!normalizedGatewayBaseUrl) {
    if (typeof window !== "undefined") {
      const origin = window.location.origin;
      const wsProtocol = origin.startsWith("https") ? "wss:" : "ws:";
      const url = new URL(origin);
      return `${wsProtocol}//${url.host}/ws`;
    }
    return "ws://127.0.0.1:18789/ws";
  }

  return resolveGatewayTargets(normalizedGatewayBaseUrl).wsUrl;
}

export function resolveGatewayHttpUrl(
  gatewayBaseUrl: string,
  pathname: string,
): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${resolveGatewayHttpBase(gatewayBaseUrl)}${normalizedPath}`;
}
