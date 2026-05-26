import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { HermesAgentConfigApiClient } from "./agent-config.js";
import { HermesApiClient } from "./client.js";
import { HermesMediaApiClient } from "./media.js";
import { HermesSseRunEventProvider } from "./sse-run-event-provider.js";
import { HermesWebSocketClient } from "./websocket.js";
import { HermesWikiApiClient } from "./wiki.js";

export const HERMES_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "hermes",
  aliases: ["hermes-api-server"],
  createApiClient: (clientOptions) => new HermesApiClient(clientOptions),
  createWebSocketClient: (wsUrl, authToken, clientOptions) =>
    new HermesWebSocketClient(wsUrl, authToken, clientOptions),
  createSseRunEventProvider: (options) => {
    const sessionKey = options.sessionKey?.trim();
    if (!sessionKey) {
      throw new Error("createGatewaySseRunEventProvider: Hermes requires sessionKey");
    }
    return new HermesSseRunEventProvider({ ...options, sessionKey });
  },
  createMediaClient: (clientOptions) => new HermesMediaApiClient(clientOptions),
  createWikiClient: (clientOptions) => new HermesWikiApiClient(clientOptions),
  createAgentConfigClient: (clientOptions) =>
    new HermesAgentConfigApiClient(clientOptions),
};
