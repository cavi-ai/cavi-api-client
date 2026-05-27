import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { OpenClawAgentConfigApiClient } from "./agent-config.js";
import { OpenClawApiClient } from "./client.js";
import { OpenClawMediaApiClient } from "./media.js";
import { OpenClawSseRunEventProvider } from "./sse-run-event-provider.js";
import { OpenClawWebSocketClient } from "./websocket.js";
import { OpenClawWikiApiClient } from "./wiki.js";

export const OPENCLAW_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "openclaw",
  aliases: ["open-claw"],
  createApiClient: (clientOptions) => new OpenClawApiClient(clientOptions),
  createWebSocketClient: (wsUrl, authToken, clientOptions) =>
    new OpenClawWebSocketClient(wsUrl, authToken, clientOptions),
  createSseRunEventProvider: (options) => new OpenClawSseRunEventProvider(options),
  createMediaClient: (clientOptions) => new OpenClawMediaApiClient(clientOptions),
  createWikiClient: (clientOptions) => new OpenClawWikiApiClient(clientOptions),
  createAgentConfigClient: (clientOptions) =>
    new OpenClawAgentConfigApiClient(clientOptions),
};
