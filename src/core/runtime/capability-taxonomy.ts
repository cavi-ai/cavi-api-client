import type { RuntimeSurface } from "./capabilities.js";

/**
 * The unified capability taxonomy — the single, provider-agnostic list of
 * everything a provider may expose through the one client contract.
 *
 * It is the union of the two legacy axes: runtime SURFACES (`RUNTIME_SURFACES`)
 * and control-plane MODULES, de-duplicated (`workspace` appeared in both).
 * Every provider declares support for each key in ONE place; an unsupported
 * capability's call still exists on the client and throws a uniform, notated
 * `CapabilityUnavailable`.
 *
 * This module is purely additive: it introduces the taxonomy alongside the two
 * legacy axes it will replace. The `satisfies` bridges below are a compile-time
 * proof that the taxonomy is a strict superset of both — miss a surface or a
 * module and the build fails.
 */
export const CAPABILITY_TAXONOMY = [
  // execution
  "runs",
  "streaming",
  "batch",
  // lifecycle
  "sessions",
  "tasks",
  "events",
  // introspection
  "models",
  "usage",
  "authStatus",
  // domain surfaces
  "kanban",
  "teams",
  "workspace",
  "operator",
  "discourse",
  "media",
  "wiki",
  "agentConfig",
] as const;

export type CapabilityKey = (typeof CAPABILITY_TAXONOMY)[number];

/** Grouping is presentation/ergonomics only; it partitions the taxonomy exactly. */
export const CAPABILITY_GROUPS = {
  execution: ["runs", "streaming", "batch"],
  lifecycle: ["sessions", "tasks", "events"],
  introspection: ["models", "usage", "authStatus"],
  domain: ["kanban", "teams", "workspace", "operator", "discourse", "media", "wiki", "agentConfig"],
} as const satisfies Record<string, readonly CapabilityKey[]>;

export type CapabilityGroup = keyof typeof CAPABILITY_GROUPS;

/** A provider's declared support for each capability. Absent key ⇒ unsupported. */
export type CapabilitySupport = Partial<Record<CapabilityKey, boolean>>;

/**
 * A provider's capability profile over the unified taxonomy. Every provider
 * publishes exactly one of these (Phase 2 makes it the single declaration
 * site); the client exposes the full surface and gates each call on it.
 */
export interface CapabilityMap {
  providerKind: string;
  supports: CapabilitySupport;
}

/** True iff `map` declares `key` supported. The only place `=== true` lives. */
export function supportsCapability(map: CapabilityMap, key: CapabilityKey): boolean {
  return map.supports[key] === true;
}

/** Narrow an arbitrary string to a `CapabilityKey`. */
export function isCapabilityKey(value: string): value is CapabilityKey {
  return (CAPABILITY_TAXONOMY as readonly string[]).includes(value);
}

/**
 * Legacy axis #1 → unified. `satisfies Record<RuntimeSurface, …>` forces every
 * runtime surface to map onto a real capability; the build breaks if a surface
 * is added upstream without a home here.
 */
export const RUNTIME_SURFACE_CAPABILITY = {
  runs: "runs",
  streaming: "streaming",
  batch: "batch",
  media: "media",
  wiki: "wiki",
  agentConfig: "agentConfig",
  teams: "teams",
  kanban: "kanban",
  workspace: "workspace",
  operator: "operator",
  discourse: "discourse",
} as const satisfies Record<RuntimeSurface, CapabilityKey>;

/**
 * Legacy axis #2 → unified. The control-plane modules
 * (`RuntimeControlPlaneDeclaration.modules`) collapse onto the same taxonomy;
 * `workspace` intentionally coincides with the runtime-surface mapping.
 */
export const CONTROL_PLANE_MODULE_CAPABILITY = {
  sessions: "sessions",
  models: "models",
  usage: "usage",
  tasks: "tasks",
  workspace: "workspace",
  authStatus: "authStatus",
  events: "events",
} as const satisfies Record<string, CapabilityKey>;

export type ControlPlaneModule = keyof typeof CONTROL_PLANE_MODULE_CAPABILITY;
