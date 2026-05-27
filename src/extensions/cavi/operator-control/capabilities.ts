import type { GatewayCapabilities } from "../../../core/gateway/client/client.js";
import {
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST,
} from "../contracts/paths.js";

/**
 * Augment a base provider/gateway capabilities object with the CAVI Control
 * operator plane (status / snapshot / tasks endpoints + operator RPC methods).
 *
 * This is **plugin-gated**: the operator plane only exists when the cavi-control
 * plugin is installed on the target harness (the same cavi-control plugin runs on
 * OpenClaw and Hermes). It deliberately lives in `extensions/cavi`, not
 * in any provider, so the base OpenClaw/Hermes clients never assume a CAVI plugin
 * is present. A consumer that runs the plugin composes the operator surface on
 * top of the harness-native capabilities here.
 *
 * Provider-agnostic by design — pass any `GatewayCapabilities` (OpenClaw, Hermes,
 * or another harness) and get the same operator augmentation.
 */
export function withCaviControlOperatorCapabilities<
  T extends GatewayCapabilities & { rpcMethods?: readonly string[] },
>(base: T): T {
  return {
    ...base,
    features: { ...base.features, caviControlOperator: true },
    endpoints: {
      ...base.endpoints,
      caviOperatorStatus: { method: "GET", path: CAVI_CONTROL_OPERATOR_API.status },
      caviOperatorSnapshot: {
        method: "GET",
        path: CAVI_CONTROL_OPERATOR_API.snapshot,
      },
      caviOperatorTasks: { method: "POST", path: CAVI_CONTROL_OPERATOR_API.tasks },
    },
    runtime: {
      ...base.runtime,
      caviControlOperator: {
        transport: "websocket-rpc",
        httpBase: CAVI_CONTROL_OPERATOR_API.root,
      },
    },
    rpcMethods: [
      ...new Set([
        ...(base.rpcMethods ?? []),
        ...CAVI_CONTROL_OPERATOR_RPC_METHOD_LIST,
      ]),
    ],
  };
}
