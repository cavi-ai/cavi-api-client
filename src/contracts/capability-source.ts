import type {
  CapabilityKey,
  CapabilitySupport,
} from "../core/runtime/capability-taxonomy.js";
import type { TeamManifest } from "./team-manifest.js";

/**
 * The runtime-resolved capability + path picture for a live provider instance,
 * produced by fetching the provider's capabilities endpoint and transforming
 * the response. This is the AUTHORITATIVE source (design decision M1):
 *
 * - `supports` overrides the static `PROVIDER_CAPABILITIES` fallback, because
 *   capability presence is plugin/runtime dependent (e.g. OpenClaw media/wiki
 *   are gated off pre-plugin but live once the plugin is installed).
 * - `manifest` drives dynamic path resolution — members are agents, actions
 *   carry their real `route.path` — so no agent name (`machine`, `martina`,
 *   `deb`, …) or endpoint literal is ever hardcoded in the package.
 */
export interface ResolvedProviderCapabilities {
  providerKind: string;
  supports: CapabilitySupport;
  manifest: TeamManifest;
}

/**
 * A gateway provider supplies one of these: fetch its capabilities endpoint
 * and transform it into the unified shape. Runtime-only providers without a
 * capabilities endpoint omit it, and the static fallback is used unchanged.
 */
export type ProviderCapabilityResolver = (
  options?: { signal?: AbortSignal },
) => Promise<ResolvedProviderCapabilities>;

/**
 * Merge a runtime-resolved support map over the static fallback: runtime keys
 * win; the fallback fills whatever the runtime response did not mention. This
 * realizes "runtime authoritative, static fallback" for capability presence —
 * a static OpenClaw default that gates media/wiki off flips them on for an
 * instance whose capabilities endpoint reports them supported.
 */
export function mergeCapabilitySupport(
  fallback: CapabilitySupport,
  runtime: CapabilitySupport,
): CapabilitySupport {
  const merged: CapabilitySupport = { ...fallback };
  for (const [key, value] of Object.entries(runtime) as [
    CapabilityKey,
    boolean | undefined,
  ][]) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

/** True iff, after merging runtime over fallback, the provider supports `key`. */
export function resolvedSupports(
  fallback: CapabilitySupport,
  runtime: CapabilitySupport | undefined,
  key: CapabilityKey,
): boolean {
  const merged = runtime ? mergeCapabilitySupport(fallback, runtime) : fallback;
  return merged[key] === true;
}
