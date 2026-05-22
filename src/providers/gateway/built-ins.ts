import { HermesAgentConfigApiClient } from "../hermes/agent-config.js";
import { HermesApiClient } from "../hermes/client.js";
import { HermesMediaApiClient } from "../hermes/media.js";
import { HermesSseRunEventProvider } from "../hermes/sse-run-event-provider.js";
import { HermesWebSocketClient } from "../hermes/websocket.js";
import { HermesWikiApiClient } from "../hermes/wiki.js";
import { OpenClawAgentConfigApiClient } from "../openclaw/agent-config.js";
import { OpenClawApiClient } from "../openclaw/client.js";
import { OpenClawMediaApiClient } from "../openclaw/media.js";
import { OpenClawSseRunEventProvider } from "../openclaw/sse-run-event-provider.js";
import { OpenClawWebSocketClient } from "../openclaw/websocket.js";
import { OpenClawWikiApiClient } from "../openclaw/wiki.js";
import type { GatewayProviderModule } from "./types.js";

export const GATEWAY_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "gateway",
  aliases: ["generic"],
};

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

export const BUILT_IN_GATEWAY_PROVIDER_MODULES: readonly GatewayProviderModule[] = [
  GATEWAY_PROVIDER_MODULE,
  HERMES_PROVIDER_MODULE,
  OPENCLAW_PROVIDER_MODULE,
];
