// Path-owner file for the Gemini (Google Developer API) provider. API route
// literals live here per the package route-ownership contract (AGENTS.md /
// hardening test). There is intentionally no default-model constant — the
// client requires an explicit model so we never ship a stale id.

export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com";
export const GEMINI_API_VERSION = "v1beta";

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
  const name = batchId.trim().startsWith("batches/") ? batchId.trim() : `batches/${batchId.trim()}`;
  return `/${GEMINI_API_VERSION}/${name}`;
}

export function geminiBatchCancelPath(batchId: string): string {
  return `${geminiBatchPath(batchId)}:cancel`;
}

export const GEMINI_FILES_UPLOAD_PATH = "/upload/v1beta/files";

export function geminiFilePath(fileName: string): string {
  const normalized = fileName.trim().startsWith("files/")
    ? fileName.trim().slice("files/".length)
    : fileName.trim();
  return `/${GEMINI_API_VERSION}/files/${encodeURIComponent(normalized)}`;
}

export function geminiFileDownloadPath(fileName: string): string {
  const normalized = fileName.trim().startsWith("files/") ? fileName.trim() : `files/${fileName.trim()}`;
  return `/download/${GEMINI_API_VERSION}/${normalized}:download?alt=media`;
}
