import { ApiClientError, ApiClientErrorCode, isAuthError } from "../core/errors.js";
import type {
  RuntimeClient,
  RuntimeRunStartBody,
  RuntimeRunStatus,
  RuntimeBatchRequest,
  RuntimeBatchStatus,
  RuntimeBatchResult,
} from "../core/runtime/client.js";
import {
  isNonTerminalStreamError,
  RUN_STREAM_EVENT_NAMES,
  type RunEventStreamHandlers,
} from "../core/runtime/run-stream.js";
import type { RuntimeControlClient } from "../core/runtime/control-plane/runtime-control-client.js";
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
import { teamDirectoryFromManifest } from "../core/teams/from-manifest.js";
import type { GatewayMediaClient } from "../core/gateway/resources/media.js";
import type { GatewayWikiClient } from "../core/gateway/resources/wiki.js";
import type { GatewayAgentConfigClient } from "../core/gateway/agent/config.js";
import {
  classifyCapabilityFailure,
  gapResult,
  liveResult,
  type CapabilityResult,
} from "./capability-result.js";
import { fallbackGap } from "../core/gateway/envelope/envelope.js";
import type { ContractGap } from "../core/gateway/envelope/types.js";
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

/** A backend surface re-typed to the non-throwing facade contract. */
export type CapabilityGatedMethod<F> = F extends (
  ...args: infer A
) => Promise<infer R>
  ? (...args: A) => Promise<CapabilityResult<R>>
  : F extends (...args: infer A) => infer R
    ? (...args: A) => Promise<CapabilityResult<R>>
    : F extends object
      ? CapabilityGated<F>
      : // Unreachable while every gated interface is method-only (each member is
        // a function or a nested object of functions); a bare data field would
        // land here.
        never;

export type CapabilityGated<T> = {
  readonly [K in keyof T]-?: CapabilityGatedMethod<NonNullable<T[K]>>;
};

/**
 * The body accepted by the facade's `streamRun`: the universal
 * {@link RuntimeRunStartBody} plus the OPTIONAL gateway session-selection
 * fields. Gateway providers (Hermes) bind the stream to a session via one of
 * these; runtime-only providers ignore them. Exposing them here is what lets
 * `client.streamRun({ input, sessionKey })` typecheck at the call site instead
 * of failing `TS2353` on an excess property.
 */
export type StreamRunBody = RuntimeRunStartBody & {
  sessionKey?: string;
  session_key?: string;
  session_id?: string;
};

/**
 * What a facade `streamRun` reports once its streaming CALL settles. `ok`
 * reflects the streaming call (did the stream run without a caller/transport
 * failure); this payload carries the RUN's own terminal state as data, so
 * `ok: true` with `outcome: "failed"` is coherent — the stream worked, the run
 * failed (run.failed is an event, already the contract).
 *
 * - `runId` — the run id: reported by a gateway bridge as soon as the run
 *   starts, otherwise captured from the first stream event carrying one; `null`
 *   only when no run was started and no event carried an id.
 * - `outcome` — the terminal lifecycle event seen (`run.completed`→"completed",
 *   `run.failed`→"failed", `run.cancelled`→"cancelled"); `null` when the stream
 *   ended without a terminal event.
 *
 * Note the abort asymmetry: a CALLER abort (via `options.signal`) resolves
 * `ok: false` with a `request-aborted` gap, but `dispose()`-driven teardown of
 * an in-flight stream aborts an INTERNAL composed signal invisible to the
 * facade, so the bridge settles cleanly and this resolves
 * `ok: true` with `outcome: null` (the run id may be present if the run had
 * already started) — teardown is not a caller abort.
 */
export type RunStreamOutcome = {
  runId: string | null;
  outcome: "completed" | "failed" | "cancelled" | null;
};

