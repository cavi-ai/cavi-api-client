import { describe, expect, it } from "vitest";
import { createTeamDirectoryFromManifest } from "../../contracts/team-directory";
import type { TeamManifest } from "../../contracts/team-manifest";
import {
  inspectTeamDirectoryConformance,
  validateTeam,
} from "../../testing/team-directory-conformance";

const manifest: TeamManifest = {
  version: 1,
  teams: [
    { id: "growth", identity: { name: "Growth", displayName: "Growth", slug: "growth-eng", code: "GRW", aliases: ["legacy"] }, members: [], capabilities: [] },
    { id: "ops", identity: { name: "Ops", displayName: "Ops", slug: "ops", code: "OPS", aliases: [] }, members: [], capabilities: [] },
  ],
};

describe("team directory conformance kit", () => {
  it("passes for a canonical directory built from a manifest", () => {
    const report = inspectTeamDirectoryConformance(createTeamDirectoryFromManifest(manifest));
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });

  it("validateTeam flags a malformed team", () => {
    const errors = validateTeam({
      id: "",
      identity: { name: "x", displayName: "x", slug: "x", code: "x", aliases: [] },
      members: [],
      capabilities: [],
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});
