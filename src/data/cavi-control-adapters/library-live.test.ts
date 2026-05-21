import { describe, expect, it, vi } from "vitest";
import type { CaviControlRequestJson } from "../cavi-control/http-client";
import { loadFleetLibraryLive } from "./library-live";

describe("loadFleetLibraryLive", () => {
  it("loads Grand Library status once and builds team rows from the portal registry", async () => {
    const requestedPaths: string[] = [];
    const requestJson = vi.fn(async (path: string) => {
      requestedPaths.push(path);
      if (path === "/library/api/fleet-status") {
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
    }) as CaviControlRequestJson;

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
    expect(requestedPaths).toEqual(["/library/api/fleet-status"]);
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
    const requestJson = vi.fn(async (path: string) => {
      if (path === "/library/api/fleet-status") {
        throw new Error("library status offline");
      }
      throw new Error(`unexpected path: ${path}`);
    }) as CaviControlRequestJson;

    await expect(loadFleetLibraryLive(requestJson)).rejects.toThrow(
      "library status offline",
    );
  });
});
