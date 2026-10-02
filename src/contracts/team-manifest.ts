// Team manifest contract: types and constants, normalization, and route /
// workspace / action resolution. Modules under ./team-manifest/ export
// internal helpers to each other; only the names below are public.
export * from "./team-manifest/types.js";
export {
  createDefaultTeamManifest,
  normalizeTeamManifest,
  findTeamManifestTeam,
  findTeamManifestMember,
  findTeamActionContract,
} from "./team-manifest/normalize.js";
export {
  resolveTeamActionContract,
  resolveTeamActionApiPath,
  resolveTeamRoutePath,
  resolveGatewayRouteBinding,
  resolveTeamWorkspacePath,
  resolveTeamWorkspaceApiPath,
} from "./team-manifest/resolve.js";
