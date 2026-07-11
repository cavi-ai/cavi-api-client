export const KANBAN_STATUS_CATEGORIES = [
  "triage",
  "backlog",
  "todo",
  "scheduled",
  "active",
  "review",
  "blocked",
  "done",
] as const;
export type KanbanStatusCategory = (typeof KANBAN_STATUS_CATEGORIES)[number];

export const KANBAN_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];

export function isKanbanStatusCategory(value: unknown): value is KanbanStatusCategory {
  return (
    typeof value === "string" &&
    (KANBAN_STATUS_CATEGORIES as readonly string[]).includes(value)
  );
}

export function isKanbanPriority(value: unknown): value is KanbanPriority {
  return (
    typeof value === "string" && (KANBAN_PRIORITIES as readonly string[]).includes(value)
  );
}

/** A backend status token plus its canonical category and column order. */
export interface KanbanStatusDef {
  /** The backend's native status token, preserved verbatim. */
  status: string;
  category: KanbanStatusCategory;
  /** Column order for rendering; lower is earlier. */
  order: number;
}

/** Generic linkage a card may carry to runtime objects. */
export interface KanbanCardLinks {
  sessionKey?: string;
  runId?: string;
  taskId?: string;
}

export interface KanbanCard {
  id: string;
  title: string;
  notes?: string;
  /** Native backend status, preserved. */
  status: string;
  /** Canonical category derived from `status` by the adapter. */
  category: KanbanStatusCategory;
  priority: KanbanPriority;
  labels: string[];
  agentId?: string;
  boardId?: string;
  links?: KanbanCardLinks;
  position: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface KanbanBoard {
  id: string;
  name?: string;
  statuses?: readonly KanbanStatusDef[];
  metadata?: Record<string, unknown>;
}

export interface KanbanCardCreate {
  title: string;
  notes?: string;
  /** Native status; when omitted the backend chooses its default column. */
  status?: string;
  priority?: KanbanPriority;
  labels?: string[];
  agentId?: string;
  boardId?: string;
  links?: KanbanCardLinks;
  metadata?: Record<string, unknown>;
}

export interface KanbanCardPatch {
  title?: string;
  notes?: string;
  priority?: KanbanPriority;
  labels?: string[];
  agentId?: string;
  metadata?: Record<string, unknown>;
}
