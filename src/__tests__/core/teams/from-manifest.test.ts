import { describe, expect, it } from "vitest";
import {
  manifestTeamToTeam,
  teamDirectoryFromManifest,
} from "../../../core/teams/from-manifest.js";
import { TEAM_MANIFEST_VERSION } from "../../../contracts/team-manifest.js";
import { ApiClientError } from "../../../core/errors.js";

describe("manifestTeamToTeam", () => {
  it("derives a complete identity and members from a sparse manifest team", () => {
    expect(
      manifestTeamToTeam({ id: "eng", identity: { name: "Eng" }, members: [{ id: "bob" }] }),
    ).toEqual({
      id: "eng",
      identity: { name: "Eng", displayName: "Eng", slug: "eng", code: "eng", aliases: [] },
      members: [
        {
          id: "bob",
          identity: { name: "bob", displayName: "bob", slug: "bob", code: "bob", aliases: [] },
          capabilities: [],
        },
      ],
      capabilities: [],
    });
  });

  it("passes through explicit identity, capabilities, aliases, and metadata", () => {
    const team = manifestTeamToTeam({
      id: "front-door",
      identity: { name: "Front", displayName: "Front Door", slug: "fd", code: "FD", aliases: ["door"] },
      members: [{ id: "tony", capabilities: ["chat"] }],
      capabilities: ["route"],
      metadata: { portalId: "p1" },
    });
    expect(team.identity).toEqual({ name: "Front", displayName: "Front Door", slug: "fd", code: "FD", aliases: ["door"] });
    expect(team.members[0]).toMatchObject({ id: "tony", capabilities: ["chat"] });
    expect(team.capabilities).toEqual(["route"]);
    expect(team.metadata).toEqual({ portalId: "p1" });
  });

  it("maps an empty-roster team to zero members and omits absent metadata", () => {
    const team = manifestTeamToTeam({ id: "openclaw", members: [] });
    expect(team.members).toEqual([]);
    expect(team).not.toHaveProperty("metadata");
  });
});

describe("teamDirectoryFromManifest", () => {
  const directory = teamDirectoryFromManifest({
    version: TEAM_MANIFEST_VERSION,
    actions: [],
    bindings: [],
    teams: [
      { id: "eng", identity: { name: "Eng", aliases: ["engineering"] }, members: [{ id: "bob" }] },
      { id: "research", members: [] },
    ],
  });

  it("lists and resolves teams by id and alias", () => {
    expect(directory.listTeams().map((t) => t.id)).toEqual(["eng", "research"]);
    expect(directory.resolveTeam("engineering")?.id).toBe("eng");
    expect(directory.requireTeam("research").id).toBe("research");
  });

  it("throws ValidationFailed for an unknown team", () => {
    expect(() => directory.requireTeam("nope")).toThrow(ApiClientError);
  });
});
