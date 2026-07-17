import { describe, expect, it } from "vitest";
import { createTeamDirectoryFromManifest } from "../../contracts/team-directory";
import type { TeamManifest } from "../../contracts/team-manifest";

const manifest: TeamManifest = {
  version: 1,
  teams: [
    {
      id: "growth",
      identity: { name: "Growth", displayName: "Growth Team", slug: "growth-eng", code: "GRW", aliases: ["legacy-growth"] },
      members: [{ id: "ann", identity: { name: "Ann", slug: "ann", code: "ANN" }, capabilities: ["review"] }],
      capabilities: ["kanban"],
    },
  ],
};

describe("createTeamDirectoryFromManifest", () => {
  it("projects manifest teams into a canonical directory", () => {
    const dir = createTeamDirectoryFromManifest(manifest);
    const team = dir.requireTeam("GRW");
    expect(team.id).toBe("growth");
    expect(team.identity.displayName).toBe("Growth Team");
    expect(team.identity.aliases).toContain("legacy-growth");
    expect(dir.resolveMember("growth", "ANN")?.id).toBe("ann");
    expect(dir.resolveTeam("legacy-growth")?.id).toBe("growth");
  });
});
