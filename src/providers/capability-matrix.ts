import type { RuntimeSurface } from "../core/runtime/capabilities.js";
import type { RuntimeTransportCapabilities } from "../core/runtime/control-plane/transports.js";
import type { RuntimeControlPlaneDeclaration } from "../core/runtime/providers/types.js";

export type RuntimeProviderCapabilityRow = Readonly<{
  runtime: Readonly<Partial<Record<RuntimeSurface, boolean>>>;
  transports: Readonly<RuntimeTransportCapabilities>;
  controlPlane: Readonly<RuntimeControlPlaneDeclaration>;
}>;

const http = Object.freeze({ kind: "http", stability: "stable", authenticated: true } as const);
const sse = Object.freeze({
  kind: "sse",
  stability: "stable",
  authenticated: true,
  reconnect: false,
  replay: false,
  cancellation: true,
} as const);
const websocket = Object.freeze({
  kind: "websocket",
  stability: "stable",
  authenticated: true,
  reconnect: true,
} as const);
const experimentalWebsocket = Object.freeze({
  kind: "websocket",
  stability: "experimental",
  authenticated: true,
  reconnect: true,
} as const);

function row(
  runtime: Partial<Record<RuntimeSurface, boolean>>,
  transports: RuntimeTransportCapabilities,
  controlPlane: RuntimeControlPlaneDeclaration = {},
): RuntimeProviderCapabilityRow {
  return Object.freeze({
    runtime: Object.freeze(runtime),
    transports: Object.freeze(transports),
    controlPlane: Object.freeze(controlPlane),
  });
}

const gatewayRuntime = {
  runs: true,
  streaming: true,
  teams: true,
  kanban: true,
  workspace: true,
  operator: true,
  discourse: true,
  media: true,
  wiki: true,
  agentConfig: true,
} as const;

export const RUNTIME_PROVIDER_CAPABILITY_MATRIX = Object.freeze({
  claude: row({ runs: true, streaming: true, batch: true }, { http, sse }),
  "claude-managed-agents": row({ runs: true, streaming: true }, { http, sse }),
  codex: row({ runs: true, streaming: true, batch: true }, { http, sse }),
  gemini: row({ runs: true, streaming: true, batch: true }, { http, sse }),
  hermes: row(gatewayRuntime, { http, sse, websocket: experimentalWebsocket }, {
    transports: Object.freeze({ websocket: experimentalWebsocket }),
    // No `workspace`: Hermes has no native workspace surface. See
    // HERMES_PROVIDER_MODULE.
    modules: Object.freeze({
      sessions: true, models: true, usage: true, tasks: true,
      authStatus: true, events: true,
    }),
  }),
  openclaw: row({ ...gatewayRuntime, media: false, wiki: false }, {
    http,
    sse,
    websocket,
  }, {
    transports: Object.freeze({ websocket }),
    modules: Object.freeze({
      sessions: true, models: true, usage: true, tasks: true,
      workspace: true, authStatus: true, events: true,
    }),
  }),
});

export type RuntimeProviderCapabilityMatrixKey =
  keyof typeof RUNTIME_PROVIDER_CAPABILITY_MATRIX;

export function getRuntimeProviderCapabilityRow(
  provider: string,
): RuntimeProviderCapabilityRow | undefined {
  return Object.prototype.hasOwnProperty.call(RUNTIME_PROVIDER_CAPABILITY_MATRIX, provider)
    ? RUNTIME_PROVIDER_CAPABILITY_MATRIX[
      provider as RuntimeProviderCapabilityMatrixKey
    ]
    : undefined;
}
