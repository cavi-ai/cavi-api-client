import { isAuthError } from "../core/errors.js";
import type { RuntimeClient } from "../core/runtime/client.js";
import {
  CapabilityUnavailable,
  type RuntimeControlClient,
} from "../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeEventClient } from "../core/runtime/control-plane/events.js";
import type {
  AuthStatusClient,
  ModelCatalogClient,
} from "../core/runtime/control-plane/models.js";
import type { SessionClient } from "../core/runtime/control-plane/sessions.js";
import type { TaskClient } from "../core/runtime/control-plane/tasks.js";
import type { UsageClient } from "../core/runtime/control-plane/usage.js";
import type { WorkspaceClient } from "../core/runtime/control-plane/workspace.js";
import type { KanbanClient } from "../core/kanban/client.js";
import type { TeamDirectory } from "../core/teams/directory.js";
import type { GatewayMediaClient } from "../core/gateway/resources/media.js";
import type { GatewayWikiClient } from "../core/gateway/resources/wiki.js";
import type { GatewayAgentConfigClient } from "../core/gateway/agent/config.js";
import {
  mergeCapabilitySupport,
  type ProviderCapabilityResolver,
  type ResolvedProviderCapabilities,
} from "./capability-source.js";
import type {
  CapabilityKey,
  CapabilityMap,
  CapabilitySupport,
} from "../core/runtime/capability-taxonomy.js";
import type { TeamManifest } from "./team-manifest.js";

/**
 * The single client surface (the redesign's core invariant): every capability
 * accessor exists on every provider. Calling an unsupported capability throws
 * one uniform, notated `CapabilityUnavailable` — never a missing method, never
 * a silent no-op. Support is decided by the runtime-resolved capabilities
 * merged over the static fallback (design decision M1).
 */
export interface CapabilityClient extends RuntimeClient {
  readonly providerKind: string;
  /** Merged (runtime over static) capability profile. */
  getCapabilityMap(): Promise<CapabilityMap>;
  /** Runtime-resolved manifest, when the provider publishes one. */
  getManifest(): Promise<TeamManifest | null>;
  /** Drop the memoized runtime resolution and resolve again. */
  refreshCapabilities(): Promise<CapabilityMap>;
  dispose(): Promise<void>;
  // lifecycle
  readonly sessions: SessionClient;
  readonly tasks: TaskClient;
  readonly events: RuntimeEventClient;
  // introspection
  readonly models: ModelCatalogClient;
  readonly usage: UsageClient;
  readonly authStatus: AuthStatusClient;
  // domain
  readonly workspace: WorkspaceClient;
  readonly kanban: KanbanClient;
  readonly teams: TeamDirectory;
  readonly media: GatewayMediaClient;
  readonly wiki: GatewayWikiClient;
  readonly agentConfig: GatewayAgentConfigClient;
}

type LazyAsync<T> = T | (() => T | Promise<T>);

export type CapabilityClientBackends = {
  /** Control-plane backing for sessions/tasks/events/models/usage/authStatus/workspace. */
  controlPlane?: LazyAsync<RuntimeControlClient>;
  kanban?: LazyAsync<KanbanClient>;
  media?: LazyAsync<GatewayMediaClient>;
  wiki?: LazyAsync<GatewayWikiClient>;
  agentConfig?: LazyAsync<GatewayAgentConfigClient>;
  /** Sync surface: supply the directory or a sync factory. */
  teams?: TeamDirectory | (() => TeamDirectory);
};

export type CreateCapabilityClientOptions = {
  providerKind: string;
  runtime: RuntimeClient;
  /** Static declaration used until (or when) runtime resolution is available. */
  fallbackSupports?: CapabilitySupport;
  /** Runtime-authoritative source; transport failures degrade to the fallback. */
  resolver?: ProviderCapabilityResolver;
  backends?: CapabilityClientBackends;
  /** Which providers serve a capability — enriches the notated error. */
  availableOn?: (key: CapabilityKey) => readonly string[];
  /** Extra teardown run by dispose() after the control plane is disposed. */
  onDispose?: () => Promise<void> | void;
};

type ControlPlaneCapability =
  | "sessions"
  | "tasks"
  | "events"
  | "models"
  | "usage"
  | "authStatus"
  | "workspace";

const CONTROL_PLANE_CAPABILITIES: readonly ControlPlaneCapability[] = [
  "sessions",
  "tasks",
  "events",
  "models",
  "usage",
  "authStatus",
  "workspace",
];

function notated(
  options: CreateCapabilityClientOptions,
  key: CapabilityKey,
  call: string,
  detail: string,
): CapabilityUnavailable {
  const error = new CapabilityUnavailable(options.providerKind, key);
  const availableOn = options.availableOn?.(key) ?? [];
  error.message = [
    `provider "${options.providerKind}" does not support capability "${key}".`,
    `  declared support : ${detail}`,
    ...(availableOn.length ? [`  available on     : ${availableOn.join(", ")}`] : []),
    `  call             : ${call}`,
  ].join("\n");
  return error;
}

