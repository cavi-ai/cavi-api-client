import type {
  KanbanBoard,
  KanbanCard,
  KanbanCardCreate,
  KanbanCardPatch,
  KanbanClient,
  KanbanExtended,
  KanbanStatusCategory,
  KanbanStatusDef,
} from "../../core/kanban/index.js";
import {
  OPENCLAW_WORKBOARD_RPC_METHODS,
  OPENCLAW_WORKBOARD_STATUSES,
  type OpenClawWorkboardCard,
  type OpenClawWorkboardRpc,
  type OpenClawWorkboardStatus,
} from "./workboard.js";

const CATEGORY_BY_STATUS: Record<OpenClawWorkboardStatus, KanbanStatusCategory> = {
  triage: "triage",
  backlog: "backlog",
  todo: "todo",
  scheduled: "scheduled",
  ready: "todo",
  running: "active",
  review: "review",
  blocked: "blocked",
  done: "done",
};

function categoryOf(status: string): KanbanStatusCategory {
  return CATEGORY_BY_STATUS[status as OpenClawWorkboardStatus] ?? "todo";
}

function linksOf(card: OpenClawWorkboardCard): KanbanCard["links"] {
  const links: NonNullable<KanbanCard["links"]> = {};
  if (card.sessionKey) links.sessionKey = card.sessionKey;
  if (card.runId) links.runId = card.runId;
  if (card.taskId) links.taskId = card.taskId;
  return Object.keys(links).length > 0 ? links : undefined;
}

function toKanbanCard(card: OpenClawWorkboardCard): KanbanCard {
  const links = linksOf(card);
  return {
    id: card.id,
    title: card.title,
    ...(card.notes === undefined ? {} : { notes: card.notes }),
    status: card.status,
    category: categoryOf(card.status),
    priority: card.priority,
    labels: card.labels,
    ...(card.agentId === undefined ? {} : { agentId: card.agentId }),
    ...(card.boardId === undefined ? {} : { boardId: card.boardId }),
    ...(links ? { links } : {}),
    position: card.position,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    ...(card.metadata === undefined ? {} : { metadata: card.metadata }),
  };
}

function toStatusDefs(
  statuses: readonly OpenClawWorkboardStatus[] | undefined,
): readonly KanbanStatusDef[] {
  const source = statuses ?? OPENCLAW_WORKBOARD_STATUSES;
  return source.map((status, order) => ({
    status,
    category: categoryOf(status),
    order,
  }));
}

/** Adapt an OpenClaw Workboard RPC client to the provider-agnostic KanbanClient. */
export function createOpenClawKanbanClient(rpc: OpenClawWorkboardRpc): KanbanClient {
  const extended: KanbanExtended = {
    comment: async (cardId, body) => {
      await rpc.request(OPENCLAW_WORKBOARD_RPC_METHODS.cardsComment, { id: cardId, body });
    },
    claim: async (cardId, agentId) =>
      toKanbanCard(
        (await rpc.request<{ card: OpenClawWorkboardCard }>(
          OPENCLAW_WORKBOARD_RPC_METHODS.cardsClaim,
          { id: cardId, agentId },
        )).card,
      ),
    release: async (cardId) =>
      toKanbanCard(
        (await rpc.request<{ card: OpenClawWorkboardCard }>(
          OPENCLAW_WORKBOARD_RPC_METHODS.cardsRelease,
          { id: cardId },
        )).card,
      ),
    complete: async (cardId) =>
      toKanbanCard(
        (await rpc.request<{ card: OpenClawWorkboardCard }>(
          OPENCLAW_WORKBOARD_RPC_METHODS.cardsComplete,
          { id: cardId },
        )).card,
      ),
    block: async (cardId, reason) =>
      toKanbanCard(
        (await rpc.request<{ card: OpenClawWorkboardCard }>(
          OPENCLAW_WORKBOARD_RPC_METHODS.cardsBlock,
          { id: cardId, ...(reason === undefined ? {} : { reason }) },
        )).card,
      ),
    unblock: async (cardId) =>
      toKanbanCard(
        (await rpc.request<{ card: OpenClawWorkboardCard }>(
          OPENCLAW_WORKBOARD_RPC_METHODS.cardsUnblock,
          { id: cardId },
        )).card,
      ),
    dispatch: (params) => rpc.dispatch(params),
  };

  return {
    listBoards: async () => {
      const result = await rpc.request<{ boards?: KanbanBoard[] }>(
        OPENCLAW_WORKBOARD_RPC_METHODS.boardsList,
      );
      return (result.boards ?? []).map((board) => ({
        id: board.id,
        ...(board.name === undefined ? {} : { name: board.name }),
        ...(board.statuses === undefined ? {} : { statuses: board.statuses }),
        ...(board.metadata === undefined ? {} : { metadata: board.metadata }),
      }));
    },
    listCards: async (params) => {
      const result = await rpc.listCards(params);
      return {
        cards: result.cards.map(toKanbanCard),
        statuses: toStatusDefs(result.statuses),
      };
    },
    createCard: async (input: KanbanCardCreate) => {
      const params: Record<string, unknown> = {
        title: input.title,
        ...(input.notes === undefined ? {} : { notes: input.notes }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.labels === undefined ? {} : { labels: input.labels }),
        ...(input.agentId === undefined ? {} : { agentId: input.agentId }),
        ...(input.boardId === undefined ? {} : { boardId: input.boardId }),
        ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
        ...(input.links?.sessionKey === undefined ? {} : { sessionKey: input.links.sessionKey }),
        ...(input.links?.runId === undefined ? {} : { runId: input.links.runId }),
        ...(input.links?.taskId === undefined ? {} : { taskId: input.links.taskId }),
      };
      const { card } = await rpc.createCard(params);
      return toKanbanCard(card);
    },
    updateCard: async (id: string, patch: KanbanCardPatch) => {
      const { card } = await rpc.updateCard(id, { ...patch });
      return toKanbanCard(card);
    },
    moveCard: async (id: string, status: string, position?: number) => {
      // Native-status passthrough — the backend validates the status token.
      const { card } = await rpc.moveCard(id, status as OpenClawWorkboardStatus, position);
      return toKanbanCard(card);
    },
    deleteCard: async (id: string) => {
      await rpc.request(OPENCLAW_WORKBOARD_RPC_METHODS.cardsDelete, { id });
    },
    extended,
  };
}
