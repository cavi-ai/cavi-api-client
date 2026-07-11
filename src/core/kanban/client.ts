import type {
  KanbanBoard,
  KanbanCard,
  KanbanCardCreate,
  KanbanCardPatch,
  KanbanStatusDef,
} from "./types.js";

/** Optional agent-orchestration surface. Present iff the backend supports it. */
export interface KanbanExtended {
  comment?(cardId: string, body: string): Promise<void>;
  claim?(cardId: string, agentId: string): Promise<KanbanCard>;
  release?(cardId: string): Promise<KanbanCard>;
  complete?(cardId: string): Promise<KanbanCard>;
  block?(cardId: string, reason?: string): Promise<KanbanCard>;
  unblock?(cardId: string): Promise<KanbanCard>;
  dispatch?(params?: Record<string, unknown>): Promise<unknown>;
}

/**
 * Provider-agnostic kanban contract. Every backend (OpenClaw Workboard, CAVI
 * Project Board, gateway REST, and any future one incl. Managed Agents) is an
 * adapter behind this interface. Core methods are mandatory; `extended` is
 * feature-detected.
 */
export interface KanbanClient {
  listBoards(): Promise<KanbanBoard[]>;
  listCards(params?: { boardId?: string }): Promise<{
    cards: KanbanCard[];
    statuses?: readonly KanbanStatusDef[];
  }>;
  createCard(input: KanbanCardCreate): Promise<KanbanCard>;
  updateCard(id: string, patch: KanbanCardPatch): Promise<KanbanCard>;
  /** Move a card to a native `status` (and optional position). */
  moveCard(id: string, status: string, position?: number): Promise<KanbanCard>;
  deleteCard(id: string): Promise<void>;
  readonly extended?: KanbanExtended;
}
