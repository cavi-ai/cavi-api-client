import { describe, expect, it } from "vitest";
import {
  resolveDeviceTokenOnlyFallbackMs,
  resolveGatewayConnectScopes,
  resolvePreauthHandshakeTimeoutMs,
} from "../../../core/gateway/rpc/client";

describe("GatewayRpcClient override options", () => {
  it("lets callers override the default connect scopes", () => {
    expect(
      resolveGatewayConnectScopes({
        defaultRequestedScopes: ["operator.admin", "device.pair"],
      }),
    ).toEqual(["operator.admin", "device.pair"]);

    expect(
      resolveGatewayConnectScopes({
        requestedScopes: ["", "  "],
        defaultRequestedScopes: ["operator.admin"],
      }),
    ).toEqual(["operator.admin"]);
  });

  it("resolves pre-auth timing from provider-specific env keys", () => {
    const env = {
      PROVIDER_HANDSHAKE_TIMEOUT_MS: "6000",
      PROVIDER_TEST_HANDSHAKE_TIMEOUT_MS: "2500",
      PROVIDER_TEST: "1",
    };
    const envKeys = {
      timeoutMs: "PROVIDER_HANDSHAKE_TIMEOUT_MS",
      testTimeoutMs: "PROVIDER_TEST_HANDSHAKE_TIMEOUT_MS",
      testFlag: "PROVIDER_TEST",
    };

    expect(resolvePreauthHandshakeTimeoutMs({ env, envKeys })).toBe(6000);
    expect(
      resolvePreauthHandshakeTimeoutMs({
        env,
        envKeys,
        preauthHandshakeTimeoutMs: 7000,
      }),
    ).toBe(7000);
    expect(resolveDeviceTokenOnlyFallbackMs({ env, envKeys })).toBe(4000);
  });
});
