import { afterEach, describe, expect, it } from "vitest";
import {
  TEAM_REGISTRY_CONFIG,
  configureTeamRegistryConfig,
  createHermesTeamRegistry,
  createOpenClawTeamRegistry,
  createTeamRegistry,
  getConfiguredTeamRegistry,
  resetTeamRegistryConfig,
  type TeamRegistryConfig,
} from "./index";

const TEST_TEAM_REGISTRY_CONFIG: TeamRegistryConfig = {
  provider: "openclaw",
  teams: [
    {
      id: "research",
      name: "Research",
      displayName: "Research Team",
      teamSlug: "research",
      teamCode: "RND",
      portalId: "scout",
      lead: "scout",
      legacyAliases: ["scout-school"],
    },
  ],
  libraries: {
    fleet: {
      scope: "fleet",
      libraryTeamId: "library",
      lookupKeys: ["fleet-library"],
    },
    teams: [
      {
        scope: "team",
        libraryTeamId: "scout-school",
        ownerPortalId: "scout",
        lookupKeys: ["research-docs"],
      },
    ],
  },
};

describe("team registry", () => {
  afterEach(() => {
    resetTeamRegistryConfig();
  });

  it("normalizes supplied registry config instead of using baked package teams", () => {
    const registry = createTeamRegistry(TEST_TEAM_REGISTRY_CONFIG);

    expect(registry.provider).toBe("openclaw");
    expect(registry.listPortalIds()).toEqual(["scout"]);
    expect(registry.resolveTeam("scout-school")?.teamCode).toBe("RND");
    expect(registry.getPortalTeamCode("scout")).toBe("RND");
    expect(registry.resolveLibraryRefByTeamIdentity("research-docs")).toEqual({
      scope: "team",
      libraryTeamId: "scout-school",
      ownerPortalId: "scout",
    });
  });

  it("fails loudly when a registry-dependent lookup runs before config is loaded", () => {
    expect(() => createTeamRegistry().getPortalTeam("scout")).toThrow(
      /Team registry is not configured/u,
    );
  });

  it("keeps provider implementations separate from registry config", () => {
    expect(createHermesTeamRegistry(TEST_TEAM_REGISTRY_CONFIG).provider).toBe(
      "hermes",
    );
    expect(createOpenClawTeamRegistry(TEST_TEAM_REGISTRY_CONFIG).provider).toBe(
      "openclaw",
    );
  });

  it("lets the app populate TEAM_REGISTRY_CONFIG after loading runtime config", () => {
    configureTeamRegistryConfig(TEST_TEAM_REGISTRY_CONFIG);

    expect(TEAM_REGISTRY_CONFIG.teams?.map((team) => team.id)).toEqual([
      "research",
    ]);
    expect(getConfiguredTeamRegistry().getPortalTeamSlug("scout")).toBe(
      "research",
    );
  });
});
