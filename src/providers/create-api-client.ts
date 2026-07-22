import { createRuntimeClient } from "../core/runtime/providers/factory.js";
import { normalizeRuntimeProviderToken } from "../core/runtime/providers/normalize.js";
import type {
  RuntimeClientOptions,
  RuntimeProviderRegistry,
} from "../core/runtime/providers/types.js";
import type {
  CapabilityKey,
  CapabilitySupport,
} from "../core/runtime/capability-taxonomy.js";
import {
  createCapabilityClient,
  type CapabilityClient,
  type CapabilityClientBackends,
} from "../contracts/capability-client.js";
import type { ProviderCapabilityResolver } from "../contracts/capability-source.js";
import type { RuntimeClient } from "../core/runtime/client.js";
import {
  createGatewayStreamRun,
  requireGatewaySessionKey,
  type GatewayStreamRunBridge,
} from "./gateway-stream-run.js";
import { trackStreamRunBridge } from "./stream-run-lifecycle.js";
import { HermesSseRunEventProvider } from "./hermes/sse-run-event-provider.js";
import { PROVIDER_CAPABILITIES } from "./capability-declarations.js";
import { createBuiltInRuntimeProviderRegistry } from "./runtime-provider-registry.js";
import { createRuntimeControlClient } from "./runtime-control-client-factory.js";
import { JsonHttpApiClient } from "../core/http/json-client.js";
import { GatewayMediaApiClient } from "../core/gateway/resources/media.js";
import { GatewayWikiApiClient } from "../core/gateway/resources/wiki.js";
import {
  HERMES_MEDIA_API_ENDPOINTS,
  HERMES_WIKI_API_ENDPOINTS,
} from "../contracts/paths.js";
import { createHermesCapabilityResolver } from "./hermes/capability-resolver.js";
import { createHermesKanbanClient } from "./hermes/kanban.js";
import { HermesAgentConfigApiClient } from "./hermes/agent-config.js";
import { createOpenClawCapabilityResolver } from "./openclaw/capability-resolver.js";
import { createOpenClawRuntimeControlClient } from "./openclaw/control-plane/factory.js";
import { createOpenClawRunEventStreamProvider } from "./openclaw/stream-run-provider.js";
import { createOpenClawKanbanClient } from "./openclaw/kanban.js";
import { createOpenClawWorkboardRpc } from "./openclaw/workboard.js";
import { OpenClawWebSocketClient } from "./openclaw/websocket.js";
import { OpenClawAgentConfigApiClient } from "./openclaw/agent-config.js";
import { OpenClawMediaApiClient } from "./openclaw/media.js";
import { OpenClawWikiApiClient } from "./openclaw/wiki.js";

/**
 * The ONE front door (the redesign's contract): construct the single client
 * for any provider. The returned `CapabilityClient` exposes every capability
 * accessor on every provider — `sessions`, `tasks`, `events`, `models`,
 * `usage`, `authStatus`, `workspace`, `kanban`, `teams`, `media`, `wiki`,
 * `agentConfig`, plus the universal execution surface (`startRun`/`getRun`/
 * `cancelRun`/`streamRun`/batch) — no accessor is ever missing, regardless of
 * provider.
 *
 * The facade is fully non-throwing: every call resolves a `CapabilityResult`
 * — `{ ok: true, data, source: "live" }` on success, or `{ ok: false, data:
 * null, gap }` with a structured `ContractGap` when the capability is
 * unsupported, unwired, or the backend call failed. There is no missing
 * method and no thrown `CapabilityUnavailable` for an unsupported call — the
 * only throws left are the envelope contract's carve-outs (401/403 auth
 * errors and unknown-classified errors). Feature-detect ahead of time via
 * `getCapabilityMap()`, or just call and branch on `result.ok`.
 *
 * `streamRun` works on all providers: runtime-only providers (Claude, Codex,
 * Gemini, Claude Managed Agents) stream directly through their `RuntimeClient`;
 * gateway providers (Hermes, OpenClaw) have no native `streamRun` and are
 * bridged over their event transport instead — Hermes over SSE run events
 * (the run body must carry a `sessionKey`; without one the call resolves
 * `ok:false` with a `request-invalid` gap and no run is started), OpenClaw
 * over control-plane WebSocket event frames.
 *
 * Gateway providers (`hermes`, `openclaw`) get their capability resolver and
 * backends auto-wired from `baseUrl`/`webSocketUrl`; runtime-only providers
 * (resolved via `registry`) get the execution surface with every other
 * capability gated off unless a resolver/backends override is supplied.
 */

