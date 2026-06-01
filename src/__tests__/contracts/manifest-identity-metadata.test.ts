import { describe, expect, it } from "vitest";
import { normalizeTeamManifest, type ManifestIdentity } from "../../contracts/team-manifest";

describe("ManifestIdentity is provider-agnostic", () => {
  it("keeps generic identity fields and a metadata bag", () => {
    const manifest = normalizeTeamManifest({
      version: 1,
      teams: [
        {
          id: "alpha",
          identity: {
            name: "Alpha",
            slug: "alpha",
            aliases: ["a"],
            metadata: { portalId: "p-1", sectorSlug: "ops", sectorCode: "OPS" },
          },
        },
      ],
    });
    const identity = manifest.teams[0]?.identity as ManifestIdentity;
    expect(identity.name).toBe("Alpha");
    expect(identity.metadata?.portalId).toBe("p-1");
  });

  it("does not expose CAVI-specific fields as first-class identity keys", () => {
    // Compile-time intent: portalId/sectorSlug/sectorCode are NOT on ManifestIdentity.
    const identity: ManifestIdentity = { name: "x", metadata: { portalId: "p" } };
    expect("portalId" in identity).toBe(false);
    expect(identity.metadata?.portalId).toBe("p");
  });
});
