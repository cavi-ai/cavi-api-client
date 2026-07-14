import path from "node:path";

export function safeSlug(value, label = "slug") {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(value)) {
    throw new Error(`${label}: expected a safe lowercase slug; observed ${String(value)}`);
  }
  return value;
}

export function normalizedRelativePath(value, label = "path") {
  if (typeof value !== "string" || !value || path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw new Error(`${label}: expected a normalized repository-relative path; observed ${String(value)}`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..") || path.posix.normalize(value) !== value || value.includes("\\")) {
    throw new Error(`${label}: expected a normalized repository-relative path; observed ${value}`);
  }
  return value;
}

export function containedPath(root, relativePath, label = "path") {
  const normalized = normalizedRelativePath(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, normalized);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}: destination escapes root: ${relativePath}`);
  }
  return resolved;
}
