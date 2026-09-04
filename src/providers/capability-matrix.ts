import type { RuntimeSurface } from "../core/runtime/capabilities.js";
import type { RuntimeTransportCapabilities } from "../core/runtime/control-plane/transports.js";
import type { RuntimeControlPlaneDeclaration } from "../core/runtime/providers/types.js";
import {
  PROVIDER_CAPABILITIES,
  projectControlPlaneModules,
  projectRuntimeSurfaces,
} from "./capability-declarations.js";

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

// Every row DERIVES from PROVIDER_CAPABILITIES (the single declaration site)
// via the runtime-surface / control-plane-module projections. Do not hand-edit
// capability values here — edit the declaration.
export const RUNTIME_PROVIDER_CAPABILITY_MATRIX = Object.freeze({
  claude: row(projectRuntimeSurfaces(PROVIDER_CAPABILITIES.claude), { http, sse }),
  "claude-managed-agents": row(
    projectRuntimeSurfaces(PROVIDER_CAPABILITIES["claude-managed-agents"]),
    { http, sse },
  ),
  codex: row(projectRuntimeSurfaces(PROVIDER_CAPABILITIES.codex), { http, sse }),
  gemini: row(projectRuntimeSurfaces(PROVIDER_CAPABILITIES.gemini), { http, sse }),
  agy: row(projectRuntimeSurfaces(PROVIDER_CAPABILITIES.agy), { http, sse }),
  opencode: row(projectRuntimeSurfaces(PROVIDER_CAPABILITIES.opencode), { http, sse }),
  hermes: row(
    projectRuntimeSurfaces(PROVIDER_CAPABILITIES.hermes),
    { http, sse, websocket: experimentalWebsocket },
    {
      transports: Object.freeze({ websocket: experimentalWebsocket }),
      modules: Object.freeze(projectControlPlaneModules(PROVIDER_CAPABILITIES.hermes)),
    },
  ),
  openclaw: row(
    projectRuntimeSurfaces(PROVIDER_CAPABILITIES.openclaw),
    { http, sse, websocket },
    {
      transports: Object.freeze({ websocket }),
      modules: Object.freeze(projectControlPlaneModules(PROVIDER_CAPABILITIES.openclaw)),
    },
  ),
});

export type RuntimeProviderCapabilityMatrixKey =
  keyof typeof RUNTIME_PROVIDER_CAPABILITY_MATRIX;

/**
 * Providers report a `providerKind` that differs from their matrix key for the
 * two runtime-only providers whose kind carries the backend flavor. Map those
 * reported kinds onto their matrix key so `getRuntimeProviderCapabilityRow(
 * caps.providerKind)` resolves for every provider.
 */
const PROVIDER_KIND_ALIASES: Readonly<Record<string, RuntimeProviderCapabilityMatrixKey>> =
  Object.freeze({
    "claude-sdk": "claude",
    "codex-responses": "codex",
  });

export function getRuntimeProviderCapabilityRow(
  provider: string,
): RuntimeProviderCapabilityRow | undefined {
  const key = Object.prototype.hasOwnProperty.call(RUNTIME_PROVIDER_CAPABILITY_MATRIX, provider)
    ? (provider as RuntimeProviderCapabilityMatrixKey)
    : PROVIDER_KIND_ALIASES[provider];
  return key ? RUNTIME_PROVIDER_CAPABILITY_MATRIX[key] : undefined;
}
