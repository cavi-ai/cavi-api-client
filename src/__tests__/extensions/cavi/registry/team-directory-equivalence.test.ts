import { describe, expect, it } from "vitest";
import { createTeamRegistry } from "../../../../extensions/cavi/registry/team-registry";
import { createTeamDirectoryFromManifest } from "../../../../contracts/team-directory";
import type { TeamManifest } from "../../../../contracts/team-manifest";

const manifest: TeamManifest = {
  version: 1,
  teams: [
    { id: "growth", identity: { name: "Growth", displayName: "Growth", slug: "growth-eng", code: "GRW", aliases: ["legacy-growth"] }, members: [], capabilities: [] },
    { id: "ops", identity: { name: "Ops", displayName: "Ops", slug: "ops-squad", code: "OPS", aliases: [] }, members: [], capabilities: [] },
  ],
};

describe("CAVI registry ≡ canonical directory (identity tokens)", () => {
  it("resolves each team to the same id by id/slug/code/alias", () => {
    const registry = createTeamRegistry({ manifest });
    const directory = createTeamDirectoryFromManifest(manifest);

    for (const canonical of directory.listTeams()) {
      const tokens = [canonical.id, canonical.identity.slug, canonical.identity.code, ...canonical.identity.aliases];
      for (const token of tokens) {
        expect(registry.resolveTeam(token)?.id).toBe(canonical.id);
        expect(directory.resolveTeam(token)?.id).toBe(canonical.id);
      }
    }
  });
});
