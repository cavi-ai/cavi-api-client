import {
  createUnavailableRuntimeControlClient,
  type RuntimeControlClient,
} from "../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeControlClientOptions } from "../../../core/runtime/providers/types.js";
import { OpenClawWebSocketClient } from "../websocket.js";
import {
  createOpenClawAuthStatusClient,
  createOpenClawModelCatalogClient,
} from "./auth-models.js";
import type { OpenClawRpc } from "./rpc.js";
import { resolveTransportHeaders } from "../../../core/transport/auth.js";
import { TransportError } from "../../../core/transport/error.js";
import { isAbortError } from "../../../core/errors.js";
import { normalizeTransportAbort, validateTransportRetryPolicy } from "../../../core/transport/backoff.js";
import { createOpenClawRuntimeEventClient } from "./events.js";
import { createOpenClawSessionClient } from "./sessions.js";
import { createOpenClawTaskClient } from "./tasks.js";
import { createOpenClawUsageClient } from "./usage.js";
import { createOpenClawWorkspaceClient } from "./workspace.js";
import { createOpenClawRawGatewayChannel } from "./raw-gateway.js";
import {
  createRawGatewayDisposer,
  GATEWAY_RAW_EXTENSION,
} from "../../../core/runtime/control-plane/raw-gateway.js";
import { withRuntimeControlExtensions } from "../../../core/runtime/control-plane/extensions.js";

const OPENCLAW_CONTROL_PLANE_CLIENT_ID = "openclaw-control-ui";

export type OpenClawRuntimeControlClientOptions = RuntimeControlClientOptions & {
  rpc?: OpenClawRpc;
  takeRpcOwnership?: boolean;
};

function isOpenClawRpc(value: unknown): value is OpenClawRpc {
  if (value === null || typeof value !== "object") return false;
  const candidate = value as Partial<OpenClawRpc>;
  return typeof candidate.request === "function"
    && typeof candidate.subscribe === "function"
    && typeof candidate.dispose === "function";
}

function resolveWebSocketUrl(options: OpenClawRuntimeControlClientOptions): string {
  if (options.webSocketUrl) return options.webSocketUrl;
  if (!options.baseUrl) {
    throw new TypeError("OpenClaw control plane requires webSocketUrl or baseUrl");
  }

  const url = new URL(options.baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function bearerToken(headers: Readonly<Record<string, string>>): string | undefined {
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === "authorization");
  if (!entry) return undefined;
  const match = /^Bearer\s+(.+)$/iu.exec(entry[1].trim());
  return match?.[1];
}

export async function createOpenClawRuntimeControlClient(
  options: OpenClawRuntimeControlClientOptions = {},
): Promise<RuntimeControlClient> {
  const injectedTransport = isOpenClawRpc(options.transport) ? options.transport : undefined;
  const injectedRpc = options.rpc ?? injectedTransport;
  const createdRpc = injectedRpc === undefined;
  const ownsRpc = createdRpc || options.takeRpcOwnership === true;
  if (createdRpc && options.gatewayReconnect) validateTransportRetryPolicy(options.gatewayReconnect);
  if (createdRpc && options.signal?.aborted) throw normalizeTransportAbort(options.signal);
  let resolvedHeaders: Record<string, string> = {};
  if (createdRpc) {
    try {
      resolvedHeaders = await resolveTransportHeaders(
        options.token === undefined ? {} : { Authorization: `Bearer ${options.token}` },
        options.resolveAuth,
      );
    } catch (error) {
      if (isAbortError(error) || options.signal?.aborted) throw normalizeTransportAbort(options.signal, error);
      throw new TransportError("Transport authentication failed", {
        metadata: {
          kind: "websocket",
          phase: "authenticate",
          operation: "openclaw.connect",
          retryable: false,
          attempt: 1,
        },
      });
    }
  }
  if (createdRpc && options.signal?.aborted) throw normalizeTransportAbort(options.signal);
  const ownedClient = createdRpc
    ? new OpenClawWebSocketClient(
        resolveWebSocketUrl(options),
        bearerToken(resolvedHeaders) ?? null,
        {
          ...options.gatewayConnection,
          clientId: options.gatewayConnection?.clientId ?? OPENCLAW_CONTROL_PLANE_CLIENT_ID,
        },
      )
    : undefined;
  const rpc = injectedRpc ?? ownedClient;
  if (!rpc) throw new TypeError("OpenClaw control plane RPC initialization failed");

  if (ownedClient) {
    await ownedClient.connect();
  }

  const plane = createUnavailableRuntimeControlClient(
    "openclaw",
    new Set<string>(),
  );
  const disposeRpc = createRawGatewayDisposer(
    ownsRpc ? () => rpc.dispose() : () => undefined,
  );
  const rawGateway = createOpenClawRawGatewayChannel(rpc, {
    connect: rpc.connect?.bind(rpc) ?? (() => Promise.resolve()),
    getConnectionState: rpc.getConnectionState?.bind(rpc) ?? (() => "connected"),
    onConnectionState: rpc.onConnectionState?.bind(rpc) ?? (() => () => undefined),
    dispose: disposeRpc,
  }, createdRpc ? options.gatewayReconnect : undefined);

  const client: RuntimeControlClient = {
    ...plane,
    authStatus: createOpenClawAuthStatusClient(rpc),
    events: createOpenClawRuntimeEventClient(rpc),
    models: createOpenClawModelCatalogClient(rpc),
    sessions: createOpenClawSessionClient(rpc),
    tasks: createOpenClawTaskClient(rpc),
    usage: createOpenClawUsageClient(rpc),
    workspace: createOpenClawWorkspaceClient(rpc),
    dispose(): Promise<void> {
      return rawGateway.dispose();
    },
  };
  return withRuntimeControlExtensions(client, [[GATEWAY_RAW_EXTENSION, rawGateway]]);
}
