import type { CapabilityClient } from "@cavi-ai/api-client";

export async function listGatewaySessions(client: CapabilityClient) {
  const result = await client.sessions.listSessions();
  if (!result.ok) {
    return { sessions: [], gap: result.gap };
  }
  return { sessions: result.data.data, gap: null };
}
