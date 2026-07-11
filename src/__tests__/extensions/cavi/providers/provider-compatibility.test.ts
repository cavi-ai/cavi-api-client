import { describe, expect, it } from "vitest";
import { createHermesTeamRegistry as createLegacyHermes } from "../../../../providers/hermes/team-registry";
import { createOpenClawTeamRegistry as createLegacyOpenClaw } from "../../../../providers/openclaw/team-registry";
import {
  createHermesTeamRegistry,
  createOpenClawTeamRegistry,
} from "../../../../extensions/cavi/providers/index";

describe("CAVI provider compatibility ownership", () => {
  it("preserves legacy Hermes and OpenClaw team registry behavior", () => {
    expect(createLegacyHermes().listTeams()).toEqual(createHermesTeamRegistry().listTeams());
    expect(createLegacyOpenClaw().listTeams()).toEqual(createOpenClawTeamRegistry().listTeams());
  });
});