/** Reported provider kinds that map onto a differently-keyed declaration. */
const DECLARATION_ALIASES: Readonly<Record<string, keyof typeof PROVIDER_CAPABILITIES>> = {
  "claude-sdk": "claude",
  "codex-responses": "codex",
};

function fallbackFor(kind: string): CapabilitySupport | undefined {
  const key = Object.prototype.hasOwnProperty.call(PROVIDER_CAPABILITIES, kind)
    ? (kind as keyof typeof PROVIDER_CAPABILITIES)
    : DECLARATION_ALIASES[kind];
  return key ? PROVIDER_CAPABILITIES[key] : undefined;
}

function availableOn(key: CapabilityKey): readonly string[] {
  return Object.entries(PROVIDER_CAPABILITIES)
    .filter(([, supports]) => supports[key] === true)
    .map(([provider]) => provider);
}

export type CreateApiClientOptions = {
  /** Provider registry; defaults to the built-in gateway modules. */
  registry?: RuntimeProviderRegistry;
  baseUrl?: string;
  /** Gateway WebSocket URL; derived from `baseUrl` when omitted. */
  webSocketUrl?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  /** Advertised WS client id for gateways that validate it. */
  clientId?: string;
  /** Manifest team id for this gateway instance. */
  teamId?: string;
  /** Override the auto-wired runtime capability resolver. */
  resolver?: ProviderCapabilityResolver;
  /** Extend/override the auto-wired backends. */
  backends?: CapabilityClientBackends;
  /** Override the static fallback declaration. */
  fallbackSupports?: CapabilitySupport;
};

type AutoWiring = {
  resolver?: ProviderCapabilityResolver;
  backends: CapabilityClientBackends;
  /** Gateway streaming transport, wired when the runtime itself cannot stream. */
  streamRunBridge?: GatewayStreamRunBridge;
  onDispose?: () => Promise<void>;
};

function deriveWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

