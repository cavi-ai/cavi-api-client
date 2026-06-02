import { describe, expect, it } from "vitest";
import { createTeamRouteResolver } from "../../contracts/route-resolver";
import { normalizeTeamManifest } from "../../contracts/team-manifest";

const manifest = normalizeTeamManifest({
  version: 1,
  teams: [
    {
      id: "alpha",
      members: [{ id: "agent-1", workspace: { rootPath: "/srv", paths: ["notes"] } }],
      workspace: { rootPath: "/srv", paths: ["notes"] },
    },
  ],
});

describe("TeamRouteResolver", () => {
  const resolver = createTeamRouteResolver();

  it("resolves a team route path", () => {
    expect(resolver.resolveRoutePath("config", { teamId: "alpha" })).toBe(
      "/api/teams/alpha/config",
    );
  });

  it("resolves an agent route path", () => {
    expect(
      resolver.resolveRoutePath("agent.config", { teamId: "alpha", agentId: "agent-1" }),
    ).toBe("/api/teams/alpha/agents/agent-1/config");
  });

  it("resolves a workspace api path from a manifest + teamId", () => {
    expect(resolver.resolveWorkspaceApiPath(manifest, "alpha", "notes")).toBe(
      "/api/teams/alpha/workspace/notes",
    );
  });
});
