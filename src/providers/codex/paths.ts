// Path-owner file for the Codex Responses provider. API route literals live
// here per the package route-ownership contract (see AGENTS.md / hardening test).

export const CODEX_API_BASE_URL = "https://api.openai.com";

export const CODEX_API_ENDPOINTS = {
  responses: "/v1/responses",
} as const;

export const CODEX_DEFAULT_MODEL = "gpt-5-codex";

export function codexResponsePath(responseId: string): string {
  return `${CODEX_API_ENDPOINTS.responses}/${encodeURIComponent(responseId)}`;
}

export function codexResponseCancelPath(responseId: string): string {
  return `${codexResponsePath(responseId)}/cancel`;
}
