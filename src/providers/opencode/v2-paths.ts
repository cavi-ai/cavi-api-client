import { encodeOpenCodeSessionId } from "./protocol.js";

export const OPENCODE_V2_SESSIONS_PATH = "/api/session";

export function openCodeV2SessionPath(id: string, operation?: "prompt" | "interrupt" | "message"): string {
  return `${OPENCODE_V2_SESSIONS_PATH}/${encodeOpenCodeSessionId(id)}${operation ? `/${operation}` : ""}`;
}

export function openCodeV2MessagesPath(id: string, cursor?: string): string {
  const query = new URLSearchParams({ limit: "100", ...(cursor ? { cursor } : { order: "asc" }) });
  return `${openCodeV2SessionPath(id, "message")}?${query}`;
}
