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
  dashboardBaseUrl?: string;
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
  let channel = options.channel;
  let ownsChannel = options.ownsChannel === true;
  let directChannelCleanup: Cleanup | undefined;
  if (channel && ownsChannel) {
    const ownedChannel = channel;
    directChannelCleanup = cleanup.register(() => ownedChannel.close());
  }
  try {
    const resolvedAuth = dashboardBaseUrl.length > 0 && options.dashboardToken === undefined
      ? await options.resolveAuth?.()
      : undefined;
    throwIfAborted(options.signal);
    const resolvedHeaders = resolvedAuth?.headers === undefined
      ? undefined
      : { ...resolvedAuth.headers };
    const effectiveResolvedHeaders = resolvedHeaders === undefined
      ? undefined
      : (() => {
        const headers = new Headers(resolvedHeaders);
        if ((headers.get("authorization")?.trim() ?? "").length === 0 && options.token !== undefined) {
          headers.set("authorization", `Bearer ${options.token}`);
        }
        return Object.fromEntries(headers.entries());
      })();
    const rest = dashboardBaseUrl.length === 0
      ? undefined
      : createHermesDashboardRestClient({
        baseUrl: dashboardBaseUrl,
        authToken: effectiveResolvedHeaders === undefined
          ? options.dashboardToken ?? options.token ?? null
          : null,
        defaultHeaders: effectiveResolvedHeaders,
        fetchImpl: options.fetch,
      });
    if (rest) {
      authStatus = createHermesAuthStatusClient(rest);
      models = createHermesModelCatalogClient(rest);
      usage = createHermesUsageClient({ rest });
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
      cleanup.register(() => rpc.dispose());
      events = createHermesRuntimeEventClient(rpc);
      if (rest) sessions = createHermesSessionClient(createHermesSessionOperations({ rpc, rest }));
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
  return {
    authStatus,
    sessions,
    models,
    usage,
    tasks,
    workspace,
    events,
    dispose,
  };
}