/**
 * The single client surface (the redesign's core invariant): every capability
 * accessor exists on every provider. Gated surfaces never throw and never go
 * missing — an unsupported or failed call resolves `ok: false` with a
 * structured `ContractGap` (the same notation the throwing gate once carried),
 * while a supported call resolves `ok: true` with a live result. The only
 * throws left on a gated call are the envelope contract's carve-outs: auth
 * errors (401/403) and unknown-classified errors. Feature-detect via
 * `getCapabilityMap()`, or just call and branch on `result.ok`. Support is
 * decided by the runtime-resolved capabilities merged over the static fallback
 * (design decision M1).
 */
export interface CapabilityClient {
  readonly providerKind: string;
  /** Merged (runtime over static) capability profile. */
  getCapabilityMap(): Promise<CapabilityMap>;
  /** Runtime-resolved manifest, when the provider publishes one. */
  getManifest(): Promise<TeamManifest | null>;
  /** Drop the memoized runtime resolution and resolve again. */
  refreshCapabilities(): Promise<CapabilityMap>;
  /**
   * Tear down the client: dispose the control plane and run provider teardown.
   * In-flight gateway `streamRun` bridges are settled as part of teardown
   * (their in-flight calls are aborted, so pending `streamRun` promises resolve
   * rather than hang), then any transport (SSE/WebSocket) is closed.
   */
  dispose(): Promise<void>;
  // execution — always present, result-shaped (the facade does not extend
  // RuntimeClient; an unsupported/unwired call resolves ok:false, never absent).
  // An execution call requires the capability to be DECLARED (static fallback or
  // resolver); a working runtime method alone is not enough — gating comes first.
  startRun(body: RuntimeRunStartBody): Promise<CapabilityResult<RuntimeRunStatus>>;
  getRun(runId: string): Promise<CapabilityResult<RuntimeRunStatus>>;
  cancelRun(runId: string): Promise<CapabilityResult<{ status: string }>>;
  /**
   * Stream a run, unified across providers. The resolved `ok` reflects the
   * STREAMING CALL, not the run: a clean stream (or one whose run merely failed
   * as an event) resolves `ok: true` with a {@link RunStreamOutcome} carrying
   * the captured `runId` and the terminal `outcome` seen. A stream that a
   * transport error tore down resolves `ok: false` with a classified gap. A
   * caller-initiated abort (via `options.signal`), or a provider-internal
   * AbortError, resolves `ok: false` with a `request-aborted` gap — never a
   * silent `ok: true` — and, when a `runId` is known and the runtime exposes
   * `cancelRun`, issues a best-effort `cancelRun(runId)` so no gateway run is
   * orphaned (the gap note records whether a cancel was requested). Auth
   * (401/403) and unknown-classified errors still throw.
   */
  streamRun(
    body: StreamRunBody,
    handlers: RunEventStreamHandlers,
    options?: { signal?: AbortSignal },
  ): Promise<CapabilityResult<RunStreamOutcome>>;
  submitBatch(requests: RuntimeBatchRequest[]): Promise<CapabilityResult<RuntimeBatchStatus>>;
  getBatch(batchId: string): Promise<CapabilityResult<RuntimeBatchStatus>>;
  cancelBatch(batchId: string): Promise<CapabilityResult<RuntimeBatchStatus>>;
  getBatchResults(batchId: string): Promise<CapabilityResult<RuntimeBatchResult[]>>;
  // lifecycle
  readonly sessions: CapabilityGated<SessionClient>;
  readonly tasks: CapabilityGated<TaskClient>;
  readonly events: CapabilityGated<RuntimeEventClient>;
  // introspection
  readonly models: CapabilityGated<ModelCatalogClient>;
  readonly usage: CapabilityGated<UsageClient>;
  readonly authStatus: CapabilityGated<AuthStatusClient>;
  // domain
  readonly workspace: CapabilityGated<WorkspaceClient>;
  readonly kanban: CapabilityGated<KanbanClient>;
  readonly teams: CapabilityGated<TeamDirectory>;
  readonly media: CapabilityGated<GatewayMediaClient>;
  readonly wiki: CapabilityGated<GatewayWikiClient>;
  readonly agentConfig: CapabilityGated<GatewayAgentConfigClient>;
}

