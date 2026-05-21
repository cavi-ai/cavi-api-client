import type { DebWorkspaceSnapshot } from "../../domain/index.js";
import { resolveDebAssetPath } from "../../data/cavi-control/runtime-paths.js";
import { mockNow as now } from "./shared.js";

export const mockDebWorkspace: DebWorkspaceSnapshot = {
  profile: {
    name: "Deb",
    role: "Project Board Operator",
    photoPath: resolveDebAssetPath("deb-wave.png"),
    photoUrl: null,
    avatarCandidates: [
      resolveDebAssetPath("deb-wave.png"),
      resolveDebAssetPath("deb-reports.png"),
      resolveDebAssetPath("deb-laptop.png"),
    ],
    emails: ["ops@bloktix.io", "release-managers@bloktix.io"],
    lastUpdated: now - 16 * 60_000,
    storage: "json-file",
    limitations: ["Mock fallback data for Cavi Control Deb workspace."],
  },
  emails: [
    { id: "ops@bloktix.io", email: "ops@bloktix.io" },
    { id: "release-managers@bloktix.io", email: "release-managers@bloktix.io" },
  ],
  sprint: {
    sprint: {
      id: "current",
      name: "Sprint 2026-W14",
      goal: "Cavi Control store path realignment and Deb data pipeline fixes",
      startsOn: "2026-03-31",
      endsOn: "2026-04-06",
    },
    statusMetrics: {
      total: 4,
      todo: 1,
      inProgress: 1,
      blocked: 1,
      done: 1,
      completionRate: 0.25,
    },
    lastUpdated: now - 14 * 60_000,
    storage: "json-file",
    limitations: ["Mock fallback data for Cavi Control Deb workspace."],
  },
  backlog: {
    sections: [
      {
        section: "now",
        items: [
          {
            id: "deb-backlog-2",
            title: "Fix store path alignment for deb-store.json",
            description: "Move deb-store.json from state/cavi-control/ to state/runtime/ to match workspace layout.",
            section: "now",
            priority: "p0",
            status: "in_progress",
            tags: ["infra", "store"],
            createdAt: now - 120 * 60_000,
            updatedAt: now - 20 * 60_000,
          },
        ],
      },
      {
        section: "blocked",
        items: [
          {
            id: "deb-backlog-3",
            title: "Validate Deb API contract parity after store migration",
            description: "Waiting on rebuilt Deb container to verify response field alignment.",
            section: "blocked",
            priority: "p0",
            status: "blocked",
            tags: ["contract", "api"],
            createdAt: now - 180 * 60_000,
            updatedAt: now - 65 * 60_000,
          },
        ],
      },
      {
        section: "next",
        items: [
          {
            id: "deb-backlog-1",
            title: "Update mock fallback data to current sprint",
            description: "Refresh mock backlog items and sprint metadata for W14.",
            section: "next",
            priority: "p1",
            status: "todo",
            tags: ["ui", "mock"],
            createdAt: now - 200 * 60_000,
            updatedAt: now - 45 * 60_000,
          },
        ],
      },
      {
        section: "done",
        items: [
          {
            id: "deb-backlog-4",
            title: "Add boot-time sync to Deb server startup",
            description: "GitHub field cache refreshed automatically on container start.",
            section: "done",
            priority: "p2",
            status: "done",
            tags: ["infra", "sync"],
            createdAt: now - 210 * 60_000,
            updatedAt: now - 90 * 60_000,
          },
        ],
      },
    ],
    priorities: {
      p0: 2,
      p1: 1,
      p2: 1,
      p3: 0,
    },
    statusCounters: {
      todo: 1,
      in_progress: 1,
      blocked: 1,
      done: 1,
    },
    totalItems: 4,
    lastUpdated: now - 20 * 60_000,
    storage: "json-file",
    limitations: ["Mock fallback data for Cavi Control Deb workspace."],
  },
};
