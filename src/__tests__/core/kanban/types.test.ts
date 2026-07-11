import { describe, expect, it } from "vitest";
import {
  KANBAN_STATUS_CATEGORIES,
  KANBAN_PRIORITIES,
  isKanbanStatusCategory,
  isKanbanPriority,
} from "../../../core/kanban/types";

describe("kanban canonical types", () => {
  it("exposes the 8 canonical status categories in order", () => {
    expect(KANBAN_STATUS_CATEGORIES).toEqual([
      "triage", "backlog", "todo", "scheduled", "active", "review", "blocked", "done",
    ]);
  });

  it("exposes the 4 canonical priorities", () => {
    expect(KANBAN_PRIORITIES).toEqual(["low", "normal", "high", "urgent"]);
  });

  it("guards categories and priorities", () => {
    expect(isKanbanStatusCategory("active")).toBe(true);
    expect(isKanbanStatusCategory("running")).toBe(false);
    expect(isKanbanPriority("urgent")).toBe(true);
    expect(isKanbanPriority("critical")).toBe(false);
  });
});
