import {
  GatewayWebSocketClient,
  type GatewayWebSocketClientOptions,
} from "../../core/ws/index.js";
import type {
  GatewayPreauthHandshakeEnv,
  GatewayPreauthHandshakeEnvKeys,
} from "../../core/gateway/rpc/index.js";
import type {
  OpenClawRpc,
  OpenClawRpcEvent,
} from "./control-plane/rpc.js";
import type { RawGatewayConnectionState } from "../../core/runtime/control-plane/raw-gateway.js";

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
    // OpenClaw's gateway validates the connect frame id against the advertised
    // client id, so the handshake must correlate on clientId rather than a
    // monotonic id. Core stays neutral; the provider opts in here.
    connectFrameId: options.connectFrameId ?? "client-id",
    preauthHandshakeEnv:
      options.preauthHandshakeEnv ?? readOpenClawHandshakeEnv(),
    preauthHandshakeEnvKeys:
      options.preauthHandshakeEnvKeys ?? OPENCLAW_PREAUTH_HANDSHAKE_ENV_KEYS,
  };
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(abortError());
    signal.addEventListener("abort", abort, { once: true });
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
    };
    void promise.then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}

export class OpenClawWebSocketClient
  extends GatewayWebSocketClient
  implements OpenClawRpc
{
  constructor(
    wsUrl: string,
    authToken: string | null,
    options: OpenClawWebSocketClientOptions = {},
  ) {
    super(wsUrl, authToken, withOpenClawDefaults(options));
  }

  override request<TPayload>(
    method: string,
    params: Record<string, unknown> = {},
    options?: { signal?: AbortSignal },
  ): Promise<TPayload> {
    if (options?.signal?.aborted) return Promise.reject(abortError());
    return withAbort(super.request<TPayload>(method, params), options?.signal);
  }

  subscribe(listener: (event: OpenClawRpcEvent) => void): () => void {
    return this.onEvent(listener);
  }

  onConnectionState(listener: (state: RawGatewayConnectionState, error?: unknown) => void): () => void {
    return this.onStateChange((state, error) => listener(state, error ?? undefined));
  }

  dispose(): Promise<void> {
    return this.close();
  }
}
