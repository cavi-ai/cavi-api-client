import { describe, expect, it } from "vitest";
import {
  createTeamDirectory,
  getTeamLookupKeys,
  matchesTeamIdentifier,
  normalizeTeamLookupValue,
  type Team,
} from "../../../core/teams/index";
import { ApiClientErrorCode, getErrorCode } from "../../../core/errors";

function team(overrides: Partial<Team> & { id: string }): Team {
  return {
    id: overrides.id,
    identity: {
      name: overrides.id,
      displayName: overrides.id,
      slug: overrides.id,
      code: overrides.id,
      aliases: [],
      ...(overrides.identity ?? {}),
    },
    members: overrides.members ?? [],
    capabilities: overrides.capabilities ?? [],
    ...(overrides.metadata ? { metadata: overrides.metadata } : {}),
  };
}

describe("normalizeTeamLookupValue", () => {
  it("lowercases, trims, and hyphenates underscores/whitespace", () => {
    expect(normalizeTeamLookupValue("  Growth_Team  ")).toBe("growth-team");
    expect(normalizeTeamLookupValue("Ops Squad")).toBe("ops-squad");
  });
});

describe("getTeamLookupKeys", () => {
  it("returns unique normalized id/slug/code/aliases", () => {
    const t = team({
      id: "growth",
      identity: { name: "Growth", displayName: "Growth", slug: "growth-eng", code: "GRW", aliases: ["Growth Team", "growth"] },
    });
    expect(getTeamLookupKeys(t)).toEqual(["growth", "growth-eng", "grw", "growth-team"]);
  });
});

describe("matchesTeamIdentifier", () => {
  it("matches by any normalized identity token, ignores blanks", () => {
    const t = team({ id: "growth", identity: { name: "G", displayName: "G", slug: "growth-eng", code: "GRW", aliases: [] } });
    expect(matchesTeamIdentifier(t, "GRW")).toBe(true);
    expect(matchesTeamIdentifier(t, "growth_eng")).toBe(true);
    expect(matchesTeamIdentifier(t, "   ")).toBe(false);
    expect(matchesTeamIdentifier(t, "unknown")).toBe(false);
  });
});

describe("createTeamDirectory", () => {
  const growth = team({
    id: "growth",
    identity: { name: "Growth", displayName: "Growth", slug: "growth-eng", code: "GRW", aliases: ["legacy-growth"] },
    members: [
      { id: "m1", identity: { name: "Ann", displayName: "Ann", slug: "ann", code: "ANN", aliases: [] }, capabilities: [] },
    ],
  });
  const ops = team({ id: "ops", identity: { name: "Ops", displayName: "Ops", slug: "ops", code: "OPS", aliases: [] } });

  it("lists teams and resolves by any identity token", () => {
    const dir = createTeamDirectory([growth, ops]);
    expect(dir.listTeams().map((t) => t.id)).toEqual(["growth", "ops"]);
    expect(dir.resolveTeam("GRW")?.id).toBe("growth");
    expect(dir.resolveTeam("legacy-growth")?.id).toBe("growth");
    expect(dir.resolveTeam("nope")).toBeNull();
  });

  it("requireTeam throws ValidationFailed on miss", () => {
    const dir = createTeamDirectory([growth]);
    expect(dir.requireTeam("growth").id).toBe("growth");
    try {
      dir.requireTeam("missing");
      throw new Error("did not throw");
    } catch (error) {
      expect(getErrorCode(error)).toBe(ApiClientErrorCode.ValidationFailed);
    }
  });

  it("resolves members and lists them", () => {
    const dir = createTeamDirectory([growth]);
    expect(dir.listMembers("growth").map((m) => m.id)).toEqual(["m1"]);
    expect(dir.resolveMember("growth", "ANN")?.id).toBe("m1");
    expect(dir.resolveMember("growth", "ghost")).toBeNull();
  });

  it("throws Conflict on ambiguous lookup keys", () => {
    const clash = team({ id: "other", identity: { name: "O", displayName: "O", slug: "growth-eng", code: "X", aliases: [] } });
    try {
      createTeamDirectory([growth, clash]);
      throw new Error("did not throw");
    } catch (error) {
      expect(getErrorCode(error)).toBe(ApiClientErrorCode.Conflict);
    }
  });
});
