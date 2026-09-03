import { encodeOpenCodeSessionId, validateOpenCodeScope, type OpenCodeScope } from "./protocol.js";

const OPENCODE_PATHS = {
  globalHealth: "/global/health",
  event: "/event",
  session: "/session",
  sessionStatus: "/session/status",
  message: "/message",
  promptAsync: "/prompt_async",
  abort: "/abort",
} as const;

/** Encode scope parameters in the wire-prescribed directory/workspace order. */
export function opencodeScopeQuery(scope: OpenCodeScope): string {
  const validated = validateOpenCodeScope(scope);
  const params = [`directory=${encodeURIComponent(validated.directory)}`];
  if (validated.workspace !== undefined) {
    params.push(`workspace=${encodeURIComponent(validated.workspace)}`);
  }
  return `?${params.join("&")}`;
}

export function opencodeHealthPath(): string {
  return OPENCODE_PATHS.globalHealth;
}

export function opencodeEventPath(scope: OpenCodeScope): string {
  return `${OPENCODE_PATHS.event}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionPath(scope: OpenCodeScope, sessionId: unknown): string {
  return `${OPENCODE_PATHS.session}/${encodeOpenCodeSessionId(sessionId)}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionCreatePath(scope: OpenCodeScope): string {
  return `${OPENCODE_PATHS.session}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionStatusPath(scope: OpenCodeScope): string {
  return `${OPENCODE_PATHS.sessionStatus}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionMessagePath(scope: OpenCodeScope, sessionId: unknown): string {
  return `${OPENCODE_PATHS.session}/${encodeOpenCodeSessionId(sessionId)}${OPENCODE_PATHS.message}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionPromptAsyncPath(scope: OpenCodeScope, sessionId: unknown): string {
  return `${OPENCODE_PATHS.session}/${encodeOpenCodeSessionId(sessionId)}${OPENCODE_PATHS.promptAsync}${opencodeScopeQuery(scope)}`;
}

export function opencodeSessionAbortPath(scope: OpenCodeScope, sessionId: unknown): string {
  return `${OPENCODE_PATHS.session}/${encodeOpenCodeSessionId(sessionId)}${OPENCODE_PATHS.abort}${opencodeScopeQuery(scope)}`;
}
