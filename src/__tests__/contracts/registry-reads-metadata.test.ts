import { describe, expect, it } from "vitest";
import { createTeamRegistry } from "../../extensions/cavi/registry/team-registry";

describe("registry reads CAVI identity fields from manifest metadata", () => {
  it("maps portalId/sectorSlug/sectorCode out of identity.metadata", () => {
    const registry = createTeamRegistry({
      manifest: {
        version: 1,
        teams: [
          {
            id: "alpha",
            identity: {
              name: "Alpha",
              slug: "alpha",
              code: "ALP",
              metadata: { portalId: "portal-alpha", sectorSlug: "ops", sectorCode: "OPS" },
            },
          },
        ],
      },
    });
    const team = registry.requireTeam("alpha");
    expect(team.portalId).toBe("portal-alpha");
    expect(team.sectorSlug).toBe("ops");
    expect(team.sectorCode).toBe("OPS");
  });
});
