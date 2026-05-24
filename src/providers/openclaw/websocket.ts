import {
  GatewayWebSocketClient,
  type GatewayWebSocketClientOptions,
} from "../../core/ws/index.js";
import type {
  GatewayPreauthHandshakeEnv,
  GatewayPreauthHandshakeEnvKeys,
} from "../../core/gateway/rpc/index.js";

export type OpenClawWebSocketClientOptions = GatewayWebSocketClientOptions;

const OPENCLAW_PREAUTH_HANDSHAKE_ENV_KEYS: GatewayPreauthHandshakeEnvKeys = {
  timeoutMs: "OPENCLAW_HANDSHAKE_TIMEOUT_MS",
  testTimeoutMs: "OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS",
  testFlag: "VITEST",
};

declare const process:
  | {
      env: Record<string, string | undefined>;
    }
  | undefined;

function readOpenClawHandshakeEnv(): GatewayPreauthHandshakeEnv | undefined {
  if (typeof process === "undefined") {
    return undefined;
  }
  return {
    OPENCLAW_HANDSHAKE_TIMEOUT_MS: process.env.OPENCLAW_HANDSHAKE_TIMEOUT_MS,
    OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS:
      process.env.OPENCLAW_TEST_HANDSHAKE_TIMEOUT_MS,
    VITEST: process.env.VITEST,
  };
}

function withOpenClawDefaults(
  options: OpenClawWebSocketClientOptions,
): OpenClawWebSocketClientOptions {
  return {
    ...options,
    preauthHandshakeEnv:
      options.preauthHandshakeEnv ?? readOpenClawHandshakeEnv(),
    preauthHandshakeEnvKeys:
      options.preauthHandshakeEnvKeys ?? OPENCLAW_PREAUTH_HANDSHAKE_ENV_KEYS,
  };
}

export class OpenClawWebSocketClient extends GatewayWebSocketClient {
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: OpenClawWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, withOpenClawDefaults(options));
  }
}
