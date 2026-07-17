import type { RuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import {
  CapabilityUnavailable,
  createUnavailableRuntimeControlClient,
} from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { withRuntimeControlExtensions } from "../../../../core/runtime/control-plane/extensions.js";
import {
  GATEWAY_RAW_EXTENSION,
  type RawGatewayChannel,
  type RawGatewayConnectionState,
} from "../../../../core/runtime/control-plane/raw-gateway.js";
import type { RuntimeControlClientOptions } from "../../../../core/runtime/providers/types.js";
import type { TransportMessageChannel } from "../../../../core/transport/channel.js";
import { createWebSocketTransport } from "../../../../core/transport/websocket.js";
import {
  createCaviControlAdapters,
  type CaviControlAdapterOptions,
} from "../../adapters/create-cavi-control-adapters.js";
import { createHermesAuthStatusClient } from "../../../../providers/hermes/control-plane/auth-status.js";
import { createHermesDashboardJsonRpcClient } from "../../../../providers/hermes/control-plane/dashboard-json-rpc.js";
import { createHermesDashboardRestClient } from "../../../../providers/hermes/control-plane/dashboard-rest.js";
import { createHermesRawGatewayChannel } from "../../../../providers/hermes/control-plane/raw-gateway.js";
import { createHermesRuntimeEventClient } from "../../../../providers/hermes/control-plane/events.js";
import { createHermesModelCatalogClient } from "../../../../providers/hermes/control-plane/models.js";
import { createHermesSessionOperations } from "../../../../providers/hermes/control-plane/session-operations.js";
import { createHermesSessionClient } from "../../../../providers/hermes/control-plane/sessions.js";
import { createHermesCaviTaskClient } from "./tasks.js";
import { createHermesUsageClient } from "../../../../providers/hermes/control-plane/usage.js";
import { createHermesCaviWorkspaceClient } from "./workspace.js";
import { createHermesApiServerControlPlane } from "../../../../providers/hermes/control-plane/api-server-rest.js";
import { createHermesApiServerEventClient } from "../../../../providers/hermes/control-plane/api-server-events.js";

export interface HermesApiServerRunEventBinding {
  runId: string;
  sessionKey: string;
  clientId: string;
}

export interface HermesCaviRuntimeControlOptions {
  dashboardBaseUrl?: string;
  dashboardWebSocketUrl?: string;
  dashboardToken?: string;
  fetch?: typeof globalThis.fetch;
  channel?: TransportMessageChannel<unknown>;
  ownsChannel?: boolean;
  signal?: AbortSignal;
  cavi?: CaviControlAdapterOptions;
  /** Opt-in SSE binding for a caller-owned, already existing API Server run. */
  apiServerRunEvents?: HermesApiServerRunEventBinding;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason;
}

function bearerFromHeaders(headers: Record<string, string> | undefined): string | undefined {
  if (!headers) return undefined;
  const value = new Headers(headers).get("authorization")?.trim() ?? "";
  const match = /^Bearer\s+(.+)$/iu.exec(value);
  return match?.[1];
}

function findSuppliedGatewayConnectionField(
  options: RuntimeControlClientOptions["gatewayConnection"],
): string | undefined {
  for (const [field, value] of Object.entries(options ?? {})) {
    if (value === undefined) continue;
    // Mirror only the shared RPC normalizers that make values equivalent to
    // omission. Do not apply broad truthiness: protocol zero, false, blank
    // client identity, and an empty env map retain distinct RPC semantics.
    if (
      (field === "requestedScopes" || field === "defaultRequestedScopes")
      && Array.isArray(value)
      && value.every((scope) => typeof scope === "string" && scope.trim().length === 0)
    ) continue;
    if (
      (field === "requestTimeoutMs"
        || field === "maxConcurrentRequests"
        || field === "preauthHandshakeTimeoutMs")
      && value === 0
    ) continue;
    return field;
  }
  return undefined;
}

type Cleanup = Readonly<{ disarm(): void }>;

function createCleanupStack(): {
  register(cleanup: () => Promise<void>): Cleanup;
  unwind(): Promise<void>;
} {
  const entries: Array<{ active: boolean; cleanup: () => Promise<void> }> = [];
  return {
    register(cleanup) {
      const entry = { active: true, cleanup };
      entries.push(entry);
      return {
        disarm: () => { entry.active = false; },
      };
    },
    async unwind() {
      let firstError: unknown;
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const entry = entries[index];
        if (!entry?.active) continue;
        entry.active = false;
        try {
          await entry.cleanup();
        } catch (error) {
          firstError ??= error;
        }
      }
      if (firstError !== undefined) throw new Error("Hermes runtime control cleanup failed");
    },
  };
}