function httpClientOptions(options: CreateApiClientOptions) {
  return {
    baseUrl: options.baseUrl ?? "",
    ...(options.token ? { auth: { bearerToken: options.token } } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  };
}

function wireHermes(options: CreateApiClientOptions, runtime: RuntimeClient): AutoWiring {
  if (!options.baseUrl) return { backends: {} };
  const baseUrl = options.baseUrl;
  const http = new JsonHttpApiClient("hermes-api-server", {
    baseUrl,
    allowRelativeBaseUrl: true,
    includePortalClientIdHeader: false,
    auth: { bearerToken: options.token ?? null },
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
  // Each Hermes streamRun builds a fresh, untracked SSE provider; wrap the
  // bridge so dispose() can abort in-flight streams and tear their SSE
  // connections down (F3).
  const { bridge: streamRunBridge, disposeAll } = trackStreamRunBridge(
    createGatewayStreamRun({
      runtime,
      validate: (body) => void requireGatewaySessionKey(body),
      createProvider: (body) =>
        new HermesSseRunEventProvider({
          httpBase: baseUrl,
          authToken: options.token ?? null,
          clientId: options.clientId ?? "cavi-api-client",
          sessionKey: requireGatewaySessionKey(body),
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        }),
    }),
  );
  return {
    resolver: createHermesCapabilityResolver({
      baseUrl,
      ...(options.token ? { token: options.token } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
      ...(options.teamId ? { teamId: options.teamId } : {}),
    }),
    backends: {
      controlPlane: () =>
        createRuntimeControlClient("hermes", {
          baseUrl,
          ...(options.token ? { token: options.token } : {}),
        }),
      kanban: () =>
        createHermesKanbanClient((path, init) =>
          http.request(path, {
            method: init?.method ?? "GET",
            ...(init?.body !== undefined ? { body: init.body } : {}),
          }),
        ),
      media: () =>
        new GatewayMediaApiClient(httpClientOptions(options), {
          endpoints: HERMES_MEDIA_API_ENDPOINTS,
          surface: "hermes-media-api",
        }),
      wiki: () =>
        new GatewayWikiApiClient(httpClientOptions(options), {
          endpoints: HERMES_WIKI_API_ENDPOINTS,
          surface: "hermes-wiki-api",
        }),
      agentConfig: () => new HermesAgentConfigApiClient(httpClientOptions(options)),
    },
    streamRunBridge,
    onDispose: async () => disposeAll(),
  };
}

function wireOpenClaw(options: CreateApiClientOptions, runtime: RuntimeClient): AutoWiring {
  const wsUrl =
    options.webSocketUrl ?? (options.baseUrl ? deriveWebSocketUrl(options.baseUrl) : null);
  if (!wsUrl) return { backends: {} };

  let socket: OpenClawWebSocketClient | null = null;
  const rpc = () => {
    socket ??= new OpenClawWebSocketClient(wsUrl, options.token ?? null, {
      clientId: options.clientId ?? "openclaw-control-ui",
    });
    return socket;
  };

  // Wrap the bridge for dispose teardown (F3). The OpenClaw provider wrapper
  // also propagates connection loss (F1) and probes for a fast-terminal run
  // (F5) — see createOpenClawRunEventStreamProvider.
  const { bridge: streamRunBridge, disposeAll } = trackStreamRunBridge(
    createGatewayStreamRun({
      runtime,
      createProvider: () => {
        const rpcClient = rpc();
        return createOpenClawRunEventStreamProvider({
          rpc: rpcClient,
          connect: () => rpcClient.connect(),
          ...(typeof runtime.getRun === "function"
            ? { getRun: (id: string) => runtime.getRun!(id) }
            : {}),
        });
      },
    }),
  );

  return {
    resolver: createOpenClawCapabilityResolver(
      {
        getHelloFrame: () => rpc().getHelloFrame(),
        connect: () => rpc().connect(),
      },
      { ...(options.teamId ? { teamId: options.teamId } : {}) },
    ),
    backends: {
      controlPlane: () =>
        createOpenClawRuntimeControlClient({ rpc: rpc(), takeRpcOwnership: true }),
      kanban: () => createOpenClawKanbanClient(createOpenClawWorkboardRpc(rpc())),
      ...(options.baseUrl
        ? {
            // OpenClaw media is RPC-dispatched (tts/talk core methods) — the
            // media client rides the shared socket. Wiki is served by the
            // first-party memory-wiki plugin's wiki.* RPC methods; until an
            // RPC wiki adapter exists the legacy client's explicit gate is the
            // honest backend (there is no OpenClaw HTTP wiki route — the SPA
            // catch-all answers those paths).
            media: () =>
              new OpenClawMediaApiClient({
                ...httpClientOptions(options),
                rpcClient: rpc(),
              }),
            wiki: () => new OpenClawWikiApiClient(httpClientOptions(options)),
            agentConfig: () => new OpenClawAgentConfigApiClient(httpClientOptions(options)),
          }
        : {}),
    },
    streamRunBridge,
    onDispose: async () => {
      // Settle in-flight bridges first (abort → each resolves and tears down
      // its subscription) BEFORE the socket closes, so nothing hangs (F1/F3).
      disposeAll();
      if (socket) await socket.dispose();
    },
  };
}

function autoWire(
  kind: string,
  options: CreateApiClientOptions,
  runtime: RuntimeClient,
): AutoWiring {
  if (kind === "hermes") return wireHermes(options, runtime);
  if (kind === "openclaw") return wireOpenClaw(options, runtime);
  return { backends: {} };
}

export function createApiClient(
  provider: string,
  options: CreateApiClientOptions = {},
): CapabilityClient {
  const registry = options.registry ?? createBuiltInRuntimeProviderRegistry();
  const clientOptions = {
    ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.token ? { auth: { bearerToken: options.token } } : {}),
  } as RuntimeClientOptions;
  const runtime = createRuntimeClient(provider, { registry, clientOptions });

  const kind =
    registry.resolveProvider(provider)?.kind ??
    normalizeRuntimeProviderToken(provider) ??
    provider;
  const wiring = autoWire(kind, options, runtime);
  const resolver = options.resolver ?? wiring.resolver;

  return createCapabilityClient({
    providerKind: kind,
    runtime,
    fallbackSupports: options.fallbackSupports ?? fallbackFor(kind) ?? {},
    ...(resolver ? { resolver } : {}),
    backends: { ...wiring.backends, ...options.backends },
    availableOn,
    ...(wiring.streamRunBridge ? { streamRunBridge: wiring.streamRunBridge } : {}),
    ...(wiring.onDispose ? { onDispose: wiring.onDispose } : {}),
  });
}
