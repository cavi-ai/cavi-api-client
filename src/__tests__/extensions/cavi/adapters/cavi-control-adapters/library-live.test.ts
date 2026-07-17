import { afterEach, describe, expect, it, vi } from "vitest";
import type { JsonHttpRequest } from "../../../../core/http/json-client";
import {
  configureTeamRegistryConfig,
  resetTeamRegistryConfig,
} from "../../../../../extensions/cavi/registry/team-registry-config";
import type { TeamRegistryConfig } from "../../../../../extensions/cavi/registry/team-registry";
import { loadFleetLibraryLive } from "../../../../../extensions/cavi/adapters/cavi-control-adapters/library-live";

const TEST_TEAM_REGISTRY_CONFIG: TeamRegistryConfig = {
  teams: [
    { id: "angela", name: "Angela", portalId: "angela", lead: "angela" },
    { id: "deb", name: "Project Board", portalId: "deb", lead: "deb" },
    { id: "machine", name: "Machine", portalId: "machine", lead: "machine" },
    { id: "martina", name: "Martina", portalId: "martina", lead: "martina" },
    { id: "run-dmc", name: "Run DMC", portalId: "run-dmc", lead: "run-dmc" },
    { id: "scout", name: "Scout", portalId: "scout", lead: "scout" },
    { id: "wu-tang", name: "Wu-Tang", portalId: "wu-tang", lead: "wu-tang" },
  ],
  libraries: {
    fleet: {
      scope: "fleet",
      libraryTeamId: "library",
      lookupKeys: ["fleet-library"],
    },
    teams: [
      { scope: "team", libraryTeamId: "angels", ownerPortalId: "angela" },
      { scope: "team", libraryTeamId: "paw-and-order", ownerPortalId: "deb" },
      { scope: "team", libraryTeamId: "griselda", ownerPortalId: "machine" },
      { scope: "team", libraryTeamId: "headhunter", ownerPortalId: "martina" },
      { scope: "team", libraryTeamId: "run-dmc", ownerPortalId: "run-dmc" },
      { scope: "team", libraryTeamId: "scout-school", ownerPortalId: "scout" },
      { scope: "team", libraryTeamId: "wu-tang", ownerPortalId: "wu-tang" },
    ],
  },
};

describe("loadFleetLibraryLive", () => {
  afterEach(() => {
    resetTeamRegistryConfig();
  });

  it("loads Grand Library status once and builds team rows from the portal registry", async () => {
    configureTeamRegistryConfig(TEST_TEAM_REGISTRY_CONFIG);
    const requestedPaths: string[] = [];
    const requestJson = vi.fn(async (path: string) => {
      requestedPaths.push(path);
      if (path === "/api/plugins/library/fleet-status") {
        return {
          status: "ok",
          sigmund_status: "online",
          last_ingest_at: 1710000000000,
          total_processed: 42,
          inbox: 1,
          inbox_count: 1,
          pending: 2,
          pending_count: 2,
          processed: 42,
          rejected: 0,
        };
      }
      throw new Error(`unexpected path: ${path}`);
    }) as JsonHttpRequest;

    const snapshot = await loadFleetLibraryLive(requestJson);

    expect(snapshot.teams.map((team) => team.teamId)).toEqual([
      "angels",
      "paw-and-order",
      "griselda",
      "headhunter",
      "run-dmc",
      "scout-school",
      "wu-tang",
    ]);
    expect(requestedPaths).toEqual(["/api/plugins/library/fleet-status"]);
    expect(snapshot.sigmund).toEqual({
      status: "online",
      lastIngestAt: 1710000000000,
      totalProcessed: 42,
    });
    expect(snapshot.teams.every((team) => team.qmdHealth.healthy)).toBe(true);
    expect(snapshot.teams.every((team) => team.qmdHealth.collectionSize === 42)).toBe(true);
    expect(snapshot.teams.every((team) => team.inboxCount === 0)).toBe(true);
  });

  it("rejects when Grand Library status fails instead of fabricating a zeroed snapshot", async () => {
    configureTeamRegistryConfig(TEST_TEAM_REGISTRY_CONFIG);
    const requestJson = vi.fn(async (path: string) => {
      if (path === "/api/plugins/library/fleet-status") {
        throw new Error("library status offline");
      }
      throw new Error(`unexpected path: ${path}`);
    }) as JsonHttpRequest;

    await expect(loadFleetLibraryLive(requestJson)).rejects.toThrow(
      "library status offline",
    );
  });

  it("rejects when the app has not loaded team registry config yet", async () => {
    const requestJson = vi.fn(async () => {
      throw new Error("should not request library status before registry config");
    }) as JsonHttpRequest;

    await expect(loadFleetLibraryLive(requestJson)).rejects.toThrow(
      /Team registry config does not define team library refs/u,
    );
  });
});
