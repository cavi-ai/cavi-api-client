import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseProjectBoardCallAck,
  sortBacklogItems,
  toProjectBoardProfile,
  toProjectBoardWorkspaceSnapshot,
} from "../../../../extensions/cavi/project-board/normalize";

type RuntimeBaseOverrideGlobal = typeof globalThis & {
  __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
};

function setRuntimeBaseOverride(value: string | undefined) {
  const runtimeGlobal = globalThis as RuntimeBaseOverrideGlobal;
  if (value === undefined) {
    delete runtimeGlobal.__OPENCLAW_CAVI_CONTROL_BASE_PATH__;
    return;
  }
  runtimeGlobal.__OPENCLAW_CAVI_CONTROL_BASE_PATH__ = value;
}

describe("Project Board asset path normalization", () => {
  afterEach(() => {
    setRuntimeBaseOverride(undefined);
  });

  it("maps legacy /cavi-control/deb assets to standalone root paths", async () => {
    setRuntimeBaseOverride("/");
    vi.resetModules();
    const { toProjectBoardProfile } = await import("../../../../extensions/cavi/project-board/normalize");

    const profile = toProjectBoardProfile({
      name: "Project Board",
      role: "Project Board Operator",
      photoPath: "/cavi-control/deb/deb-wave.png",
      photoUrl: null,
      emails: [],
      limitations: [],
    });

    expect(profile.avatarCandidates).toContain("/deb/deb-wave.png");
    expect(
      profile.avatarCandidates.some((entry: string) =>
        entry.startsWith("/cavi-control/deb/"),
      ),
    ).toBe(false);
  });

  it("keeps embedded /cavi-control/deb asset paths when base path is /cavi-control/", async () => {
    setRuntimeBaseOverride("/cavi-control/");
    vi.resetModules();
    const { toProjectBoardProfile } = await import("../../../../extensions/cavi/project-board/normalize");

    const profile = toProjectBoardProfile({
      name: "Project Board",
      role: "Project Board Operator",
      photoPath: "/cavi-control/deb/deb-wave.png",
      photoUrl: null,
      emails: [],
      limitations: [],
    });

    expect(profile.avatarCandidates).toContain(
      "/cavi-control/deb/deb-wave.png",
    );
  });
});

describe("Project Board pod / gateway response shape compatibility", () => {
  it("sorts backlog items when Array.prototype.toSorted is unavailable", () => {
    const originalToSorted = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "toSorted",
    );

    Object.defineProperty(Array.prototype, "toSorted", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    try {
      const sorted = sortBacklogItems([
        {
          id: "old-p2",
          title: "Old P2",
          description: null,
          section: "doing",
          priority: "p2",
          status: "todo",
          tags: [],
          createdAt: 1,
          updatedAt: 10,
        },
        {
          id: "p0",
          title: "P0",
          description: null,
          section: "doing",
          priority: "p0",
          status: "blocked",
          tags: [],
          createdAt: 2,
          updatedAt: 20,
        },
        {
          id: "new-p2",
          title: "New P2",
          description: null,
          section: "doing",
          priority: "p2",
          status: "in_progress",
          tags: [],
          createdAt: 3,
          updatedAt: 30,
        },
      ]);

      expect(sorted.map((item) => item.id)).toEqual([
        "p0",
        "new-p2",
        "old-p2",
      ]);
    } finally {
      if (originalToSorted) {
        Object.defineProperty(Array.prototype, "toSorted", originalToSorted);
      } else {
        delete (Array.prototype as Partial<Array<unknown>>).toSorted;
      }
    }
  });

  it("maps updatedAt to profile lastUpdated and omits shim fields", () => {
    const profile = toProjectBoardProfile({
      name: "Project Board",
      role: "project-ops-paw-and-order",
      emails: ["deb@example.com"],
      photoUrl: null,
      updatedAt: 1711800000000,
    });

    expect(profile.lastUpdated).toBe(1711800000000);
    expect(profile.limitations).toEqual([]);
    expect(profile.emails).toEqual(["deb@example.com"]);
  });

  it("still accepts gateway shim lastUpdated, storage, and limitations", () => {
    const profile = toProjectBoardProfile({
      name: "Project Board",
      role: "Project Board Operator",
      photoPath: null,
      photoUrl: null,
      emails: [],
      lastUpdated: 99,
      storage: "json-file",
      limitations: ["legacy limitation"],
    });

    expect(profile.lastUpdated).toBe(99);
    expect(profile.limitations).toEqual(["legacy limitation"]);
  });

  it("accepts sprint updatedAt and optional limitations", () => {
    const ws = toProjectBoardWorkspaceSnapshot({
      profilePayload: {
        name: "Project Board",
        role: "r",
        emails: [],
        updatedAt: 1,
      },
      sprintPayload: {
        sprint: {
          id: "current",
          name: "S",
          goal: "g",
          startsOn: null,
          endsOn: null,
        },
        statusMetrics: {
          total: 0,
          todo: 0,
          inProgress: 0,
          blocked: 0,
          done: 0,
          completionRate: 0,
        },
        updatedAt: 42,
      },
      backlogPayload: {
        sections: [],
        priorities: { p0: 0, p1: 0, p2: 0, p3: 0 },
        statusCounters: {
          todo: 0,
          in_progress: 0,
          blocked: 0,
          done: 0,
        },
        totalItems: 0,
        updatedAt: 43,
      },
    });

    expect(ws.sprint.lastUpdated).toBe(42);
    expect(ws.sprint.limitations).toEqual([]);
    expect(ws.backlog.lastUpdated).toBe(43);
    expect(ws.backlog.limitations).toEqual([]);
  });

  it("parseProjectBoardCallAck tolerates missing limitations on pod ack", () => {
    const traceId = "t1";
    const result = parseProjectBoardCallAck(
      {
        ackId: "a1",
        queuedAt: 100,
        queueDepth: 2,
        note: "ok",
        action: "x",
        requestedBy: "y",
      },
      { action: "x", requestedBy: "y", traceId },
    );

    expect(result.limitations).toEqual([]);
    expect(result.traceId).toBe(traceId);
  });
});
