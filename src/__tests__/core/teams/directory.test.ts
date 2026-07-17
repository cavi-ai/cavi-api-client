import { describe, expect, it } from "vitest";
import {
  createTeamDirectory,
  getTeamLookupKeys,
  matchesTeamIdentifier,
  normalizeTeamLookupValue,
  type Team,
} from "../../../core/teams/index";

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
