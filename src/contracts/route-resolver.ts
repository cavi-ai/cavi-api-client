import {
  findTeamManifestTeam,
  resolveTeamActionApiPath,
  resolveTeamRoutePath,
  resolveTeamWorkspaceApiPath,
  resolveGatewayRouteBinding,
  type GatewayResolvedRouteBinding,
  type ResolveGatewayRouteBindingOptions,
  type ResolveTeamActionContractOptions,
  type ResolveTeamRoutePathOptions,
  type ResolveTeamWorkspacePathOptions,
  type TeamManifest,
  type TeamRouteKey,
} from "./team-manifest.js";

/**
 * Generic, host-overridable route resolution over a TeamManifest. The default
 * implementation delegates to the standard REST path builders.
 */
export interface TeamRouteResolver {
  resolveRoutePath(routeKey: TeamRouteKey, options: ResolveTeamRoutePathOptions): string;
  resolveActionApiPath(
    manifest: TeamManifest,
    teamId: string,
    actionId: string,
    options?: ResolveTeamActionContractOptions,
  ): string;
  resolveWorkspaceApiPath(
    manifest: TeamManifest,
    teamId: string,
    keyOrPath: string,
    options?: ResolveTeamWorkspacePathOptions,
  ): string;
  resolveBinding(
    manifest: TeamManifest,
    options: ResolveGatewayRouteBindingOptions,
  ): GatewayResolvedRouteBinding | null;
}

export function createTeamRouteResolver(): TeamRouteResolver {
  return {
    resolveRoutePath(routeKey, options) {
      return resolveTeamRoutePath(routeKey, options);
    },
    resolveActionApiPath(manifest, teamId, actionId, options = {}) {
      return resolveTeamActionApiPath(manifest, teamId, actionId, options);
    },
    resolveWorkspaceApiPath(manifest, teamId, keyOrPath, options = {}) {
      const team = findTeamManifestTeam(manifest, teamId);
      if (!team) {
        throw new Error(`team manifest: unknown team "${teamId}"`);
      }
      return resolveTeamWorkspaceApiPath(team, keyOrPath, options);
    },
    resolveBinding(manifest, options) {
      return resolveGatewayRouteBinding(manifest, options);
    },
  };
}
