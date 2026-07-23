import type { ProviderCapabilityResolver } from "../../contracts/capability-source.js";
import { transformOpenClawHello } from "./capabilities-transform.js";

/**
 * Anything that retains the gateway handshake — `GatewayRpcClient` (and the
 * OpenClaw WebSocket client extending it) satisfies this via `getHelloFrame`.
 */
export type OpenClawHelloSource = {
  getHelloFrame(): unknown;
  connect?(): Promise<void>;
};

export type CreateOpenClawCapabilityResolverOptions = {
  /** Manifest team id for this gateway instance. Defaults to the provider kind. */
  teamId?: string;
};

/**
 * Build the runtime capability resolver for an OpenClaw gateway: read the
 * retained hello-ok handshake (connecting first when the source can) and
 * transform it into the unified shape. The result is authoritative over the
 * static fallback (design decision M1).
 */
export function createOpenClawCapabilityResolver(
  source: OpenClawHelloSource,
  options: CreateOpenClawCapabilityResolverOptions = {},
): ProviderCapabilityResolver {
  return async () => {
    let hello = source.getHelloFrame();
    if ((hello === null || hello === undefined) && source.connect) {
      await source.connect();
      hello = source.getHelloFrame();
    }
    if (hello === null || hello === undefined) {
      throw new Error(
        "OpenClaw capability resolution requires a connected gateway handshake",
      );
    }
    return transformOpenClawHello(hello, {
      ...(options.teamId ? { teamId: options.teamId } : {}),
    });
  };
}
