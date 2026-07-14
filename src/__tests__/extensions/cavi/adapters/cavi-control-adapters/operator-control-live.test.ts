import { describe, expect, it, vi } from "vitest";
import type { GatewayWebSocketClient } from "../../../../core/ws";
import type { JsonHttpRequest } from "../../../../core/http/json-client";
import { loadOperatorControlLive } from "../../../../../extensions/cavi/adapters/cavi-control-adapters/operator-control-live";
import {
  CAVI_CONTROL_OPERATOR_API as OPERATOR_API,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS as OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
  operatorControlExpectedContractSummary,
} from "../../../../../extensions/cavi/contracts/paths";

const operatorSnapshot = {
  status: {},
  registryDetail: {},
  tasks: {},
  memory: {},
  workerReady: {},
  workerTasks: {},
};

function createMockGatewayClient(
  handler: (method: string, params: Record<string, unknown>) => Promise<unknown>,
): GatewayWebSocketClient {
  return {
    request: vi.fn(handler),
  } as unknown as GatewayWebSocketClient;
}

describe("loadOperatorControlLive", () => {
  it("prefers the unified Caviclaw operator RPC snapshot method", async () => {
    const requestJson = vi.fn(async () => {
      throw new Error("unexpected HTTP fallback call");
    }) as JsonHttpRequest;
    const request = vi.fn(async (method: string, params: Record<string, unknown>) => {
      expect(method).toBe(CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot);
      expect(params).toMatchObject({
        taskLimit: expect.any(Number),
        memoryLimit: expect.any(Number),
        workerTaskLimit: expect.any(Number),
      });
      return operatorSnapshot;
    });

    const envelope = await loadOperatorControlLive(
      requestJson,
      createMockGatewayClient(request),
    );

    expect(envelope.source).toBe("gateway");
    expect(envelope.transports).toEqual({ tasks: "websocket", registryDetail: "websocket" });
    expect(request).toHaveBeenCalledOnce();
    expect(requestJson).not.toHaveBeenCalled();
  });

  it("falls back to the primary Cavi Control operator HTTP route", async () => {
    const requestJson = vi.fn(async () => operatorSnapshot) as JsonHttpRequest;

    const envelope = await loadOperatorControlLive(requestJson, null);

    expect(envelope.source).toBe("gateway");
    expect(envelope.transports).toEqual({ tasks: "http", registryDetail: "http" });
    expect(requestJson).toHaveBeenCalledWith(
      expect.stringContaining(`${OPERATOR_API.snapshot}?`),
    );
    expect(operatorControlExpectedContractSummary()).toContain(
      `WS ${CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot}`,
    );
    expect(operatorControlExpectedContractSummary()).toContain(
      `GET ${OPERATOR_API.snapshot}`,
    );
  });

  it("tries the cavi-control plugin alias when the primary operator HTTP route is unavailable", async () => {
    const requestJson = vi.fn(async (path: string) => {
      if (path.startsWith(OPERATOR_API.snapshot)) {
        throw new Error("primary unavailable");
      }
      if (path.startsWith(OPERATOR_API_PLUGIN_ALIAS.snapshot)) {
        return operatorSnapshot;
      }
      throw new Error(`unexpected HTTP path: ${path}`);
    }) as JsonHttpRequest;

    const envelope = await loadOperatorControlLive(requestJson, null);

    expect(envelope.source).toBe("gateway");
    expect(envelope.transports).toEqual({ tasks: "http", registryDetail: "http" });
    expect(requestJson).toHaveBeenCalledWith(
      expect.stringContaining(`${OPERATOR_API.snapshot}?`),
    );
    expect(requestJson).toHaveBeenCalledWith(
      expect.stringContaining(`${OPERATOR_API_PLUGIN_ALIAS.snapshot}?`),
    );
    expect(operatorControlExpectedContractSummary()).toContain(
      OPERATOR_API_PLUGIN_ALIAS.snapshot,
    );
  });
});