export async function createHermesRuntimeControlClient(
  options: RuntimeControlClientOptions & HermesCaviRuntimeControlOptions,
): Promise<RuntimeControlClient> {
  if (options.gatewayReconnect !== undefined) {
    throw new CapabilityUnavailable("hermes", "runtimeControl.gatewayReconnect");
  }
  const unsupportedGatewayConnectionField = findSuppliedGatewayConnectionField(
    options.gatewayConnection,
  );
  if (unsupportedGatewayConnectionField !== undefined) {
    throw new CapabilityUnavailable(
      "hermes",
      `runtimeControl.gatewayConnection.${unsupportedGatewayConnectionField}`,
    );
  }
  throwIfAborted(options.signal);
  const unavailable = createUnavailableRuntimeControlClient("hermes", new Set());
  const cleanup = createCleanupStack();
  const dashboardBaseUrl = options.dashboardBaseUrl?.trim() ?? "";
  const dashboardWebSocketUrl = options.dashboardWebSocketUrl?.trim() ?? "";
  let authStatus = unavailable.authStatus;
  let sessions = unavailable.sessions;
  let models = unavailable.models;
  let usage = unavailable.usage;
  let events = unavailable.events;
  let tasks = unavailable.tasks;
  let workspace = unavailable.workspace;
  let rawGateway: RawGatewayChannel | undefined;
  let channel = options.channel;
  let ownsChannel = options.ownsChannel === true;
  let directChannelCleanup: Cleanup | undefined;
  if (channel && ownsChannel) {
    const ownedChannel = channel;
    directChannelCleanup = cleanup.register(() => ownedChannel.close());
  }
  try {
    const apiServerBaseUrl = options.baseUrl?.trim() ?? "";
    const needsResolvedAuth = apiServerBaseUrl.length > 0
      || (dashboardBaseUrl.length > 0 && options.dashboardToken === undefined);
    const resolvedAuth = needsResolvedAuth
      ? await options.resolveAuth?.()
      : undefined;
    throwIfAborted(options.signal);
    const resolvedHeaders = resolvedAuth?.headers === undefined
      ? undefined
      : { ...resolvedAuth.headers };
    const apiServerHeaders = resolvedHeaders === undefined
      ? undefined
      : (() => {
        const headers = new Headers(resolvedHeaders);
        if ((headers.get("authorization")?.trim() ?? "").length === 0 && options.token !== undefined) {
          headers.set("authorization", `Bearer ${options.token}`);
        }
        return Object.fromEntries(headers.entries());
      })();
    const dashboardHeaders = options.dashboardToken === undefined ? apiServerHeaders : undefined;
    const rest = dashboardBaseUrl.length === 0
      ? undefined
      : createHermesDashboardRestClient({
        baseUrl: dashboardBaseUrl,
        authToken: dashboardHeaders === undefined
          ? options.dashboardToken ?? options.token ?? null
          : null,
        defaultHeaders: dashboardHeaders,
        fetchImpl: options.fetch,
      });
    if (apiServerBaseUrl.length > 0) {
      const apiServer = createHermesApiServerControlPlane({
        baseUrl: apiServerBaseUrl,
        token: apiServerHeaders === undefined ? options.token : undefined,
        defaultHeaders: apiServerHeaders,
        fetchImpl: options.fetch,
      });
      await apiServer.probe();
      models = apiServer.models;
      sessions = apiServer.sessions;
      usage = apiServer.usage;
      if (options.apiServerRunEvents) {
        const apiServerEvents = createHermesApiServerEventClient({
          ...options.apiServerRunEvents,
          baseUrl: apiServerBaseUrl,
          token: bearerFromHeaders(apiServerHeaders) ?? options.token ?? null,
          fetchImpl: options.fetch,
        });
        events = apiServerEvents;
        cleanup.register(() => apiServerEvents.dispose());
      }
    }
    if (rest) {
      authStatus = createHermesAuthStatusClient(rest);
      if (apiServerBaseUrl.length === 0) {
        models = createHermesModelCatalogClient(rest);
        usage = createHermesUsageClient({ rest });
      }
    }
    if (!channel && dashboardWebSocketUrl.length > 0) {
      const internal = createWebSocketTransport({ onLifecycleEvent: options.trace }).connect({
        url: dashboardWebSocketUrl,
        signal: options.signal,
      });
      channel = internal;
      ownsChannel = true;
      directChannelCleanup = cleanup.register(() => internal.close());
      await internal.ready;
      throwIfAborted(options.signal);
    }
    if (channel) {
      const rpc = createHermesDashboardJsonRpcClient({ channel, ownsChannel });
      directChannelCleanup?.disarm();
      let connectionState: RawGatewayConnectionState = "connected";
      const stateListeners = new Set<(state: RawGatewayConnectionState) => void>();
      const notifyState = (state: RawGatewayConnectionState): void => {
        connectionState = state;
        for (const listener of [...stateListeners]) {
          try { listener(state); } catch { /* Lifecycle subscribers are isolated. */ }
        }
      };
      let unsubscribeClose: (() => void) | undefined;
      unsubscribeClose = channel.subscribeClose(() => notifyState("error"));
      const channelRawGateway = createHermesRawGatewayChannel(rpc, {
        connect: async () => {
          if (connectionState === "connected") return;
          throw new CapabilityUnavailable("hermes", "gateway.raw.reconnect");
        },
        getConnectionState: () => connectionState,
        onConnectionState(listener) {
          stateListeners.add(listener);
          return () => { stateListeners.delete(listener); };
        },
        async dispose() {
          unsubscribeClose?.();
          unsubscribeClose = undefined;
          stateListeners.clear();
          await rpc.dispose();
        },
      });
      rawGateway = channelRawGateway;
      cleanup.register(() => channelRawGateway.dispose());
      events = createHermesRuntimeEventClient(rpc);
      if (rest && apiServerBaseUrl.length === 0) sessions = createHermesSessionClient(createHermesSessionOperations({ rpc, rest }));
    }
    if (options.cavi) {
      const adapters = createCaviControlAdapters(options.cavi);
      tasks = createHermesCaviTaskClient(adapters);
      workspace = createHermesCaviWorkspaceClient(adapters);
    }
    throwIfAborted(options.signal);
  } catch (error) {
    try {
      await cleanup.unwind();
    } catch {
      // Cleanup is best effort and must never replace the primary construction error.
    }
    throw error;
  }

  let disposePromise: Promise<void> | undefined;
  const dispose = () => {
    disposePromise ??= cleanup.unwind();
    return disposePromise;
  };
  const client: RuntimeControlClient = {
    authStatus,
    sessions,
    models,
    usage,
    tasks,
    workspace,
    events,
    extensions: unavailable.extensions,
    dispose,
  };
  return rawGateway === undefined
    ? client
    : withRuntimeControlExtensions(client, [[GATEWAY_RAW_EXTENSION, rawGateway]]);
}
