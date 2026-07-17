import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { HermesAgentConfigApiClient } from "./agent-config.js";
import { HermesApiClient } from "./client.js";
import { HermesMediaApiClient } from "./media.js";
import { HermesSseRunEventProvider } from "./sse-run-event-provider.js";
import { HermesWebSocketClient } from "./websocket.js";
import { HermesWikiApiClient } from "./wiki.js";
import { createHermesRuntimeControlClient } from "./control-plane/factory.js";

export const HERMES_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "hermes",
  aliases: ["hermes-api-server"],
  // Hermes serves its control plane from the dashboard API (sessions, models,
  // usage, provider-auth, JSON-RPC events) and the kanban plugin it ships
  // (tasks). `workspace` has no native Hermes surface — agent workspace
  // identities come from the CAVI operator registry — so it is not declared;
  // calling it throws CapabilityUnavailable until an extension supplies it.
  controlPlane: {
    transports: {
      websocket: { kind: "websocket", stability: "experimental", authenticated: true, reconnect: true },
    },
    modules: {
      sessions: true, models: true, usage: true, tasks: true,
      authStatus: true, events: true,
    },
  },
  createRuntimeControlClient: createHermesRuntimeControlClient,
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
