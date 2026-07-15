import { describe, expect, it, vi } from "vitest";

import { GatewayRpcError } from "../../core/gateway/rpc/error.js";
import type {
  RawGatewayConnectionState,
  RawGatewayEvent,
} from "../../core/runtime/control-plane/raw-gateway.js";
import { GATEWAY_RAW_EXTENSION } from "../../core/runtime/control-plane/raw-gateway.js";
import { TransportError } from "../../core/transport/error.js";
import { createHermesRawGatewayChannel } from "../../extensions/cavi/providers/hermes/raw-gateway.js";
import type {
  HermesDashboardEvent,
  HermesDashboardJsonRpcClient,
} from "../../extensions/cavi/providers/hermes/types.js";
import { createOpenClawRawGatewayChannel } from "../../providers/openclaw/control-plane/raw-gateway.js";
import type { OpenClawRpc, OpenClawRpcEvent } from "../../providers/openclaw/control-plane/rpc.js";
import {
  runRawGatewayConformance,
  type RawGatewayConformanceFixture,
} from "../../testing/raw-gateway-conformance.js";

const RESPONSE = Object.freeze({ accepted: true });
const UNSUPPORTED_OPERATION = "future.unsupported";
const DISPOSAL_ERROR = new Error("expected conformance disposal rejection");
const ORDINARY_ERROR = new Error("ordinary provider failure");
const ORDINARY_OPERATION = "conformance.ordinary-error";

function openClawFixture(): RawGatewayConformanceFixture {
  const eventListeners = new Set<(event: OpenClawRpcEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  let state: RawGatewayConnectionState = "idle";
  let disposals = 0;
  const rpc: OpenClawRpc = {
    request: vi.fn(async (operationId) => {
      if (operationId === UNSUPPORTED_OPERATION) {
        throw new GatewayRpcError(`unknown method: ${operationId}`, "invalid_request");
      }
      if (operationId === ORDINARY_OPERATION) throw ORDINARY_ERROR;
      return RESPONSE;
    }),
    subscribe(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    dispose: vi.fn(async () => undefined),
  };
  let connects = 0;
  const channel = createOpenClawRawGatewayChannel(rpc, {
    connect: async () => { connects += 1; },
    getConnectionState: () => state,
    onConnectionState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    dispose: async () => { disposals += 1; throw DISPOSAL_ERROR; },
  });
  return {
    channel,
    descriptor: GATEWAY_RAW_EXTENSION,
    response: RESPONSE,
    ordinaryError: ORDINARY_ERROR,
    ordinaryOperationId: ORDINARY_OPERATION,
    unsupportedOperationId: UNSUPPORTED_OPERATION,
    emitEvent(event) {
      for (const listener of [...eventListeners]) listener(event);
    },
    emitState(next) {
      state = next;
      for (const listener of [...stateListeners]) listener(next);
    },
    disposalCount: () => disposals,
    connectCount: () => connects,
    expectedDisposalError: DISPOSAL_ERROR,
  };
}

function hermesFixture(): RawGatewayConformanceFixture {
  const eventListeners = new Set<(event: HermesDashboardEvent) => void>();
  const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
  let state: RawGatewayConnectionState = "idle";
  let disposals = 0;
  const rpc: HermesDashboardJsonRpcClient = {
    async request(operationId) {
      if (operationId === UNSUPPORTED_OPERATION) {
        throw new TransportError("JSON-RPC method not found", {
          metadata: {
            kind: "json-rpc",
            phase: "request",
            operation: operationId,
            retryable: false,
            attempt: 1,
            code: -32601,
          },
        });
      }
      if (operationId === ORDINARY_OPERATION) throw ORDINARY_ERROR;
      return RESPONSE;
    },
    subscribe(listener) {
      eventListeners.add(listener);
      return () => eventListeners.delete(listener);
    },
    dispose: vi.fn(async () => undefined),
  };
  let connects = 0;
  const channel = createHermesRawGatewayChannel(rpc, {
    connect: async () => { connects += 1; },
    getConnectionState: () => state,
    onConnectionState(listener) {
      stateListeners.add(listener);
      return () => stateListeners.delete(listener);
    },
    dispose: async () => { disposals += 1; throw DISPOSAL_ERROR; },
  });
  return {
    channel,
    descriptor: GATEWAY_RAW_EXTENSION,
    response: RESPONSE,
    ordinaryError: ORDINARY_ERROR,
    ordinaryOperationId: ORDINARY_OPERATION,
    unsupportedOperationId: UNSUPPORTED_OPERATION,
    emitEvent(event) {
      for (const listener of [...eventListeners]) {
        listener({ type: event.event, payload: event.payload });
      }
    },
    emitState(next) {
      state = next;
      for (const listener of [...stateListeners]) listener(next);
    },
    disposalCount: () => disposals,
    connectCount: () => connects,
    expectedDisposalError: DISPOSAL_ERROR,
  };
}

describe.each([
  ["OpenClaw", openClawFixture],
  ["Hermes", hermesFixture],
] as const)("%s raw gateway shared conformance", (_label, createChannel) => {
  it("passes the provider-neutral request, event, state, abort, reconnect, and lifecycle contract", async () => {
    const report = await runRawGatewayConformance(createChannel);

    expect(report).toEqual({ valid: true, failures: [] });
  });
});

it("rejects a fixture that substitutes an equivalent-looking raw descriptor", async () => {
  const report = await runRawGatewayConformance(async () => ({
    ...openClawFixture(),
    descriptor: { id: "gateway.raw" },
  }));

  expect(report.valid).toBe(false);
  expect(report.failures).toContain("fixture did not use the canonical gateway.raw descriptor");
});
