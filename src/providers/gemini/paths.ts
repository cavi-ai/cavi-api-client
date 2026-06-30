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
