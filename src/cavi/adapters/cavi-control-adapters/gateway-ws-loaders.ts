import type { GatewayRpcClient } from "../../../core/gateway/rpc.js";
import { createSessionLoaders } from "../../../core/gateway/session-loaders.js";
import type { JsonHttpRequest } from "../../../core/http/json-client.js";
import { createGatewayWsSnapshotLoaders } from "./gateway-ws-snapshot-loaders.js";
import { createGatewayWsSystemLoaders } from "./gateway-ws-system-loaders.js";

export function createGatewayWsLoaders(deps: {
  client: GatewayRpcClient | null | undefined;
  requestJson: JsonHttpRequest;
}) {
  const { client, requestJson } = deps;
  const sessionLoaders = createSessionLoaders(client);
  const systemLoaders = createGatewayWsSystemLoaders(client);
  const snapshotLoaders = createGatewayWsSnapshotLoaders({
    sessionLoaders,
    systemLoaders,
    requestJson,
  });

  return {
    loadSessionsListRaw: sessionLoaders.loadSessionsListRaw,
    loadSessionsUsageRaw: sessionLoaders.loadSessionsUsageRaw,
    loadSessionsPreviewRaw: sessionLoaders.loadSessionsPreviewRaw,
    loadSessionDetailRaw: sessionLoaders.loadSessionDetailRaw,
    ...snapshotLoaders,
  };
}
