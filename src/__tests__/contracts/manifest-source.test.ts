import { describe, expect, it } from "vitest";
import {
  createStaticManifestSource,
  createCachedManifestSource,
} from "../../contracts/manifest-source";

describe("TeamManifestSource", () => {
  it("static source normalizes and returns the manifest", async () => {
    const source = createStaticManifestSource({
      version: 1,
      teams: [{ id: "alpha" }],
    });
    const manifest = await source.getManifest();
    expect(manifest.teams[0]?.id).toBe("alpha");
    expect(manifest.version).toBe(1);
  });

  it("empty/undefined static source falls back to the default manifest", async () => {
    const source = createStaticManifestSource(null);
    const manifest = await source.getManifest();
    expect(manifest.teams.length).toBeGreaterThan(0); // default manifest
  });

  it("cached source loads once until refreshed", async () => {
    let calls = 0;
    const source = createCachedManifestSource(() => {
      calls += 1;
      return { version: 1, teams: [{ id: `team-${calls}` }] };
    });
    const first = await source.getManifest();
    const second = await source.getManifest();
    expect(calls).toBe(1);
    expect(first.teams[0]?.id).toBe("team-1");
    expect(second.teams[0]?.id).toBe("team-1");

    const refreshed = await source.refresh();
    expect(calls).toBe(2);
    expect(refreshed.teams[0]?.id).toBe("team-2");
  });
});
