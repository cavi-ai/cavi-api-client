import type { GatewayRpcClient } from "../../core/gateway/rpc.js";
import type { TaskDiscourseSnapshot } from "../domain/index.js";
import { operatorTaskDiscoursePath } from "../data/cavi-control/api-paths.js";
import type { CaviControlRequestJson } from "../data/cavi-control/http-client.js";
import { GATEWAY_RPC_METHODS } from "./contracts.js";
import { normalizeTaskDiscourseSnapshot } from "./normalize.js";

export async function loadTaskDiscourseLive(
  requestJson: CaviControlRequestJson,
  wsClient: GatewayRpcClient | null | undefined,
  taskId: string,
): Promise<TaskDiscourseSnapshot> {
  const normalizedTaskId = taskId.trim();
  if (!normalizedTaskId) {
    throw new Error("Task id is required.");
  }

  if (wsClient) {
    try {
      const rpcPayload = await wsClient.request<unknown>(
        GATEWAY_RPC_METHODS.discourseTree,
        {
          taskId: normalizedTaskId,
        },
      );
      return normalizeTaskDiscourseSnapshot(rpcPayload, normalizedTaskId);
    } catch {
      // Ignore WS RPC failures and continue with HTTP fallback.
    }
  }

  const httpPayload = await requestJson<unknown>(
    operatorTaskDiscoursePath(normalizedTaskId),
  );
  return normalizeTaskDiscourseSnapshot(httpPayload, normalizedTaskId);
}