async function resolveLazy<T>(value: LazyAsync<T>): Promise<T> {
  return typeof value === "function" ? await (value as () => T | Promise<T>)() : value;
}

export function createCapabilityClient(
  options: CreateCapabilityClientOptions,
): CapabilityClient {
  const fallback: CapabilitySupport = options.fallbackSupports ?? {};
  const backends = options.backends ?? {};

  let resolved: ResolvedProviderCapabilities | null = null;
  let resolveAttempt: Promise<void> | null = null;
  let controlPlanePromise: Promise<RuntimeControlClient> | null = null;
  let kanbanPromise: Promise<KanbanClient> | null = null;
  let teamsDirectory: TeamDirectory | null = null;

  function ensureResolved(): Promise<void> {
    if (!options.resolver) return Promise.resolve();
    resolveAttempt ??= options.resolver().then(
      (result) => {
        resolved = result;
      },
      (error: unknown) => {
        // Auth failures must surface; transport/backend failures degrade to
        // the static fallback (graceful degradation is a contract).
        if (isAuthError(error)) throw error;
        resolved = null;
      },
    );
    return resolveAttempt;
  }

  function currentSupports(): CapabilitySupport {
    return resolved
      ? mergeCapabilitySupport(fallback, resolved.supports)
      : fallback;
  }

  function declaredDetail(key: CapabilityKey): string {
    const fromFallback = fallback[key];
    const fromRuntime = resolved?.supports[key];
    if (fromRuntime !== undefined) return `runtime capabilities report ${key} = ${fromRuntime}`;
    if (fromFallback !== undefined) return `static declaration has ${key} = ${fromFallback}`;
    return `capability "${key}" is not declared`;
  }

  async function guard(key: CapabilityKey, call: string): Promise<void> {
    await ensureResolved();
    if (currentSupports()[key] !== true) {
      throw notated(options, key, call, declaredDetail(key));
    }
  }

  async function controlPlaneBackend(key: CapabilityKey, call: string): Promise<RuntimeControlClient> {
    const backend = backends.controlPlane;
    if (!backend) {
      throw notated(options, key, call, `no control-plane backend is wired for "${options.providerKind}"`);
    }
    controlPlanePromise ??= Promise.resolve(resolveLazy(backend));
    return controlPlanePromise;
  }

  function gatedControlPlane<T extends object>(key: ControlPlaneCapability): T {
    const methodCache = new Map<PropertyKey, unknown>();
    return new Proxy({} as T, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        let method = methodCache.get(prop);
        if (!method) {
          method = async (...args: unknown[]) => {
            const call = `client.${key}.${String(prop)}()`;
            await guard(key, call);
            const plane = await controlPlaneBackend(key, call);
            const surface = plane[key] as unknown as Record<PropertyKey, unknown>;
            const fn = surface?.[prop];
            if (typeof fn !== "function") {
              throw notated(options, key, call, `backend does not implement ${String(prop)}`);
            }
            return (fn as (...inner: unknown[]) => unknown).apply(surface, args);
          };
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  async function kanbanBackend(call: string): Promise<KanbanClient> {
    const backend = backends.kanban;
    if (!backend) {
      throw notated(options, "kanban", call, `no kanban backend is wired for "${options.providerKind}"`);
    }
    kanbanPromise ??= Promise.resolve(resolveLazy(backend));
    return kanbanPromise;
  }

  function gatedKanban(): KanbanClient {
    const methodCache = new Map<PropertyKey, unknown>();
    const buildMethod = (prop: PropertyKey, viaExtended: boolean): unknown =>
      async (...args: unknown[]) => {
        const call = viaExtended
          ? `client.kanban.extended.${String(prop)}()`
          : `client.kanban.${String(prop)}()`;
        await guard("kanban", call);
        const backend = await kanbanBackend(call);
        const surface = viaExtended
          ? (backend.extended as Record<PropertyKey, unknown> | undefined)
          : (backend as unknown as Record<PropertyKey, unknown>);
        const fn = surface?.[prop];
        if (typeof fn !== "function") {
          throw notated(options, "kanban", call, `backend does not implement ${viaExtended ? "extended " : ""}${String(prop)}`);
        }
        return (fn as (...inner: unknown[]) => unknown).apply(surface, args);
      };

    const extendedProxy = new Proxy({}, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        const cacheKey = `extended:${String(prop)}`;
        let method = methodCache.get(cacheKey);
        if (!method) {
          method = buildMethod(prop, true);
          methodCache.set(cacheKey, method);
        }
        return method;
      },
    });

    return new Proxy({} as KanbanClient, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        // The invariant: the surface is always present and absence is loud —
        // `extended` is a gated proxy, never undefined.
        if (prop === "extended") return extendedProxy;
        let method = methodCache.get(prop);
        if (!method) {
          method = buildMethod(prop, false);
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  /** Async surface gated against a directly-supplied backend (media/wiki/…). */
  function gatedDirect<T extends object>(
    key: CapabilityKey,
    backend: LazyAsync<T> | undefined,
  ): T {
    let backendPromise: Promise<T> | null = null;
    const methodCache = new Map<PropertyKey, unknown>();
    return new Proxy({} as T, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        let method = methodCache.get(prop);
        if (!method) {
          method = async (...args: unknown[]) => {
            const call = `client.${key}.${String(prop)}()`;
            await guard(key, call);
            if (!backend) {
              throw notated(options, key, call, `no ${key} backend is wired for "${options.providerKind}"`);
            }
            backendPromise ??= Promise.resolve(resolveLazy(backend));
            const impl = (await backendPromise) as unknown as Record<PropertyKey, unknown>;
            const fn = impl[prop];
            if (typeof fn !== "function") {
              throw notated(options, key, call, `backend does not implement ${String(prop)}`);
            }
            return (fn as (...inner: unknown[]) => unknown).apply(impl, args);
          };
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  function teamsBackend(call: string): TeamDirectory {
    const backend = backends.teams;
    if (!backend) {
      throw notated(options, "teams", call, `no teams backend is wired for "${options.providerKind}"`);
    }
    teamsDirectory ??= typeof backend === "function" ? backend() : backend;
    return teamsDirectory;
  }

  function gatedTeams(): TeamDirectory {
    const methodCache = new Map<PropertyKey, unknown>();
    return new Proxy({} as TeamDirectory, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        let method = methodCache.get(prop);
        if (!method) {
          method = (...args: unknown[]) => {
            const call = `client.teams.${String(prop)}()`;
            // Sync surface: gate on the current (fallback or last-resolved)
            // support state; runtime transforms leave `teams` to the fallback.
            void ensureResolved();
            if (currentSupports().teams !== true) {
              throw notated(options, "teams", call, declaredDetail("teams"));
            }
            const directory = teamsBackend(call) as unknown as Record<PropertyKey, unknown>;
            const fn = directory[prop];
            if (typeof fn !== "function") {
              throw notated(options, "teams", call, `backend does not implement ${String(prop)}`);
            }
            return (fn as (...inner: unknown[]) => unknown).apply(directory, args);
          };
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  const runtime = options.runtime;
  const controlPlaneSurfaces = Object.fromEntries(
    CONTROL_PLANE_CAPABILITIES.map((key) => [key, gatedControlPlane(key)]),
  ) as Pick<CapabilityClient, ControlPlaneCapability>;

  return {
    providerKind: options.providerKind,

    async getCapabilityMap(): Promise<CapabilityMap> {
      await ensureResolved();
      return { providerKind: options.providerKind, supports: currentSupports() };
    },

    async getManifest(): Promise<TeamManifest | null> {
      await ensureResolved();
      return resolved?.manifest ?? null;
    },

    async refreshCapabilities(): Promise<CapabilityMap> {
      resolveAttempt = null;
      resolved = null;
      await ensureResolved();
      return { providerKind: options.providerKind, supports: currentSupports() };
    },

    async dispose(): Promise<void> {
      if (controlPlanePromise) {
        const plane = await controlPlanePromise;
        await plane.dispose();
      }
      await options.onDispose?.();
    },

    // Universal execution surface — delegated, never gated behind a proxy.
    getRuntimeCapabilities: () => runtime.getRuntimeCapabilities(),
    startRun: (body) => runtime.startRun(body),
    ...(runtime.getRun ? { getRun: runtime.getRun.bind(runtime) } : {}),
    ...(runtime.cancelRun ? { cancelRun: runtime.cancelRun.bind(runtime) } : {}),
    ...(runtime.streamRun ? { streamRun: runtime.streamRun.bind(runtime) } : {}),
    ...(runtime.submitBatch ? { submitBatch: runtime.submitBatch.bind(runtime) } : {}),
    ...(runtime.getBatch ? { getBatch: runtime.getBatch.bind(runtime) } : {}),
    ...(runtime.cancelBatch ? { cancelBatch: runtime.cancelBatch.bind(runtime) } : {}),
    ...(runtime.getBatchResults
      ? { getBatchResults: runtime.getBatchResults.bind(runtime) }
      : {}),

    ...controlPlaneSurfaces,
    kanban: gatedKanban(),
    teams: gatedTeams(),
    media: gatedDirect<GatewayMediaClient>("media", backends.media),
    wiki: gatedDirect<GatewayWikiClient>("wiki", backends.wiki),
    agentConfig: gatedDirect<GatewayAgentConfigClient>("agentConfig", backends.agentConfig),
  };
}
