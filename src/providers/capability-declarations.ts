import type {
  CapabilityKey,
  CapabilitySupport,
} from "../core/runtime/capability-taxonomy.js";
import type { RuntimeProviderCapabilityMatrixKey } from "./capability-matrix.js";

/**
 * THE single declaration site for provider capabilities, over the unified
 * taxonomy. Today the same facts live in two hand-maintained places — each
 * runtime-only provider's module (`*_RUNTIME_SUPPORT`) and the gateway rows of
 * `RUNTIME_PROVIDER_CAPABILITY_MATRIX`. Phase 2b cuts both over to derive from
 * here; `capability-declarations.test.ts` proves this table already equals the
 * union of those two sources (plus the one sanctioned correction below).
 *
 * Correction vs the current matrix: OpenClaw declares `media`/`wiki` = false,
 * but the provider module wires `OpenClawMediaApiClient` + `OpenClawWikiApiClient`
 * and the backend serves both natively. This table declares them supported.
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
    // `workspace`: the matrix runtime row declares this supported. The provider
    // module comment claims Hermes has no native workspace — an unresolved
    // contradiction; kept true here to match the executable declaration.
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
    // Corrected vs matrix (was false) — OpenClaw serves both natively.
    "media",
    "wiki",
  ),
} as const satisfies Record<RuntimeProviderCapabilityMatrixKey, CapabilitySupport>;

/** The set of capability keys a provider declares supported. */
export function declaredCapabilities(
  provider: RuntimeProviderCapabilityMatrixKey,
): CapabilityKey[] {
  const supports = PROVIDER_CAPABILITIES[provider];
  return (Object.keys(supports) as CapabilityKey[]).filter(
    (key) => supports[key] === true,
  );
}
