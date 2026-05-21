import {
  createTeamRegistry,
  type CreateTeamRegistryOptions,
  type TeamRegistry,
  type TeamRegistryConfig,
} from "./team-registry.js";

export const TEAM_REGISTRY_CONFIG: TeamRegistryConfig = {
  teams: [],
  libraries: {
    teams: [],
  },
};

export function configureTeamRegistryConfig(
  config: TeamRegistryConfig | null | undefined,
): void {
  Object.assign(TEAM_REGISTRY_CONFIG, {
    provider: config?.provider ?? null,
    teams: config?.teams ?? [],
    libraries: config?.libraries ?? { teams: [] },
    snapshot: config?.snapshot ?? null,
  });
}

export function resetTeamRegistryConfig(): void {
  configureTeamRegistryConfig(null);
}

export function getConfiguredTeamRegistry(
  options: CreateTeamRegistryOptions = {},
): TeamRegistry {
  return createTeamRegistry(TEAM_REGISTRY_CONFIG, options);
}
