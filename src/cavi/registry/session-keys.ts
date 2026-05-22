export const DEFAULT_AGENT_SESSION_AGENT_ID = "main";
export const DEFAULT_AGENT_SESSION_SUFFIX = "main";

const VALID_AGENT_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const INVALID_AGENT_ID_CHARS_RE = /[^a-z0-9_-]+/g;
const LEADING_DASH_RE = /^-+/;
const TRAILING_DASH_RE = /-+$/;

export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export function normalizeSessionKeyPart(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function normalizeSessionAgentId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  const normalized = normalizeSessionKeyPart(trimmed);
  if (VALID_AGENT_ID_RE.test(trimmed)) {
    return normalized;
  }
  return (
    normalized
      .replace(INVALID_AGENT_ID_CHARS_RE, "-")
      .replace(LEADING_DASH_RE, "")
      .replace(TRAILING_DASH_RE, "")
      .slice(0, 64) || DEFAULT_AGENT_SESSION_AGENT_ID
  );
}

export function parseAgentSessionKey(
  sessionKey: string | null | undefined,
): ParsedAgentSessionKey | null {
  const raw = normalizeSessionKeyPart(sessionKey);
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3 || parts[0] !== "agent") {
    return null;
  }
  const agentId = normalizeSessionAgentId(parts[1]);
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function buildAgentMainSessionKey(params: {
  agentId: string | null | undefined;
  mainKey?: string | null | undefined;
}): string {
  const agentId =
    normalizeSessionAgentId(params.agentId) ?? DEFAULT_AGENT_SESSION_AGENT_ID;
  const mainKey =
    normalizeSessionKeyPart(params.mainKey) || DEFAULT_AGENT_SESSION_SUFFIX;
  return `agent:${agentId}:${mainKey}`;
}

export function normalizeSessionKey(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }
  const lowered = normalizeSessionKeyPart(raw);
  if (lowered === DEFAULT_AGENT_SESSION_SUFFIX) {
    return buildAgentMainSessionKey({ agentId: DEFAULT_AGENT_SESSION_AGENT_ID });
  }
  const parsed = parseAgentSessionKey(raw);
  if (parsed) {
    return `agent:${parsed.agentId}:${parsed.rest}`;
  }
  if (lowered.startsWith("agent:")) {
    return lowered;
  }
  return lowered;
}

export function sessionKeysEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeSessionKey(left);
  const normalizedRight = normalizeSessionKey(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}
