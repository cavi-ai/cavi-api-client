import {
  isKanbanPriority,
  isKanbanStatusCategory,
  type KanbanCard,
  type KanbanClient,
} from "../core/kanban/index.js";

export interface KanbanConformanceCheck {
  name: string;
  ok: boolean;
  detail?: string;
}

export interface KanbanConformanceReport {
  ok: boolean;
  checks: KanbanConformanceCheck[];
}

/** Return a list of human-readable errors for a card that violates the contract. */
export function validateKanbanCard(card: KanbanCard): string[] {
  const errors: string[] = [];
  if (typeof card.id !== "string" || card.id.length === 0) errors.push("id must be a non-empty string");
  if (typeof card.title !== "string") errors.push("title must be a string");
  if (typeof card.status !== "string") errors.push("status must be a string");
  if (!isKanbanStatusCategory(card.category)) {
    errors.push(`category "${String(card.category)}" is not a canonical KanbanStatusCategory`);
  }
  if (!isKanbanPriority(card.priority)) {
    errors.push(`priority "${String(card.priority)}" is not a canonical KanbanPriority`);
  }
  if (!Array.isArray(card.labels)) errors.push("labels must be an array");
  if (typeof card.position !== "number") errors.push("position must be a number");
  if (typeof card.createdAt !== "number") errors.push("createdAt must be a number");
  if (typeof card.updatedAt !== "number") errors.push("updatedAt must be a number");
  return errors;
}

/**
 * Exercise a KanbanClient's core methods and validate the canonical shape.
 *
 * NOTE: this MUTATES the target backend — it creates a card, updates and moves
 * it, then deletes it. Run it against a disposable board, not production data.
 */
export async function inspectKanbanConformance(
  client: KanbanClient,
): Promise<KanbanConformanceReport> {
  const checks: KanbanConformanceCheck[] = [];
  const record = (name: string, ok: boolean, detail?: string): void => {
    checks.push({ name, ok, ...(detail === undefined ? {} : { detail }) });
  };

  try {
    const { cards, statuses } = await client.listCards();
    const cardErrors = cards.flatMap(validateKanbanCard);
    record("listCards returns canonical cards", cardErrors.length === 0, cardErrors.join("; ") || undefined);
    const statusOk = (statuses ?? []).every((s) => isKanbanStatusCategory(s.category));
    record("listCards status vocabulary is categorized", statusOk);
  } catch (error) {
    record("listCards", false, String(error));
  }

  try {
    const boards = await client.listBoards();
    record(
      "listBoards returns identified boards",
      Array.isArray(boards) && boards.every((b) => typeof b.id === "string"),
    );
  } catch (error) {
    record("listBoards", false, String(error));
  }

  let createdId: string | undefined;
  try {
    const created = await client.createCard({ title: "conformance" });
    createdId = created.id;
    record("createCard returns a canonical card", validateKanbanCard(created).length === 0);
  } catch (error) {
    record("createCard", false, String(error));
  }

  if (createdId !== undefined) {
    try {
      const updated = await client.updateCard(createdId, { notes: "conformance" });
      record("updateCard returns a canonical card", validateKanbanCard(updated).length === 0);
    } catch (error) {
      record("updateCard", false, String(error));
    }

    try {
      const moved = await client.moveCard(createdId, "done");
      record("moveCard returns a canonical card", validateKanbanCard(moved).length === 0);
    } catch (error) {
      record("moveCard", false, String(error));
    }

    try {
      await client.deleteCard(createdId);
      record("deleteCard removes the conformance card", true);
    } catch (error) {
      record("deleteCard", false, String(error));
    }
  }

  return { ok: checks.every((c) => c.ok), checks };
}
