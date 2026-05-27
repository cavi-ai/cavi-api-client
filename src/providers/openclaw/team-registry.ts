import {
  createTeamRegistry,
  type TeamRegistry,
  type TeamRegistryConfig,
} from "../../extensions/cavi/registry/team-registry.js";
import { TEAM_REGISTRY_CONFIG } from "./team-registry-config.js";

export function createOpenClawTeamRegistry(
  config: TeamRegistryConfig = TEAM_REGISTRY_CONFIG,
): TeamRegistry {
  return createTeamRegistry(config, { provider: "openclaw" });
}
