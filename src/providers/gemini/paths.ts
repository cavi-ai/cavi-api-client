// Path-owner file for the Gemini (Google Developer API) provider. API route
// literals live here per the package route-ownership contract (AGENTS.md /
// hardening test). There is intentionally no default-model constant — the
// client requires an explicit model so we never ship a stale id.

export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
export const GEMINI_API_VERSION = "v1beta";

function normalizedResourceId(
  value: string,
  prefix: string,
  label: string,
): string {
  const trimmed = value?.trim() ?? "";
  const normalized = trimmed.startsWith(prefix)
    ? trimmed.slice(prefix.length)
    : trimmed;
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    // Malformed percent encoding is harmless after encodeURIComponent below.
  }
  if (!normalized || decoded === "." || decoded === "..") {
    throw new Error(`gemini: invalid ${label} id`);
  }
  return normalized;
}

function encodedResourceId(
  value: string,
  prefix: string,
  label: string,
): string {
  return encodeURIComponent(normalizedResourceId(value, prefix, label));
}

function legacyPassThroughResourceId(
  value: string,
  prefix: string,
  label: string,
): string {
  return encodeURIComponent(normalizedResourceId(value, prefix, label)).replace(
    /%25([0-9a-f]{2})/giu,
    "%$1",
  );
}

export function geminiGenerateContentPath(model: string): string {
  return `/${GEMINI_API_VERSION}/models/${encodeURIComponent(model)}:generateContent`;
}

export function geminiStreamGenerateContentPath(model: string): string {
  return `/${GEMINI_API_VERSION}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
}

export function geminiBatchGenerateContentPath(model: string): string {
  return `/${GEMINI_API_VERSION}/models/${encodeURIComponent(model)}:batchGenerateContent`;
}

export function geminiBatchPath(batchId: string): string {
  return `/${GEMINI_API_VERSION}/batches/${legacyPassThroughResourceId(batchId, "batches/", "batch")}`;
}

export function geminiBatchCancelPath(batchId: string): string {
  return `${geminiBatchPath(batchId)}:cancel`;
}

export const GEMINI_FILES_UPLOAD_PATH = "/upload/v1beta/files";

export function geminiFilePath(fileName: string): string {
  return `/${GEMINI_API_VERSION}/files/${encodedResourceId(fileName, "files/", "file")}`;
}

export function geminiFileDownloadPath(fileName: string): string {
  return `/download/${GEMINI_API_VERSION}/files/${legacyPassThroughResourceId(fileName, "files/", "file")}:download?alt=media`;
}
