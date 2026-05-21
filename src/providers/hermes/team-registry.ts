import {
  createTeamRegistry,
  type TeamRegistry,
  type TeamRegistryConfig,
} from "../../cavi/registry/team-registry.js";
import { TEAM_REGISTRY_CONFIG } from "./team-registry-config.js";

export function createHermesTeamRegistry(
  config: TeamRegistryConfig = TEAM_REGISTRY_CONFIG,
): TeamRegistry {
  return createTeamRegistry(config, { provider: "hermes" });
}
