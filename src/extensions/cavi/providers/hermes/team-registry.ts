import { TEAM_REGISTRY_CONFIG } from "../../registry/team-registry-config.js";
import { createTeamRegistry, type TeamRegistry, type TeamRegistryConfig } from "../../registry/team-registry.js";

export { TEAM_REGISTRY_CONFIG };
export type { TeamRegistryConfig };

export function createHermesTeamRegistry(
  config: TeamRegistryConfig = TEAM_REGISTRY_CONFIG,
): TeamRegistry {
  return createTeamRegistry(config, { provider: "hermes" });
}
