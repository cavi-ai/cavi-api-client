import type { RuntimeProviderStability } from "./types.js";

export const RUNTIME_TRANSPORT_KINDS = [
  "http", "sse", "websocket", "json-rpc", "stdio", "unix-socket",
] as const;
export type RuntimeTransportKind = (typeof RUNTIME_TRANSPORT_KINDS)[number];
export type RuntimeTransportCapability = {
  kind: RuntimeTransportKind;
  stability: RuntimeProviderStability;
  authenticated: boolean;
  reconnect?: boolean;
  replay?: boolean;
  cancellation?: boolean;
};
export type RuntimeTransportCapabilities = Partial<
  Record<RuntimeTransportKind, RuntimeTransportCapability>
>;
export function runtimeTransportSupports(
  capabilities: RuntimeTransportCapabilities,
  kind: RuntimeTransportKind,
): boolean {
  return capabilities[kind]?.stability === "stable";
}
