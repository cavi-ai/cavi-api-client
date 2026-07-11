import { describe, expect, it } from "vitest";
import { createOpenClawKanbanClient } from "../../providers/openclaw/kanban";
import type {
  OpenClawWorkboardCard,
  OpenClawWorkboardRpc,
} from "../../providers/openclaw/workboard";
import { inspectKanbanConformance, validateKanbanCard } from "../../testing/kanban-conformance";

function wbCard(over: Partial<OpenClawWorkboardCard> = {}): OpenClawWorkboardCard {
  return {
    id: "c1", title: "t", status: "todo", priority: "normal", labels: [],
    position: 0, createdAt: 0, updatedAt: 0, ...over,
  };
}

const rpc: OpenClawWorkboardRpc = {
  request: async () => ({}) as never,
  listCards: async () => ({ cards: [wbCard()], statuses: ["todo", "done"] }),
  createCard: async () => ({ card: wbCard({ id: "new" }) }),
  updateCard: async (id) => ({ card: wbCard({ id }) }),
  moveCard: async (id, status) => ({ card: wbCard({ id, status }) }),
  dispatch: async () => ({}),
};

describe("kanban conformance", () => {
  it("validateKanbanCard flags a bad category", () => {
    const errors = validateKanbanCard({
      id: "x", title: "t", status: "todo", category: "running",
      priority: "normal", labels: [], position: 0, createdAt: 0, updatedAt: 0,
    } as never);
    expect(errors).toContain('category "running" is not a canonical KanbanStatusCategory');
  });

  it("a real adapter passes conformance", async () => {
    const report = await inspectKanbanConformance(createOpenClawKanbanClient(rpc));
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.ok)).toBe(true);
  });
});
