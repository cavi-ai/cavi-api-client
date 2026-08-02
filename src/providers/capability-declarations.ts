import {
  CONTROL_PLANE_MODULE_CAPABILITY,
  type CapabilityKey,
  type CapabilitySupport,
  type ControlPlaneModule,
} from "../core/runtime/capability-taxonomy.js";
import { RUNTIME_SURFACES, type RuntimeSurface } from "../core/runtime/capabilities.js";

/**
 * THE single declaration site for provider capabilities, over the unified
 * taxonomy. `RUNTIME_PROVIDER_CAPABILITY_MATRIX` and the per-provider
 * `*_RUNTIME_SUPPORT` consts derive from this table via the projections below —
 * never hand-edit a derived view; edit this table.
 *
 * These are PROVIDER-level declarations (what the provider platform supports),
 * used as the static fallback. Instance-level truth is runtime-resolved (the
 * provider's live capabilities response merged over this fallback) — e.g.
 * OpenClaw media/wiki are declared supported here (verified live against the
 * gateway) while a plugin-less instance can still gate them off at runtime.
 */
function support(...keys: CapabilityKey[]): CapabilitySupport {
  const supports: CapabilitySupport = {};
  for (const key of keys) supports[key] = true;
  return supports;
}

export const PROVIDER_CAPABILITIES = {
  // Runtime-only providers: identical, minimal execution profile.
  claude: support("runs", "streaming", "batch"),
  "claude-managed-agents": support("runs", "streaming"),
  codex: support("runs", "streaming", "batch"),
  gemini: support("runs", "streaming", "batch"),
  agy: support("runs", "streaming"),

  // Gateways: full domain + lifecycle + introspection. No async batch surface.
  hermes: support(
    "runs",
    "streaming",
    "sessions",
    "tasks",
    "events",
    "models",
    "usage",
    "authStatus",
    "kanban",
    "teams",
    // Verified live 2026-07-21: member workspace routes are served via the
    // CAVI control plugin (maintainer-confirmed supported).
    "workspace",
    "operator",
    "discourse",
    "media",
    "wiki",
    "agentConfig",
  ),
  openclaw: support(
    "runs",
    "streaming",
    "sessions",
    "tasks",
    "events",
    "models",
    "usage",
    "authStatus",
    "kanban",
    "teams",
    "workspace",
    "operator",
    "discourse",
    "agentConfig",
    // RPC-backed, not HTTP: media rides the core tts/talk gateway methods;
    // wiki is the first-party memory-wiki plugin's wiki.* methods (installed
    // fleet-wide; maintainer-ruled a platform capability). There is no
    // OpenClaw HTTP media/wiki route — the control-UI SPA catch-all answers
    // those paths with 200 HTML, which is NOT service.
    "media",
    "wiki",
  ),
} as const satisfies Record<string, CapabilitySupport>;

/** The providers with a declaration — the matrix's key set derives from this. */
export type DeclaredProviderKey = keyof typeof PROVIDER_CAPABILITIES;

/** The set of capability keys a provider declares supported. */
export function declaredCapabilities(
  provider: DeclaredProviderKey,
): CapabilityKey[] {
  const supports = PROVIDER_CAPABILITIES[provider];
  return (Object.keys(supports) as CapabilityKey[]).filter(
    (key) => supports[key] === true,
  );
}

/**
 * Project a unified declaration onto the legacy runtime-surface axis. The
 * capability matrix and per-provider `*_RUNTIME_SUPPORT` consts derive their
 * runtime rows through this — the declaration above is the only source.
 */
export function projectRuntimeSurfaces(
  supports: CapabilitySupport,
): Partial<Record<RuntimeSurface, boolean>> {
  const projected: Partial<Record<RuntimeSurface, boolean>> = {};
  for (const surface of RUNTIME_SURFACES) {
    const value = supports[surface];
    if (value !== undefined) projected[surface] = value;
  }
  return projected;
}

/** Project a unified declaration onto the legacy control-plane module axis. */
export function projectControlPlaneModules(
  supports: CapabilitySupport,
): Partial<Record<ControlPlaneModule, true>> {
  const projected: Partial<Record<ControlPlaneModule, true>> = {};
  for (const module of Object.keys(CONTROL_PLANE_MODULE_CAPABILITY) as ControlPlaneModule[]) {
    if (supports[CONTROL_PLANE_MODULE_CAPABILITY[module]] === true) {
      projected[module] = true;
    }
  }
  return projected;
}
