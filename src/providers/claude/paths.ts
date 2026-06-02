// Path-owner file for the Claude (Anthropic) provider. API route literals live
// here per the package route-ownership contract (see AGENTS.md / hardening test).

export const CLAUDE_API_BASE_URL = "https://api.anthropic.com";

export const CLAUDE_API_ENDPOINTS = {
  messages: "/v1/messages",
} as const;

export const CLAUDE_DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
