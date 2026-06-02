import { afterEach, describe, expect, it } from "vitest";
import {
  findTeamManifestTeam,
  normalizeTeamManifest,
  resolveGatewayRouteBinding,
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamWorkspaceApiPath,
  resolveTeamWorkspacePath,
} from "../../../../index";
import {
  configureTeamRegistryConfig,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
} from "../../../../extensions/cavi/index";
import { createOpenClawTeamRegistry } from "../../../../providers/openclaw/index";
import {
  CAVI_TEAM_MANIFEST,
  createCaviTeamRegistryConfig,
} from "../../../fixtures/cavi-team-manifest";

describe("CAVI team manifest fixture", () => {
  afterEach(() => {
    resetTeamRegistryConfig();
  });

  it("normalizes our teams and resolves workspace, action, and binding routes", () => {
    const manifest = normalizeTeamManifest(CAVI_TEAM_MANIFEST);

    expect(manifest.teams.map((team) => team.id)).toEqual([
      "control-plane",
      "research",
      "project-ops",
      "machine",
    ]);

    const research = findTeamManifestTeam(manifest, "research");
    expect(research).not.toBeNull();
    expect(resolveTeamWorkspaceApiPath(research!, "media.images", {
      memberId: "research-operator",
    })).toBe(
      "/api/teams/research/agents/research-operator/workspace/media/images",
    );
    expect(resolveTeamWorkspacePath(research!, "state.public")).toBe(
      "/teams/research/workspace-research/state/public",
    );

    expect(resolveTeamActionApiPath(manifest, "project-ops", "sync-backlog", {
      memberId: "project-board",
    })).toBe(
      "/api/teams/project-ops/agents/project-board/actions/sync-backlog",
    );
    expect(resolveTeamActionContract(manifest, "research", "summarize", {
      memberId: "research-operator",
    }).defaults).toEqual({ lane: "research-operator" });

    expect(resolveGatewayRouteBinding(manifest, {
      source: "chat",
      key: "agent:research-operator:main",
      agentId: "research-operator",
    })).toMatchObject({
      id: "research-chat",
      path: "/api/teams/research/agents/research-operator/config",
    });
    expect(resolveGatewayRouteBinding(manifest, {
      source: "portal",
      channel: "deb",
    })).toMatchObject({
      id: "project-board-sync",
      path: "/api/teams/project-ops/agents/project-board/actions/sync-backlog",
    });
  });

  it("feeds the CAVI registry without baked package defaults", () => {
    const config = createCaviTeamRegistryConfig();
    const registry = createOpenClawTeamRegistry(config);

    expect(registry.provider).toBe("openclaw");
    expect(registry.listPortalIds()).toEqual([
      "operator",
      "scout",
      "deb",
      "machine",
    ]);
    expect(registry.getPortalTeamCode("scout")).toBe("RND");
    expect(registry.resolveTeam("project-board")?.id).toBe("project-ops");
    expect(registry.resolveLibraryRefByTeamIdentity("research-docs")).toEqual({
      scope: "team",
      libraryTeamId: "research-library",
      ownerPortalId: "scout",
    });

    configureTeamRegistryConfig(config);
    expect(getConfiguredTeamRegistry().getPortalTeamSlug("deb")).toBe(
      "project-ops",
    );
  });
});
