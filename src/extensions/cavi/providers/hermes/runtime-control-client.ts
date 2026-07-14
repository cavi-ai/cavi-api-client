import type { RuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import { createUnavailableRuntimeControlClient } from "../../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeControlClientOptions } from "../../../../core/runtime/providers/types.js";
import type { TransportMessageChannel } from "../../../../core/transport/channel.js";
import { createWebSocketTransport } from "../../../../core/transport/websocket.js";
import {
  createCaviControlAdapters,
} from "../../adapters/create-cavi-control-adapters.js";
import { createHermesAuthStatusClient } from "./auth-status.js";
import { createHermesDashboardJsonRpcClient } from "./dashboard-json-rpc.js";
import { createHermesDashboardRestClient } from "./dashboard-rest.js";
import { createHermesRuntimeEventClient } from "./events.js";
import { createHermesModelCatalogClient } from "./models.js";
import { createHermesSessionOperations } from "./session-operations.js";
import { createHermesSessionClient } from "./sessions.js";
import { createHermesCaviTaskClient } from "./tasks.js";
import { createHermesUsageClient } from "./usage.js";
import { createHermesCaviWorkspaceClient } from "./workspace.js";

export type CaviControlAdapterOptions = Parameters<typeof createCaviControlAdapters>[0];

export interface HermesCaviRuntimeControlOptions {
  dashboardBaseUrl: string;
  dashboardWebSocketUrl?: string;
  dashboardToken?: string;
  fetch?: typeof globalThis.fetch;
  channel?: TransportMessageChannel<unknown>;
  ownsChannel?: boolean;
  signal?: AbortSignal;
  cavi?: CaviControlAdapterOptions;
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason;
}

export async function createHermesRuntimeControlClient(
  options: RuntimeControlClientOptions & HermesCaviRuntimeControlOptions,
): Promise<RuntimeControlClient> {
  throwIfAborted(options.signal);
  const unavailable = createUnavailableRuntimeControlClient("hermes", new Set());
  const dashboardBaseUrl = options.dashboardBaseUrl.trim();
  if (dashboardBaseUrl.length === 0) return unavailable;

  const resolvedAuth = options.dashboardToken === undefined
    ? await options.resolveAuth?.()
    : undefined;
  throwIfAborted(options.signal);
  const resolvedHeaders = resolvedAuth?.headers === undefined
    ? undefined
    : { ...resolvedAuth.headers };

  const rest = createHermesDashboardRestClient({
    baseUrl: dashboardBaseUrl,
    authToken: resolvedHeaders === undefined
      ? options.dashboardToken ?? options.token ?? null
      : null,
    defaultHeaders: resolvedHeaders,
    fetchImpl: options.fetch,
  });
  let sessions = unavailable.sessions;
  let events = unavailable.events;
  let tasks = unavailable.tasks;
  let workspace = unavailable.workspace;
  const usage = createHermesUsageClient({ rest });

  let rpc: ReturnType<typeof createHermesDashboardJsonRpcClient> | undefined;
  try {
    let channel = options.channel;
    let ownsChannel = options.ownsChannel === true;
    if (!channel && options.dashboardWebSocketUrl?.trim()) {
      const internal = createWebSocketTransport({ onLifecycleEvent: options.trace }).connect({
        url: options.dashboardWebSocketUrl,
        signal: options.signal,
      });
      channel = internal;
      ownsChannel = true;
      await internal.ready;
      throwIfAborted(options.signal);
    }
    if (channel) {
      rpc = createHermesDashboardJsonRpcClient({ channel, ownsChannel });
      sessions = createHermesSessionClient(createHermesSessionOperations({ rpc, rest }));
      events = createHermesRuntimeEventClient(rpc);
    }
    if (options.cavi) {
      const adapters = createCaviControlAdapters(options.cavi);
      tasks = createHermesCaviTaskClient(adapters);
      workspace = createHermesCaviWorkspaceClient(adapters);
    }
    throwIfAborted(options.signal);
  } catch (error) {
    await rpc?.dispose();
    throw error;
  }

  let disposePromise: Promise<void> | undefined;
  const dispose = () => {
    disposePromise ??= rpc?.dispose() ?? Promise.resolve();
    return disposePromise;
  };
  return {
    authStatus: createHermesAuthStatusClient(rest),
    sessions,
    models: createHermesModelCatalogClient(rest),
    usage,
    tasks,
    workspace,
    events,
    dispose,
  };
}
