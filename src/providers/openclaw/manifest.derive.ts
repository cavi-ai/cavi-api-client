// Derived views of OPENCLAW_MANIFEST. No method strings are typed in this file
// — every value comes from the manifest. The provider client, the public
// `OPENCLAW_RPC_METHODS` table, and `OPENCLAW_DEFAULT_CAPABILITIES` all read
// from here so there is exactly one place to add or rename a method.

import {
  GATEWAY_PROBE_ENDPOINTS,
} from "../../contracts/paths.js";
import type {
  GatewayCapabilities,
  GatewayRunStatus,
} from "../../core/gateway/client/client.js";
import { OPENCLAW_MANIFEST } from "./manifest.js";

type RpcEntries = typeof OPENCLAW_MANIFEST.rpc;

type RpcMethodTable = {
  readonly [K in keyof RpcEntries]: RpcEntries[K]["method"];
};

function deriveRpcMethodTable(): RpcMethodTable {
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(OPENCLAW_MANIFEST.rpc)) {
    result[key] = entry.method;
  }
  return result as RpcMethodTable;
}

/**
 * Camel-keyed lookup table of every OpenClaw RPC method (`chatSend → "chat.send"`).
 * Derived from `OPENCLAW_MANIFEST.rpc`; never define a new method string here.
 */
export const OPENCLAW_RPC_METHODS = deriveRpcMethodTable();

/**
 * The advertised subset of OpenClaw RPC methods — `hello-ok.features.methods`
 * filtered by `advertise !== false` in the upstream registry.
 */
export const OPENCLAW_CORE_RPC_METHODS: readonly string[] = Object.values(
  OPENCLAW_MANIFEST.rpc,
)
  .filter((entry) => entry.advertised)
  .map((entry) => entry.method);

export type OpenClawCapabilities = GatewayCapabilities & {
  object?: "openclaw.api_server.capabilities" | string;
  platform?: "openclaw" | string;
  rpcMethods?: readonly string[];
};

export type OpenClawRunStatus = GatewayRunStatus & {
  object?: "openclaw.run" | string;
};

/**
 * Manifest-time baseline capabilities. The real capability snapshot for a
 * connected gateway comes from the `hello-ok` WebSocket handshake — this blob
 * is the offline fallback when no live connection exists yet.
 */
export const OPENCLAW_DEFAULT_CAPABILITIES: OpenClawCapabilities = {
  object: "openclaw.api_server.capabilities",
  platform: "openclaw",
  features: {
    websocket: true,
    rpc: true,
    sessions: true,
    chat: true,
    config: true,
    models: true,
  },
  endpoints: {
    health: { method: "GET", path: GATEWAY_PROBE_ENDPOINTS.health },
    ready: { method: "GET", path: GATEWAY_PROBE_ENDPOINTS.readyz },
  },
  runtime: {
    transport: "websocket-rpc",
    httpCompatibility: "optional",
  },
  rpcMethods: [...OPENCLAW_CORE_RPC_METHODS],
};
