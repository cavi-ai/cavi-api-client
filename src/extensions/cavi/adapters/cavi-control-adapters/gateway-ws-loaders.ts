import type { GatewayWebSocketClient } from "../../../../core/ws/index.js";
import {
  createSessionLoaders,
  type SessionLoaders,
} from "../../../../core/gateway/snapshots/session-loaders.js";
import { createGatewaySystemLoaders } from "../../../../core/gateway/snapshots/system-loaders.js";
import type { JsonHttpRequest } from "../../../../core/http/json-client.js";
import {
  createGatewayWsSnapshotLoaders,
  type CreateGatewayWsSnapshotLoadersOptions,
  type GatewayWsSnapshotLoaders,
} from "./gateway-ws-snapshot-loaders.js";

export type GatewayWsLoaders = GatewayWsSnapshotLoaders &
  Pick<
    SessionLoaders,
    | "loadSessionsListRaw"
    | "loadSessionsUsageRaw"
    | "loadSessionsPreviewRaw"
    | "loadSessionDetailRaw"
  > & {
    patchSessionRaw: SessionLoaders["patchSession"];
  };

export function createGatewayWsLoaders(deps: {
  client: GatewayWebSocketClient | null | undefined;
  requestJson: JsonHttpRequest;
  snapshotOptions?: CreateGatewayWsSnapshotLoadersOptions;
}): GatewayWsLoaders {
  const { client, requestJson } = deps;
  const sessionLoaders = createSessionLoaders(client, { requestJson });
  const systemLoaders = createGatewaySystemLoaders(client);
  const snapshotLoaders = createGatewayWsSnapshotLoaders({
    sessionLoaders,
    systemLoaders,
    requestJson,
    options: deps.snapshotOptions,
  });

  return {
    loadSessionsListRaw: sessionLoaders.loadSessionsListRaw,
    loadSessionsUsageRaw: sessionLoaders.loadSessionsUsageRaw,
    loadSessionsPreviewRaw: sessionLoaders.loadSessionsPreviewRaw,
    loadSessionDetailRaw: sessionLoaders.loadSessionDetailRaw,
    patchSessionRaw: sessionLoaders.patchSession,
    ...snapshotLoaders,
  };
}
