import { resolveGatewayTargets } from "./rpc.js";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_LOCAL_GATEWAY_WS_URL = "ws://127.0.0.1:18789/ws";

export type ResolveGatewayRuntimeTargetOptions = {
  configuredGatewayBaseUrl?: string | null;
  windowOrigin?: string | null;
  fallbackWsUrl?: string;
};

export function normalizeGatewayBaseUrl(
  rawGatewayBaseUrl: string | null | undefined,
): string | null {
  const trimmed = rawGatewayBaseUrl?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/+$/u, "");
}

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

export function sameGatewayDaemon(
  leftBaseUrl: string | null | undefined,
  rightBaseUrl: string | null | undefined,
): boolean {
  const left = normalizeGatewayBaseUrl(leftBaseUrl);
  const right = normalizeGatewayBaseUrl(rightBaseUrl);
  if (!left || !right) {
    return false;
  }
  if (left === right) {
    return true;
  }

  let leftUrl: URL;
  let rightUrl: URL;
  try {
    leftUrl = new URL(left);
    rightUrl = new URL(right);
  } catch {
    return false;
  }

  const leftLoopback = loopbackEquivalenceKey(leftUrl);
  const rightLoopback = loopbackEquivalenceKey(rightUrl);
  return (
    leftLoopback !== null &&
    rightLoopback !== null &&
    leftLoopback === rightLoopback
  );
}

function originToWsUrl(origin: string): string {
  const wsProtocol = origin.startsWith("https") ? "wss:" : "ws:";
  const url = new URL(origin);
  return `${wsProtocol}//${url.host}/ws`;
}

export function resolveGatewayRuntimeHttpBase(
  gatewayBaseUrl: string,
  options: ResolveGatewayRuntimeTargetOptions = {},
): string {
  const normalizedGatewayBaseUrl = normalizeGatewayBaseUrl(gatewayBaseUrl);
  const configuredGatewayBaseUrl = normalizeGatewayBaseUrl(
    options.configuredGatewayBaseUrl,
  );
  const windowOrigin = options.windowOrigin?.trim() || null;

  if (
    normalizedGatewayBaseUrl &&
    configuredGatewayBaseUrl &&
    windowOrigin &&
    sameGatewayDaemon(normalizedGatewayBaseUrl, configuredGatewayBaseUrl)
  ) {
    return windowOrigin;
  }

  if (!normalizedGatewayBaseUrl) {
    return windowOrigin ?? "";
  }

  return resolveGatewayTargets(normalizedGatewayBaseUrl).httpBase;
}

export function resolveGatewayRuntimeWsUrl(
  gatewayBaseUrl: string,
  options: ResolveGatewayRuntimeTargetOptions = {},
): string {
  const normalizedGatewayBaseUrl = normalizeGatewayBaseUrl(gatewayBaseUrl);
  const configuredGatewayBaseUrl = normalizeGatewayBaseUrl(
    options.configuredGatewayBaseUrl,
  );
  const windowOrigin = options.windowOrigin?.trim() || null;

  if (
    normalizedGatewayBaseUrl &&
    configuredGatewayBaseUrl &&
    windowOrigin &&
    sameGatewayDaemon(normalizedGatewayBaseUrl, configuredGatewayBaseUrl)
  ) {
    return originToWsUrl(windowOrigin);
  }

  if (!normalizedGatewayBaseUrl) {
    return windowOrigin
      ? originToWsUrl(windowOrigin)
      : (options.fallbackWsUrl ?? DEFAULT_LOCAL_GATEWAY_WS_URL);
  }

  return resolveGatewayTargets(normalizedGatewayBaseUrl).wsUrl;
}

export function resolveGatewayRuntimeHttpUrl(
  gatewayBaseUrl: string,
  pathname: string,
  options: ResolveGatewayRuntimeTargetOptions = {},
): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${resolveGatewayRuntimeHttpBase(gatewayBaseUrl, options)}${normalizedPath}`;
}
