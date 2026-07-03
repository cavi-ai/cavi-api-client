// Path-owner file for the Codex Responses provider. API route literals live
// here per the package route-ownership contract (see AGENTS.md / hardening test).

export const CODEX_API_BASE_URL = "https://api.openai.com";

export const CODEX_API_ENDPOINTS = {
  responses: "/v1/responses",
  files: "/v1/files",
  batches: "/v1/batches",
} as const;

export const CODEX_DEFAULT_MODEL = "gpt-5-codex";

export function codexResponsePath(responseId: string): string {
  return `${CODEX_API_ENDPOINTS.responses}/${encodeURIComponent(responseId)}`;
}

export function codexResponseCancelPath(responseId: string): string {
  return `${codexResponsePath(responseId)}/cancel`;
}

export function codexFilePath(fileId: string): string {
  return `${CODEX_API_ENDPOINTS.files}/${encodeURIComponent(fileId)}`;
}

export function codexFileContentPath(fileId: string): string {
  return `${codexFilePath(fileId)}/content`;
}

export function codexBatchPath(batchId: string): string {
  return `${CODEX_API_ENDPOINTS.batches}/${encodeURIComponent(batchId)}`;
}

export function codexBatchCancelPath(batchId: string): string {
  return `${codexBatchPath(batchId)}/cancel`;
}
