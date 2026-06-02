import type { GatewayProviderModule } from "../../core/gateway/providers/index.js";
import { OpenClawAgentConfigApiClient } from "./agent-config.js";
import { OpenClawApiClient } from "./client.js";
import { OpenClawMediaApiClient } from "./media.js";
import { OpenClawSseRunEventProvider } from "./sse-run-event-provider.js";
import { OpenClawWebSocketClient } from "./websocket.js";
import { OpenClawWikiApiClient } from "./wiki.js";

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
  createApiClient: (clientOptions) => new OpenClawApiClient(clientOptions),
  createWebSocketClient: (wsUrl, authToken, clientOptions) =>
    new OpenClawWebSocketClient(wsUrl, authToken, clientOptions),
  createSseRunEventProvider: (options) => new OpenClawSseRunEventProvider(options),
  createMediaClient: (clientOptions) => new OpenClawMediaApiClient(clientOptions),
  createWikiClient: (clientOptions) => new OpenClawWikiApiClient(clientOptions),
  createAgentConfigClient: (clientOptions) =>
    new OpenClawAgentConfigApiClient(clientOptions),
};
