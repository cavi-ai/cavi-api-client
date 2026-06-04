import { describe, expect, it, vi } from "vitest";

import { createOpenClawWorkboardRpc } from "../../../../providers/openclaw/index.js";
import type { JsonHttpRequest } from "../../../../core/http/json-client.js";
import { createProjectBoardLiveHelpers } from "../../../../extensions/cavi/project-board/live.js";
import { createProjectBoardMutations } from "../../../../extensions/cavi/project-board/mutations.js";
import {
  projectBoardPriorityToWorkboard,
  projectBoardStatusToWorkboard,
  workboardCardToProjectBoardBacklogItem,
} from "../../../../extensions/cavi/project-board/workboard-adapter.js";

describe("CAVI Project Board Workboard adapter", () => {
  it("maps CAVI backlog status and priority to native Workboard fields", () => {
    expect(projectBoardStatusToWorkboard("todo")).toBe("todo");
    expect(projectBoardStatusToWorkboard("in_progress")).toBe("running");
    expect(projectBoardStatusToWorkboard("blocked")).toBe("blocked");
    expect(projectBoardStatusToWorkboard("done")).toBe("done");
    expect(projectBoardPriorityToWorkboard("p0")).toBe("urgent");
    expect(projectBoardPriorityToWorkboard("p1")).toBe("high");
    expect(projectBoardPriorityToWorkboard("p2")).toBe("normal");
    expect(projectBoardPriorityToWorkboard("p3")).toBe("low");
  });

  it("projects a native Workboard card into legacy ProjectBoard backlog shape", () => {
    const item = workboardCardToProjectBoardBacklogItem({
      id: "card-1",
      title: "Triage operator handoff",
      notes: "Needs owner",
      status: "triage",
      priority: "urgent",
      labels: ["operator", "handoff"],
      position: 10,
      createdAt: 10,
      updatedAt: 20,
      metadata: { section: "triage" },
    });

    expect(item).toMatchObject({
      id: "card-1",
      title: "Triage operator handoff",
      description: "Needs owner",
      section: "triage",
      priority: "p0",
      status: "todo",
      tags: ["operator", "handoff"],
    });
  });

  it("loads a legacy workspace snapshot from native Workboard RPC when present", async () => {
    const requestJson = vi.fn(async () => {
      throw new Error("REST compatibility routes should not be called");
    }) as unknown as JsonHttpRequest;
    const request = vi.fn(async (method: string) => {
      expect(method).toBe("workboard.cards.list");
      return {
        cards: [
          {
            id: "card-1",
            title: "Own the handoff",
            notes: "Native Workboard card",
            status: "running",
            priority: "high",
            labels: ["operator"],
            boardId: "board-1",
            position: 0,
            createdAt: 100,
            updatedAt: 200,
            metadata: { section: "active" },
          },
        ],
      };
    });
    const helpers = createProjectBoardLiveHelpers(requestJson, {
      workboardRpc: createOpenClawWorkboardRpc({ request }),
    });

    const workspace = await helpers.loadProjectBoardWorkspaceLive();

    expect(requestJson).not.toHaveBeenCalled();
    expect(workspace.backlog.totalItems).toBe(1);
    expect(workspace.backlog.statusCounters.in_progress).toBe(1);
    expect(workspace.backlog.sections[0]?.section).toBe("active");
    expect(workspace.sprint.statusMetrics.inProgress).toBe(1);
  });

  it("creates and updates backlog items through native Workboard RPC", async () => {
    const requestJson = vi.fn() as unknown as JsonHttpRequest;
    const request = vi.fn(async (method: string) => {
      if (method === "workboard.cards.create") {
        return {
          card: {
            id: "card-1",
            title: "New card",
            notes: "From CAVI",
            status: "running",
            priority: "urgent",
            labels: ["agent"],
            position: 0,
            createdAt: 1,
            updatedAt: 2,
            metadata: { section: "active" },
          },
        };
      }
      return {
        card: {
          id: "card-1",
          title: "Updated card",
          notes: "Updated",
          status: "blocked",
          priority: "normal",
          labels: ["agent"],
          position: 1,
          createdAt: 1,
          updatedAt: 3,
          metadata: { section: "blocked" },
        },
      };
    });
    const helpers = createProjectBoardLiveHelpers(requestJson, {
      workboardRpc: createOpenClawWorkboardRpc({ request }),
    });
    const mutations = createProjectBoardMutations(requestJson, helpers);

    const created = await mutations.createProjectBoardBacklogItem({
      title: "New card",
      description: "From CAVI",
      section: "active",
      priority: "p0",
      status: "in_progress",
      tags: ["agent"],
    });
    const updated = await mutations.updateProjectBoardBacklogItem("card-1", {
      title: "Updated card",
      description: "Updated",
      section: "blocked",
      priority: "p2",
      status: "blocked",
      tags: ["agent"],
    });

    expect(created.source).toBe("gateway");
    expect(created.data.status).toBe("in_progress");
    expect(updated.source).toBe("gateway");
    expect(updated.data.status).toBe("blocked");
    expect(request).toHaveBeenCalledWith("workboard.cards.create", {
      title: "New card",
      notes: "From CAVI",
      status: "running",
      priority: "urgent",
      labels: ["agent"],
      metadata: { section: "active" },
    });
    expect(request).toHaveBeenCalledWith("workboard.cards.move", {
      id: "card-1",
      status: "blocked",
    });
  });

  it("routes known Project Board calls to typed Workboard actions", async () => {
    const requestJson = vi.fn() as unknown as JsonHttpRequest;
    const request = vi.fn(async () => ({
      ackId: "dispatch-1",
      action: "dispatch",
      requestedBy: "tester",
      queuedAt: 123,
      queueDepth: 1,
      note: "queued",
      storage: "sqlite",
    }));
    const helpers = createProjectBoardLiveHelpers(requestJson, {
      workboardRpc: createOpenClawWorkboardRpc({ request }),
    });
    const mutations = createProjectBoardMutations(requestJson, helpers);

    const result = await mutations.callProjectBoard({
      action: "dispatch",
      requestedBy: "tester",
      metadata: { cardId: "card-1" },
    });

    expect(result.source).toBe("gateway");
    expect(result.data.ackId).toBe("dispatch-1");
    expect(request).toHaveBeenCalledWith("workboard.cards.dispatch", {
      cardId: "card-1",
      requestedBy: "tester",
      source: "cavi-control-ui",
      traceId: expect.any(String),
    });
  });
});
