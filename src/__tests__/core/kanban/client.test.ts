import { describe, expect, it } from "vitest";
import type { KanbanClient } from "../../../core/kanban/index";
import type { KanbanCard } from "../../../core/kanban/index";

const CARD: KanbanCard = {
  id: "c1",
  title: "t",
  status: "todo",
  category: "todo",
  priority: "normal",
  labels: [],
  position: 0,
  createdAt: 0,
  updatedAt: 0,
};

const fake: KanbanClient = {
  listBoards: async () => [{ id: "b1" }],
  listCards: async () => ({ cards: [CARD] }),
  createCard: async (input) => ({ ...CARD, title: input.title }),
  updateCard: async (id) => ({ ...CARD, id }),
  moveCard: async (id, status) => ({ ...CARD, id, status }),
  deleteCard: async () => undefined,
};

describe("KanbanClient contract", () => {
  it("is implementable by a minimal backend (no extended)", async () => {
    expect((await fake.listCards()).cards[0].id).toBe("c1");
    expect(fake.extended).toBeUndefined();
  });
});
