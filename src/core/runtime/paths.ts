export function normalizeRuntimeBasePath(
  rawBasePath: string | null | undefined,
): string {
  const trimmed = rawBasePath?.trim() ?? "/";
  if (!trimmed || trimmed === "/" || trimmed === "./") {
    return "";
  }
  const stripped = trimmed.replace(/^\/+|\/+$/g, "");
  return stripped ? `/${stripped}` : "";
}

export function getBrowserWindowOrigin(): string | null {
  return typeof window === "undefined" ? null : window.location.origin;
}

export function withRuntimeBasePath(
  pathname: string,
  rawBasePath: string | null | undefined,
): string {
  if (
    /^https?:\/\//i.test(pathname) ||
    pathname.startsWith("data:") ||
    pathname.startsWith("blob:")
  ) {
    return pathname;
  }
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const basePath = normalizeRuntimeBasePath(rawBasePath);
  if (
    !basePath ||
    normalizedPath === basePath ||
    normalizedPath.startsWith(`${basePath}/`)
  ) {
    return normalizedPath;
  }
  return `${basePath}${normalizedPath}`;
}

export function resolvePublicRuntimeAsset(
  pathname: string,
  rawBasePath: string | null | undefined,
): string {
  return withRuntimeBasePath(pathname, rawBasePath);
}
