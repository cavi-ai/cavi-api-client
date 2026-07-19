import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { OpenClawAgentConfigApiClient } from "./agent-config.js";
import { OpenClawApiClient } from "./client.js";
import { OpenClawMediaApiClient } from "./media.js";
import { OpenClawSseRunEventProvider } from "./sse-run-event-provider.js";
import { OpenClawWebSocketClient } from "./websocket.js";
import { OpenClawWikiApiClient } from "./wiki.js";
import { createOpenClawRuntimeControlClient } from "./control-plane/factory.js";

// One factory serves both the uniform runtime path (`createClient`, consumed by
// createRuntimeClient) and the gateway path (`createApiClient`, consumed by
// core/gateway/providers/factory). `createApiClient` is the deprecated alias.
const createClient: NonNullable<GatewayProviderModule["createApiClient"]> = (clientOptions) =>
  new OpenClawApiClient(clientOptions);

// The OpenClaw provider module supplies one concrete implementation per
// unified capability interface (GatewayApiClient, GatewayMediaClient,
// GatewayWikiClient, GatewayAgentConfigClient). Each dispatcher routes the
// UI's unified call to OpenClaw's native surface — chat.send / agent.wait
// / tts.convert (RPC) — rather than re-aliasing the generic v1 media or
// v1 wiki REST paths (which OpenClaw does not serve; see
// OPENCLAW_MANIFEST.rest).
//
// Capability slots that OpenClaw core doesn't natively cover (image / video
// generation, wiki, etc.) throw a typed EndpointNotFound until a plugin
// manifest (cavi-control or otherwise) layers routes on at the extension
// layer. The api-client never silently hits a non-existent route.
export const OPENCLAW_PROVIDER_MODULE: GatewayProviderModule = {
  kind: "openclaw",
  aliases: ["open-claw"],
  controlPlane: {
    transports: {
      websocket: { kind: "websocket", stability: "stable", authenticated: true, reconnect: true },
    },
    modules: {
      sessions: true, models: true, usage: true, tasks: true,
      workspace: true, authStatus: true, events: true,
    },
  },
  createRuntimeControlClient: createOpenClawRuntimeControlClient,
  createClient,
  createApiClient: createClient,
  createWebSocketClient: (wsUrl, authToken, clientOptions) =>
    new OpenClawWebSocketClient(wsUrl, authToken, clientOptions),
  createSseRunEventProvider: (options) => new OpenClawSseRunEventProvider(options),
  createMediaClient: (clientOptions) => new OpenClawMediaApiClient(clientOptions),
  createWikiClient: (clientOptions) => new OpenClawWikiApiClient(clientOptions),
  createAgentConfigClient: (clientOptions) =>
    new OpenClawAgentConfigApiClient(clientOptions),
};
