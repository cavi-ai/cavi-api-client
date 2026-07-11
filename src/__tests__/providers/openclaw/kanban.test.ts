import { describe, expect, it } from "vitest";
import { createOpenClawKanbanClient } from "../../../providers/openclaw/kanban";
import type {
  OpenClawWorkboardCard,
  OpenClawWorkboardRpc,
} from "../../../providers/openclaw/workboard";

function wbCard(over: Partial<OpenClawWorkboardCard> = {}): OpenClawWorkboardCard {
  return {
    id: "c1",
    title: "Ship it",
    status: "running",
    priority: "high",
    labels: ["Backend"],
    agentId: "a1",
    boardId: "b1",
    sessionKey: "s1",
    runId: "r1",
    position: 3,
    createdAt: 10,
    updatedAt: 20,
    ...over,
  };
}

function fakeRpc(over: Partial<OpenClawWorkboardRpc> = {}): OpenClawWorkboardRpc {
  const calls: Array<{ method: string; params?: Record<string, unknown> }> = [];
  const rpc: OpenClawWorkboardRpc = {
    request: async (method, params) => {
      calls.push({ method, params });
      return { card: wbCard() } as never;
    },
    listCards: async () => ({ cards: [wbCard()], statuses: ["todo", "running", "done"] }),
    createCard: async () => ({ card: wbCard() }),
    updateCard: async (id) => ({ card: wbCard({ id }) }),
    moveCard: async (id, status, position) => ({ card: wbCard({ id, status, position }) }),
    dispatch: async () => ({}),
    ...over,
  };
  (rpc as unknown as { calls: typeof calls }).calls = calls;
  return rpc;
}

describe("createOpenClawKanbanClient", () => {
  it("maps a workboard card to the canonical shape with category + links", async () => {
    const client = createOpenClawKanbanClient(fakeRpc());
    const { cards, statuses } = await client.listCards();
    expect(cards[0]).toMatchObject({
      id: "c1",
      title: "Ship it",
      status: "running",
      category: "active",
      priority: "high",
      labels: ["Backend"],
      agentId: "a1",
      boardId: "b1",
      links: { sessionKey: "s1", runId: "r1" },
      position: 3,
    });
    expect(statuses).toEqual([
      { status: "todo", category: "todo", order: 0 },
      { status: "running", category: "active", order: 1 },
      { status: "done", category: "done", order: 2 },
    ]);
  });

  it("moveCard forwards the native status to the workboard rpc", async () => {
    const rpc = fakeRpc();
    const client = createOpenClawKanbanClient(rpc);
    const moved = await client.moveCard("c1", "review", 2);
    expect(moved.status).toBe("review");
    expect(moved.category).toBe("review");
  });

  it("exposes extended orchestration methods that call the rpc", async () => {
    const rpc = fakeRpc();
    const client = createOpenClawKanbanClient(rpc);
    await client.extended?.complete?.("c1");
    const calls = (rpc as unknown as { calls: Array<{ method: string }> }).calls;
    expect(calls.some((c) => c.method === "workboard.cards.complete")).toBe(true);
  });

  it("createCard flattens links into the workboard params", async () => {
    let captured: Record<string, unknown> | undefined;
    const rpc = fakeRpc({
      createCard: async (params) => {
        captured = params;
        return { card: wbCard() };
      },
    });
    const client = createOpenClawKanbanClient(rpc);
    await client.createCard({
      title: "x",
      links: { sessionKey: "s9", runId: "r9", taskId: "t9" },
    });
    expect(captured).toMatchObject({ title: "x", sessionKey: "s9", runId: "r9", taskId: "t9" });
  });
});
