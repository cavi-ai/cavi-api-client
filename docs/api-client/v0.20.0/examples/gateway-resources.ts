import type { CapabilityClient } from "@cavi-ai/api-client";

export async function listGatewaySessions(client: CapabilityClient) {
  const result = await client.sessions.listSessions();
  if (!result.ok) {
    return { kind: "unavailable" as const, gap: result.gap };
  }
  return { kind: "sessions" as const, sessions: result.data.data, nextCursor: result.data.nextCursor };
}
