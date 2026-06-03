import { describe, expect, it } from "vitest";

import {
  normalizeTeamManifest,
  resolveTeamActionApiPath,
} from "../../contracts/team-manifest";

describe("resolveTeamActionApiPath route params + query", () => {
  const manifest = normalizeTeamManifest({
    version: 1,
    teams: [
      {
        id: "fleet",
        members: [
          {
            id: "machine",
            actions: [
              { id: "media", route: { method: "GET", path: "/api/plugins/machine/media" } },
              { id: "run", route: { method: "GET", path: "/api/plugins/portal/martina/runs/{runId}" } },
              {
                id: "artifact",
                route: {
                  method: "GET",
                  path: "/api/plugins/portal/martina/artifacts/{bucket}/{name}",
                },
              },
            ],
          },
        ],
      },
    ],
  });

  it("substitutes path tokens, encoding each value", () => {
    expect(
      resolveTeamActionApiPath(manifest, "fleet", "artifact", {
        memberId: "machine",
        params: { bucket: "docs", name: "a b.md" },
      }),
    ).toBe("/api/plugins/portal/martina/artifacts/docs/a%20b.md");
  });

  it("appends a query string via appendHttpQuery", () => {
    expect(
      resolveTeamActionApiPath(manifest, "fleet", "media", {
        memberId: "machine",
        query: { name: "clip.mp3" },
      }),
    ).toBe("/api/plugins/machine/media?name=clip.mp3");
  });

  it("throws when a required path token has no param", () => {
    expect(() =>
      resolveTeamActionApiPath(manifest, "fleet", "run", { memberId: "machine" }),
    ).toThrow(/missing route param "runId"/);
  });

  it("leaves token-free paths unchanged (backward compatible)", () => {
    expect(
      resolveTeamActionApiPath(manifest, "fleet", "media", { memberId: "machine" }),
    ).toBe("/api/plugins/machine/media");
  });
});
