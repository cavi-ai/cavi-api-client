import { describe, expect, it, vi } from "vitest";
import {
  buildManagedAgentTeamsPlan,
  provisionManagedAgentTeams,
  type ManagedAgentCreator,
} from "../../../../providers/claude/managed-agents/teams";
import {
  TEAM_MANIFEST_VERSION,
  type TeamManifest,
} from "../../../../contracts/team-manifest";
import { ApiClientErrorCode, getErrorCode } from "../../../../core/errors";

const MANIFEST: TeamManifest = {
  version: TEAM_MANIFEST_VERSION,
  teams: [
    {
      id: "research",
      identity: { displayName: "Research Team" },
      metadata: { claude: { model: "claude-opus-4-8", system: "Coordinate research." } },
      members: [
        {
          id: "scout",
          identity: { displayName: "Scout" },
          metadata: {
            claude: {
              model: "claude-opus-4-8",
              system: "Find sources.",
              tools: [{ type: "agent_toolset_20260401" }],
            },
          },
        },
        { id: "writer", identity: { name: "Writer" } },
      ],
    },
  ],
};

describe("buildManagedAgentTeamsPlan", () => {
  it("maps a team to a coordinator + roster, reading config from metadata and defaults", () => {
    const plan = buildManagedAgentTeamsPlan(MANIFEST, {
      memberDefaults: { model: "claude-sonnet-4-6" },
    });

    expect(plan.teams).toHaveLength(1);
    const team = plan.teams[0]!;
    expect(team.teamId).toBe("research");

    // Member with explicit config keeps its model + system + tools.
    const scout = team.members[0]!;
    expect(scout.memberId).toBe("scout");
    expect(scout.agent).toMatchObject({
      name: "Scout",
      model: "claude-opus-4-8",
      system: "Find sources.",
      tools: [{ type: "agent_toolset_20260401" }],
      metadata: { team: "research", member: "scout" },
    });

    // Member with no config falls back to the default model.
    const writer = team.members[1]!;
    expect(writer.agent).toMatchObject({ name: "Writer", model: "claude-sonnet-4-6" });

    // Coordinator gets the team's config; multiagent is filled at provision time, not here.
    expect(team.coordinator).toMatchObject({
      name: "Research Team",
      model: "claude-opus-4-8",
      system: "Coordinate research.",
      metadata: { team: "research", role: "coordinator" },
    });
    expect(team.coordinator.multiagent).toBeUndefined();
  });

  it("throws ValidationFailed when no model can be resolved for a member", () => {
    try {
      buildManagedAgentTeamsPlan(MANIFEST); // writer has no model and no default
      expect.fail("expected buildManagedAgentTeamsPlan to throw");
    } catch (error) {
      expect(getErrorCode(error)).toBe(ApiClientErrorCode.ValidationFailed);
    }
  });
});

describe("provisionManagedAgentTeams", () => {
  it("creates roster members first, then the coordinator referencing their ids", async () => {
    let n = 0;
    const created: string[] = [];
    const createAgent = vi.fn(async (params: { name: string; multiagent?: unknown }) => {
      created.push(params.name);
      return { id: `agent_${++n}`, version: 100 + n };
    });
    const client: ManagedAgentCreator = { createAgent };

    const result = await provisionManagedAgentTeams(client, MANIFEST, {
      memberDefaults: { model: "claude-sonnet-4-6" },
    });

    // Members provisioned before coordinator.
    expect(created).toEqual(["Scout", "Writer", "Research Team"]);

    // Coordinator's roster references the two member agent ids.
    const coordinatorCall = createAgent.mock.calls[2]![0] as { multiagent?: unknown };
    expect(coordinatorCall.multiagent).toEqual({
      type: "coordinator",
      agents: ["agent_1", "agent_2"],
    });

    expect(result.teams[0]).toEqual({
      teamId: "research",
      coordinatorAgentId: "agent_3",
      coordinatorVersion: 103,
      members: [
        { memberId: "scout", agentId: "agent_1", version: 101 },
        { memberId: "writer", agentId: "agent_2", version: 102 },
      ],
    });
  });
});
