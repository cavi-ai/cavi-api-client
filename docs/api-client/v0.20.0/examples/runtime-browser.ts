import { createApiClient } from "@cavi-ai/api-client";

export function createBrowserGateway(baseUrl: string, token: string) {
  // Supply a user-scoped gateway token; keep provider API keys on your server.
  return createApiClient("openclaw", {
    baseUrl,
    token,
    clientMode: "webchat",
    requestedScopes: ["operator.read"],
  });
}