type LazyAsync<T> = T | (() => T | Promise<T>);

export type CapabilityClientBackends = {
  /** Control-plane backing for sessions/tasks/events/models/usage/authStatus/workspace. */
  controlPlane?: LazyAsync<RuntimeControlClient>;
  kanban?: LazyAsync<KanbanClient>;
  media?: LazyAsync<GatewayMediaClient>;
  wiki?: LazyAsync<GatewayWikiClient>;
  agentConfig?: LazyAsync<GatewayAgentConfigClient>;
  /** Supply the directory or a sync factory. */
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
  /** Which providers serve a capability — enriches the notated gap. */
  availableOn?: (key: CapabilityKey) => readonly string[];
  /**
   * Gateway streaming transport: start the run and pump canonical run-stream
   * events into the handlers. Used when the runtime client itself has no
   * `streamRun` (gateways). Wired by `createApiClient`.
   */
  streamRunBridge?: (
    body: StreamRunBody,
    handlers: RunEventStreamHandlers,
    options?: {
      signal?: AbortSignal;
      /** Invoked with the run id as soon as the run starts (before events). */
      onRunId?: (runId: string) => void;
    },
  ) => Promise<void>;
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

/**
 * Build the notated gap for an unsupported/unwired call — the same notation
 * text the throwing gate once put on `CapabilityUnavailable.message`, now
 * carried in `gap.note` under the `capability-unsupported` reason.
 *
 * `headline` defaults to the "does not support" line used when the capability
 * itself is undeclared. Callers where the capability IS declared but the
 * implementation is missing (a supported-but-unwired runtime/backend method)
 * pass the "cannot serve … here" headline so the note doesn't misreport a
 * declared capability as unsupported.
 */
function unsupportedGap(
  options: CreateCapabilityClientOptions,
  key: CapabilityKey,
  call: string,
  detail: string,
  headline = `provider "${options.providerKind}" does not support capability "${key}".`,
): ContractGap {
  const availableOn = options.availableOn?.(key) ?? [];
  const note = [
    headline,
    `  declared support : ${detail}`,
    ...(availableOn.length ? [`  available on     : ${availableOn.join(", ")}`] : []),
    `  call             : ${call}`,
  ].join("\n");
  return fallbackGap(`capability:${key}`, call, note, "capability-unsupported");
}

async function resolveLazy<T>(value: LazyAsync<T>): Promise<T> {
  return typeof value === "function" ? await (value as () => T | Promise<T>)() : value;
}

/**
 * True for an AbortError-class rejection — a `DOMException`/`Error` whose
 * `name` is `"AbortError"` (fetch/`AbortController` and provider-internal
 * aborts both surface this). Kept local to the streamRun path: abort is a
 * call-shape concern (see decision-rule (d)), never a global reclassification.
 */
function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null | undefined)?.name === "AbortError";
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

  /**
   * Resolve capabilities, then decide gating: `null` means the call may proceed
   * to its backend; a `ContractGap` means it is unsupported and the method
   * resolves `gapResult(gap)`. Auth-rejecting resolvers still throw out of
   * `ensureResolved`, surfacing as a rejection of the call (the carve-out).
   */
  async function gapFor(key: CapabilityKey, call: string): Promise<ContractGap | null> {
    await ensureResolved();
    if (currentSupports()[key] === true) return null;
    return unsupportedGap(options, key, call, declaredDetail(key));
  }

  /**
   * Shared invoke tail: look the method up on an already-resolved backend
   * surface, call it, and shape the outcome. A missing method resolves a
   * `capability-unsupported` gap; a thrown error routes through
   * `classifyCapabilityFailure` (auth/unknown still rethrow per the carve-outs).
   * Backend *resolution* (the lazy factory) is caught by each caller so it can
   * de-poison its own memo; this helper only owns the invocation.
   */
  async function invokeOnSurface(
    key: CapabilityKey,
    call: string,
    surface: Record<PropertyKey, unknown> | undefined,
    prop: PropertyKey,
    args: unknown[],
    missingDetail: string,
  ): Promise<CapabilityResult<unknown>> {
    const fn = surface?.[prop];
    if (typeof fn !== "function") {
      // The capability is declared (gating already passed) — only the backend
      // implementation is missing, so headline it as "cannot serve … here".
      return gapResult(
        unsupportedGap(
          options,
          key,
          call,
          missingDetail,
          `provider "${options.providerKind}" cannot serve capability "${key}" here.`,
        ),
      );
    }
    try {
      return liveResult(await (fn as (...inner: unknown[]) => unknown).apply(surface, args));
    } catch (error) {
      return gapResult(
        classifyCapabilityFailure({
          error,
          area: `capability:${key}`,
          expectedContract: call,
          call,
        }),
      );
    }
  }

  function gatedControlPlane<T extends object>(
    key: ControlPlaneCapability,
  ): CapabilityGated<T> {
    const methodCache = new Map<PropertyKey, unknown>();
    return new Proxy({} as CapabilityGated<T>, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        let method = methodCache.get(prop);
        if (!method) {
          method = async (...args: unknown[]) => {
            const call = `client.${key}.${String(prop)}()`;
            const gap = await gapFor(key, call);
            if (gap) return gapResult(gap);
            const backend = backends.controlPlane;
            if (!backend) {
              return gapResult(
                unsupportedGap(
                  options,
                  key,
                  call,
                  `no control-plane backend is wired for "${options.providerKind}"`,
                ),
              );
            }
            let plane: RuntimeControlClient;
            const pending = (controlPlanePromise ??= Promise.resolve(resolveLazy(backend)));
            try {
              plane = await pending;
            } catch (error) {
              // A rejected lazy factory must degrade to a gap, not reject the
              // call — and must not poison the memo forever. Reset it so a later
              // call retries (only if it still points at the promise we awaited,
              // so a newer in-flight resolution isn't nulled); classify
              // (auth/unknown still rethrow).
              if (controlPlanePromise === pending) controlPlanePromise = null;
              return gapResult(
                classifyCapabilityFailure({
                  error,
                  area: `capability:${key}`,
                  expectedContract: call,
                  call,
                }),
              );
            }
            const surface = plane[key] as unknown as Record<PropertyKey, unknown>;
            return invokeOnSurface(
              key,
              call,
              surface,
              prop,
              args,
              `backend does not implement ${String(prop)}`,
            );
          };
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  function gatedKanban(): CapabilityGated<KanbanClient> {
    const methodCache = new Map<PropertyKey, unknown>();
    const buildMethod = (prop: PropertyKey, viaExtended: boolean): unknown =>
      async (...args: unknown[]) => {
        const call = viaExtended
          ? `client.kanban.extended.${String(prop)}()`
          : `client.kanban.${String(prop)}()`;
        const gap = await gapFor("kanban", call);
        if (gap) return gapResult(gap);
        const backend = backends.kanban;
        if (!backend) {
          return gapResult(
            unsupportedGap(
              options,
              "kanban",
              call,
              `no kanban backend is wired for "${options.providerKind}"`,
            ),
          );
        }
        let client: KanbanClient;
        const pending = (kanbanPromise ??= Promise.resolve(resolveLazy(backend)));
        try {
          client = await pending;
        } catch (error) {
          // De-poison the memo on a rejected factory (only if it still points at
          // the promise we awaited), then classify.
          if (kanbanPromise === pending) kanbanPromise = null;
          return gapResult(
            classifyCapabilityFailure({
              error,
              area: "capability:kanban",
              expectedContract: call,
              call,
            }),
          );
        }
        const surface = viaExtended
          ? (client.extended as Record<PropertyKey, unknown> | undefined)
          : (client as unknown as Record<PropertyKey, unknown>);
        return invokeOnSurface(
          "kanban",
          call,
          surface,
          prop,
          args,
          `backend does not implement ${viaExtended ? "extended " : ""}${String(prop)}`,
        );
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

    return new Proxy({} as CapabilityGated<KanbanClient>, {
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

  /** Async surface gated against a directly-supplied backend (media/wiki/teams/…). */
  function gatedDirect<T extends object>(
    key: CapabilityKey,
    backend: LazyAsync<T> | undefined,
  ): CapabilityGated<T> {
    let backendPromise: Promise<T> | null = null;
    const methodCache = new Map<PropertyKey, unknown>();
    return new Proxy({} as CapabilityGated<T>, {
      get(_target, prop) {
        if (typeof prop === "symbol" || prop === "then") return undefined;
        let method = methodCache.get(prop);
        if (!method) {
          method = async (...args: unknown[]) => {
            const call = `client.${key}.${String(prop)}()`;
            const gap = await gapFor(key, call);
            if (gap) return gapResult(gap);
            if (!backend) {
              return gapResult(
                unsupportedGap(
                  options,
                  key,
                  call,
                  `no ${key} backend is wired for "${options.providerKind}"`,
                ),
              );
            }
            let impl: T;
            const pending = (backendPromise ??= Promise.resolve(resolveLazy(backend)));
            try {
              impl = await pending;
            } catch (error) {
              // De-poison the memo on a rejected factory (only if it still points
              // at the promise we awaited), then classify.
              if (backendPromise === pending) backendPromise = null;
              return gapResult(
                classifyCapabilityFailure({
                  error,
                  area: `capability:${key}`,
                  expectedContract: call,
                  call,
                }),
              );
            }
            return invokeOnSurface(
              key,
              call,
              impl as unknown as Record<PropertyKey, unknown>,
              prop,
              args,
              `backend does not implement ${String(prop)}`,
            );
          };
          methodCache.set(prop, method);
        }
        return method;
      },
    });
  }

  const runtime = options.runtime;

  /**
   * Shared executor for the always-present execution surface. Gates on the
   * capability first (an unsupported call resolves its notated gap), then
   * reports a supported-but-unimplemented method as a `capability-unsupported`
   * gap, and finally invokes — classifying any throw (auth/unknown still
   * rethrow per the carve-outs). The `run` thunk invokes through `runtime.`
   * directly, so no `this`-binding is lost.
   */
  async function execute<T>(
    key: CapabilityKey,
    call: string,
    run: (() => Promise<T>) | undefined,
  ): Promise<CapabilityResult<T>> {
    const gap = await gapFor(key, call);
    if (gap) return gapResult(gap);
    if (!run) {
      // Declared but the runtime has no method for it — "cannot serve … here",
      // not "does not support" (which is reserved for undeclared capabilities).
      return gapResult(
        unsupportedGap(
          options,
          key,
          call,
          `runtime client for "${options.providerKind}" does not implement ${call}`,
          `provider "${options.providerKind}" cannot serve capability "${key}" here.`,
        ),
      );
    }
    try {
      return liveResult(await run());
    } catch (error) {
      return gapResult(
        classifyCapabilityFailure({ error, area: `capability:${key}`, expectedContract: call, call }),
      );
    }
  }

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
        try {
          const plane = await controlPlanePromise;
          await plane.dispose();
        } catch {
          // A poisoned/rejected control-plane promise (or a failing dispose)
          // must never block teardown — onDispose still has to run.
        }
      }
      await options.onDispose?.();
    },

    // Universal execution surface — always present and result-shaped. Support
    // gating comes first; a supported-but-unimplemented method resolves a gap;
    // `getRuntimeCapabilities` is intentionally gone (the facade's vocabulary is
    // `getCapabilityMap()`).
    startRun: (body) => execute("runs", "client.startRun()", () => runtime.startRun(body)),
    getRun: (runId) =>
      execute("runs", "client.getRun()", runtime.getRun ? () => runtime.getRun!(runId) : undefined),
    cancelRun: (runId) =>
      execute(
        "runs",
        "client.cancelRun()",
        runtime.cancelRun ? () => runtime.cancelRun!(runId) : undefined,
      ),
    async streamRun(body, handlers, streamOptions): Promise<CapabilityResult<RunStreamOutcome>> {
      const call = "client.streamRun()";
      // Gate exactly as the shared executor does: unsupported/undeclared →
      // notated gap; declared-but-unwired → "cannot serve … here".
      const gap = await gapFor("streaming", call);
      if (gap) return gapResult(gap);
      const stream = runtime.streamRun
        ? (
            b: StreamRunBody,
            h: RunEventStreamHandlers,
            o?: { signal?: AbortSignal; onRunId?: (runId: string) => void },
          ) => runtime.streamRun!(b, h, o)
        : options.streamRunBridge;
      if (!stream) {
        return gapResult(
          unsupportedGap(
            options,
            "streaming",
            call,
            `runtime client for "${options.providerKind}" does not implement ${call}`,
            `provider "${options.providerKind}" cannot serve capability "streaming" here.`,
          ),
        );
      }

      // Wrap the caller's handlers to observe the stream while forwarding every
      // callback unchanged: capture the first runId, remember the terminal
      // event and the LAST error passed to onError. `ok` will reflect the CALL;
      // this observation becomes the run's own outcome data.
      let runId: string | null = null;
      let outcome: RunStreamOutcome["outcome"] = null;
      let sawError = false;
      let lastError: unknown;
      const wrapped: RunEventStreamHandlers = {
        onEvent: (event) => {
          if (runId === null && event.runId) runId = event.runId;
          if (event.event === RUN_STREAM_EVENT_NAMES.RUN_COMPLETED) outcome = "completed";
          else if (event.event === RUN_STREAM_EVENT_NAMES.RUN_FAILED) outcome = "failed";
          else if (event.event === RUN_STREAM_EVENT_NAMES.RUN_CANCELLED) outcome = "cancelled";
          handlers.onEvent(event);
        },
        onError: (error) => {
          // A NON-terminal per-frame error (a single malformed frame the lower
          // layers deliberately forward WITHOUT tearing the stream down — see
          // gateway-stream-run.ts / the control-plane run-stream bridge) is
          // observability only: forward it, but do not let it decide the call's
          // outcome. Only a terminal onError records the failure.
          if (!isNonTerminalStreamError(error)) {
            sawError = true;
            lastError = error;
          }
          handlers.onError?.(error);
        },
        onComplete: handlers.onComplete,
      };

      // Caller-initiated (or provider-internal) abort → a `request-aborted`
      // gap, with a best-effort cancel so no gateway run is orphaned.
      const abortedGap = async (): Promise<CapabilityResult<RunStreamOutcome>> => {
        let cancelNote: string;
        if (runId !== null && runtime.cancelRun) {
          // Decision: cancel is fire-and-forget cleanup, not a caller-invoked
          // call — EVERY error is swallowed (auth included). The auth/unknown
          // rethrow carve-out applies to what the caller asked for (the stream),
          // never to teardown we initiated on their behalf; a failed cancel must
          // not turn an abort into a thrown auth error.
          await runtime.cancelRun(runId).catch(() => undefined);
          cancelNote = `cancel requested for run ${runId}`;
        } else {
          cancelNote = "no cancel issued (run id unknown or cancelRun unsupported)";
        }
        return gapResult(
          fallbackGap("capability:streaming", call, `${call} aborted: ${cancelNote}`, "request-aborted"),
        );
      };

      // The gateway bridge knows the run id from `startRun` before any event —
      // capture it so an abort that lands before the first frame can still issue
      // a best-effort cancel (otherwise a run started microseconds before abort
      // would be orphaned).
      const streamInvokeOptions = {
        ...streamOptions,
        onRunId: (id: string) => {
          if (runId === null && id) runId = id;
        },
      };
      try {
        await stream(body, wrapped, streamInvokeOptions);
      } catch (error) {
        // (c) caller's signal aborted, on the reject path, and (d) an
        // AbortError-class rejection even without our signal — both are aborts,
        // checked BEFORE delegating to the generic classifier.
        if (streamOptions?.signal?.aborted || isAbortError(error)) return abortedGap();
        // (e) other rejections → existing classification (auth/unknown rethrow).
        return gapResult(
          classifyCapabilityFailure({ error, area: "capability:streaming", expectedContract: call, call }),
        );
      }
      // (c) caller's signal aborted even though the call resolved.
      if (streamOptions?.signal?.aborted) return abortedGap();
      // (a) clean resolve: a terminal was seen, or the stream ended without any
      // onError — the streaming call succeeded; report the run's outcome.
      if (outcome !== null || !sawError) return liveResult({ runId, outcome });
      // (b) resolved but an onError with no terminal → the run-stream was torn
      // down mid-flight. An abort reported THROUGH the handler is still an abort,
      // not an unknown fault, so route an AbortError-class onError to the same
      // request-aborted gap (with best-effort cancel); otherwise classify the
      // error (kills the divergence where a swallowed onError looked like ok:true).
      if (isAbortError(lastError)) return abortedGap();
      return gapResult(
        classifyCapabilityFailure({ error: lastError, area: "capability:streaming", expectedContract: call, call }),
      );
    },
    submitBatch: (requests) =>
      execute(
        "batch",
        "client.submitBatch()",
        runtime.submitBatch ? () => runtime.submitBatch!(requests) : undefined,
      ),
    getBatch: (batchId) =>
      execute(
        "batch",
        "client.getBatch()",
        runtime.getBatch ? () => runtime.getBatch!(batchId) : undefined,
      ),
    cancelBatch: (batchId) =>
      execute(
        "batch",
        "client.cancelBatch()",
        runtime.cancelBatch ? () => runtime.cancelBatch!(batchId) : undefined,
      ),
    getBatchResults: (batchId) =>
      execute(
        "batch",
        "client.getBatchResults()",
        runtime.getBatchResults ? () => runtime.getBatchResults!(batchId) : undefined,
      ),

    ...controlPlaneSurfaces,
    kanban: gatedKanban(),
    // teams is not a gateway RPC: it resolves from the provider manifest. When
    // no explicit backend is supplied and a resolver exists, build the directory
    // from the resolved manifest (memoized by gatedDirect); a resolver that
    // returns no manifest degrades to a gap.
    teams: gatedDirect<TeamDirectory>(
      "teams",
      backends.teams ??
        (options.resolver
          ? async () => {
              await ensureResolved();
              const manifest = resolved?.manifest;
              if (!manifest) {
                throw new ApiClientError("teams manifest unavailable", {
                  code: ApiClientErrorCode.BackendUnavailable,
                });
              }
              try {
                return teamDirectoryFromManifest(manifest);
              } catch (error) {
                // A manifest the directory cannot index (e.g. ambiguous lookup
                // keys across teams) is backend data the client cannot serve —
                // degrade to a gap, never throw out of a read.
                throw new ApiClientError(
                  `teams manifest rejected: ${error instanceof Error ? error.message : String(error)}`,
                  { code: ApiClientErrorCode.BackendUnavailable },
                );
              }
            }
          : undefined),
    ),
    media: gatedDirect<GatewayMediaClient>("media", backends.media),
    wiki: gatedDirect<GatewayWikiClient>("wiki", backends.wiki),
    agentConfig: gatedDirect<GatewayAgentConfigClient>("agentConfig", backends.agentConfig),
  };
}
