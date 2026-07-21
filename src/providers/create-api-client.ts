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
import { PROVIDER_CAPABILITIES } from "./capability-declarations.js";
import { createBuiltInRuntimeProviderRegistry } from "./runtime-provider-registry.js";
import { createRuntimeControlClient } from "./runtime-control-client-factory.js";
import { JsonHttpApiClient } from "../core/http/json-client.js";
import { createHermesCapabilityResolver } from "./hermes/capability-resolver.js";
import { createHermesKanbanClient } from "./hermes/kanban.js";
import { HermesMediaApiClient } from "./hermes/media.js";
import { HermesWikiApiClient } from "./hermes/wiki.js";
import { HermesAgentConfigApiClient } from "./hermes/agent-config.js";
import { createOpenClawCapabilityResolver } from "./openclaw/capability-resolver.js";
import { createOpenClawRuntimeControlClient } from "./openclaw/control-plane/factory.js";
import { createOpenClawKanbanClient } from "./openclaw/kanban.js";
import { createOpenClawWorkboardRpc } from "./openclaw/workboard.js";
import { OpenClawWebSocketClient } from "./openclaw/websocket.js";
import { OpenClawMediaApiClient } from "./openclaw/media.js";
import { OpenClawWikiApiClient } from "./openclaw/wiki.js";
import { OpenClawAgentConfigApiClient } from "./openclaw/agent-config.js";

/**
 * The ONE front door (the redesign's contract): construct the single client
 * for any provider. The returned `CapabilityClient` exposes every capability
 * accessor no matter which provider backs it — unsupported calls throw the
 * notated `CapabilityUnavailable`. Gateway providers get their resolver and
 * backends auto-wired from `baseUrl`/`webSocketUrl`; runtime-only providers
 * (via `registry`) get the execution surface with everything else gated.
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

function wireHermes(options: CreateApiClientOptions): AutoWiring {
  if (!options.baseUrl) return { backends: {} };
  const baseUrl = options.baseUrl;
  const http = new JsonHttpApiClient("hermes-api-server", {
    baseUrl,
    allowRelativeBaseUrl: true,
    includePortalClientIdHeader: false,
    auth: { bearerToken: options.token ?? null },
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
  });
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
      media: () => new HermesMediaApiClient(httpClientOptions(options)),
      wiki: () => new HermesWikiApiClient(httpClientOptions(options)),
      agentConfig: () => new HermesAgentConfigApiClient(httpClientOptions(options)),
    },
  };
}

function wireOpenClaw(options: CreateApiClientOptions): AutoWiring {
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
            media: () => new OpenClawMediaApiClient({ ...httpClientOptions(options), rpcClient: rpc() }),
            wiki: () => new OpenClawWikiApiClient(httpClientOptions(options)),
            agentConfig: () => new OpenClawAgentConfigApiClient(httpClientOptions(options)),
          }
        : {}),
    },
    onDispose: async () => {
      if (socket) await socket.dispose();
    },
  };
}

function autoWire(kind: string, options: CreateApiClientOptions): AutoWiring {
  if (kind === "hermes") return wireHermes(options);
  if (kind === "openclaw") return wireOpenClaw(options);
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
  const wiring = autoWire(kind, options);
  const resolver = options.resolver ?? wiring.resolver;

  return createCapabilityClient({
    providerKind: kind,
    runtime,
    fallbackSupports: options.fallbackSupports ?? fallbackFor(kind) ?? {},
    ...(resolver ? { resolver } : {}),
    backends: { ...wiring.backends, ...options.backends },
    availableOn,
    ...(wiring.onDispose ? { onDispose: wiring.onDispose } : {}),
  });
}
