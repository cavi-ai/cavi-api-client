/** Every surface a provider may declare support for. */
export const RUNTIME_SURFACES = [
  "runs",
  "streaming",
  "media",
  "wiki",
  "agentConfig",
  "teams",
  "kanban",
  "workspace",
  "operator",
  "discourse",
  "batch",
] as const;

export type RuntimeSurface = (typeof RUNTIME_SURFACES)[number];

/** Provider-declared capability profile. Returned by RuntimeClient. */
export type RuntimeCapabilities = {
  providerKind: string;
  protocolVersion?: string | null;
  auth?: { type?: string; required?: boolean };
  supports: Partial<Record<RuntimeSurface, boolean>>;
};

export function runtimeSupports(
  capabilities: RuntimeCapabilities,
  surface: RuntimeSurface,
): boolean {
  return capabilities.supports[surface] === true;
}
