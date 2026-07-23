import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { GatewayApiClient } from "../../core/gateway/client/client.js";
import { GatewayMediaApiClient } from "../../core/gateway/resources/media.js";
import { GatewayWikiApiClient } from "../../core/gateway/resources/wiki.js";
import { GatewayWebSocketClient } from "../../core/ws/index.js";
import {
  HERMES_MEDIA_API_ENDPOINTS,
  HERMES_WIKI_API_ENDPOINTS,
} from "../../contracts/paths.js";
import { HermesAgentConfigApiClient } from "./agent-config.js";
import { HermesSseRunEventProvider } from "./sse-run-event-provider.js";
import { createHermesRuntimeControlClient } from "./control-plane/factory.js";

// One factory serves both the uniform runtime path (`createClient`, consumed by
// createRuntimeClient) and the gateway path (`createApiClient`, consumed by
// core/gateway/providers/factory). `createApiClient` is the deprecated alias.
// Hermes differs from the shared gateway bases by CONFIG only (surface tag +
// endpoint tables) — the former Hermes* subclasses were pure duplication.
const createClient: NonNullable<GatewayProviderModule["createApiClient"]> = (clientOptions) =>
  new GatewayApiClient(clientOptions, "hermes-api-server");

export const HERMES_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "hermes",
  aliases: ["hermes-api-server"],
  // Hermes serves its control plane from the dashboard API (sessions, models,
  // usage, provider-auth, JSON-RPC events) and the kanban plugin it ships
  // (tasks). `workspace` is served through the CAVI control plugin's member
  // workspace routes (verified live 2026-07-21; maintainer-confirmed).
  controlPlane: {
    transports: {
      websocket: { kind: "websocket", stability: "experimental", authenticated: true, reconnect: true },
    },
    modules: {
      sessions: true, models: true, usage: true, tasks: true,
      workspace: true, authStatus: true, events: true,
    },
  },
  createRuntimeControlClient: createHermesRuntimeControlClient,
  createClient,
  createApiClient: createClient,
  createWebSocketClient: (wsUrl, authToken, clientOptions) =>
    new GatewayWebSocketClient(wsUrl, authToken, clientOptions),
  createSseRunEventProvider: (options) => {
    const sessionKey = options.sessionKey?.trim();
    if (!sessionKey) {
      throw new Error("createGatewaySseRunEventProvider: Hermes requires sessionKey");
    }
    return new HermesSseRunEventProvider({ ...options, sessionKey });
  },
  createMediaClient: (clientOptions) =>
    new GatewayMediaApiClient(clientOptions, {
      endpoints: HERMES_MEDIA_API_ENDPOINTS,
      surface: "hermes-media-api",
    }),
  createWikiClient: (clientOptions) =>
    new GatewayWikiApiClient(clientOptions, {
      endpoints: HERMES_WIKI_API_ENDPOINTS,
      surface: "hermes-wiki-api",
    }),
  createAgentConfigClient: (clientOptions) =>
    new HermesAgentConfigApiClient(clientOptions),
};
