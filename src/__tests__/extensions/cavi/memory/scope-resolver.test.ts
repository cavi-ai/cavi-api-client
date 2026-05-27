import { describe, expect, it } from "vitest";
import { resolveMemoryScope } from "../../../../extensions/cavi/memory/scope-resolver.js";
import type { TeamManifest } from "../../../../contracts/team-manifest.js";

const manifest: TeamManifest = {
  version: 1 as TeamManifest["version"],
  teams: [
    {
      id: "team-alpha",
      members: [
        { id: "member-one", identity: { slug: "member-one", aliases: ["m1"] } },
        { id: "member-two" },
      ],
    },
    {
      id: "team-beta",
      identity: { slug: "team-beta", aliases: ["beta"] },
      members: [{ id: "member-three" }, { id: "member-four", identity: { name: "Member Four" } }],
    },
  ],
};

describe("resolveMemoryScope", () => {
  it("maps a member to { domain, member } using its primary (nesting) team", () => {
    expect(resolveMemoryScope(manifest, "member-one")).toEqual({
      domain: "team-alpha",
      member: "member-one",
    });
    expect(resolveMemoryScope(manifest, "member-three")).toEqual({
      domain: "team-beta",
      member: "member-three",
    });
  });

  it("maps a team name to { domain }", () => {
    expect(resolveMemoryScope(manifest, "team-alpha")).toEqual({ domain: "team-alpha" });
  });

  it("matches case-insensitively across id, slug, name, and aliases", () => {
    expect(resolveMemoryScope(manifest, "M1")).toEqual({
      domain: "team-alpha",
      member: "member-one",
    });
    expect(resolveMemoryScope(manifest, "Member Four")).toEqual({
      domain: "team-beta",
      member: "member-four",
    });
    expect(resolveMemoryScope(manifest, "beta")).toEqual({ domain: "team-beta" });
  });

  it("prefers a member match over a team match", () => {
    const m: TeamManifest = {
      version: 1 as TeamManifest["version"],
      teams: [{ id: "shared", members: [{ id: "shared" }] }],
    };
    expect(resolveMemoryScope(m, "shared")).toEqual({ domain: "shared", member: "shared" });
  });

  it("returns undefined for an unknown name", () => {
    expect(resolveMemoryScope(manifest, "nobody")).toBeUndefined();
  });
});
