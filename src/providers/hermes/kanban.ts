import {
  KANBAN_PLUGIN_API_ENDPOINTS,
  KANBAN_PLUGIN_ARCHIVED_STATUS,
  KANBAN_PLUGIN_BOARD_COLUMNS,
  appendHttpQuery,
} from "../../contracts/paths.js";
import type {
  KanbanBoard,
  KanbanCard,
  KanbanCardCreate,
  KanbanCardPatch,
  KanbanClient,
  KanbanPriority,
  KanbanStatusCategory,
  KanbanStatusDef,
} from "../../core/kanban/index.js";

/** JSON transport for the kanban plugin's REST surface. */
export type HermesKanbanRequest = <T>(
  path: string,
  init?: { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown },
) => Promise<T>;

export type HermesKanbanClientOptions = {
  /** Board slug; omitted means the plugin's active board. */
  boardId?: string;
};

/**
 * Category per native plugin status. `ready` maps to `todo` to match the
 * OpenClaw adapter, so both providers place a claimable-but-unstarted card in
 * the same canonical column. `archived` is the plugin's retire state.
 */
const CATEGORY_BY_STATUS: Record<string, KanbanStatusCategory> = {
  triage: "triage",
  todo: "todo",
  ready: "todo",
  running: "active",
  blocked: "blocked",
  done: "done",
  archived: "done",
};

function categoryOf(status: string): KanbanStatusCategory {
  return CATEGORY_BY_STATUS[status] ?? "todo";
}

/**
 * The plugin stores priority as an unbounded int tiebreaker (default 0,
 * higher is claimed first — `ORDER BY priority DESC, created_at ASC`), while
 * the canonical contract is a four-value enum. The bridge is these thresholds
 * and their exact inverse below, so a value set through this client reads back
 * as the same canonical priority. The raw int is preserved on
 * `metadata.hermesPriority`, so nothing is lost for callers that need the
 * native ordering.
 */
function toPriority(raw: number): KanbanPriority {
  if (raw < 0) return "low";
  if (raw === 0) return "normal";
  if (raw < 10) return "high";
  return "urgent";
}

const PRIORITY_VALUE: Record<KanbanPriority, number> = {
  low: -1,
  normal: 0,
  high: 1,
  urgent: 10,
};

type HermesTask = {
  id: string;
  title: string;
  body?: string | null;
  assignee?: string | null;
  status: string;
  priority?: number | null;
  tenant?: string | null;
  created_at?: number | null;
  started_at?: number | null;
  completed_at?: number | null;
  last_heartbeat_at?: number | null;
  session_id?: string | null;
  current_run_id?: number | null;
  skills?: string[] | null;
  [key: string]: unknown;
};

function linksOf(task: HermesTask): KanbanCard["links"] {
  const links: NonNullable<KanbanCard["links"]> = { taskId: task.id };
  if (task.session_id) links.sessionKey = task.session_id;
  if (task.current_run_id !== null && task.current_run_id !== undefined) {
    links.runId = String(task.current_run_id);
  }
  return links;
}

function toKanbanCard(task: HermesTask, position: number, boardId?: string): KanbanCard {
  const rawPriority = task.priority ?? 0;
  const createdAt = task.created_at ?? 0;
  // The plugin has no updated_at column; the newest lifecycle stamp is the
  // closest honest equivalent.
  const updatedAt =
    task.completed_at ?? task.last_heartbeat_at ?? task.started_at ?? createdAt;
  return {
    id: task.id,
    title: task.title,
    ...(task.body ? { notes: task.body } : {}),
    status: task.status,
    category: categoryOf(task.status),
    priority: toPriority(rawPriority),
    labels: task.skills ?? [],
    ...(task.assignee ? { agentId: task.assignee } : {}),
    ...(boardId === undefined ? {} : { boardId }),
    links: linksOf(task),
    position,
    createdAt,
    updatedAt,
    metadata: {
      hermesPriority: rawPriority,
      ...(task.tenant ? { tenant: task.tenant } : {}),
    },
  };
}

function statusDefs(columnNames: readonly string[]): readonly KanbanStatusDef[] {
  const source = columnNames.length > 0 ? columnNames : KANBAN_PLUGIN_BOARD_COLUMNS;
  return source.map((status, order) => ({ status, category: categoryOf(status), order }));
}

type BoardResponse = {
  columns?: Array<{ name: string; tasks?: HermesTask[] }>;
};

type BoardsResponse = {
  boards?: Array<{ slug: string; name?: string; [key: string]: unknown }>;
  current?: string;
};

type TaskResponse = { task?: HermesTask | null };

function requireTask(payload: TaskResponse, action: string): HermesTask {
  if (!payload.task) throw new Error(`Hermes kanban ${action} returned no task`);
  return payload.task;
}

/**
 * Adapt the Hermes kanban plugin's REST surface to the provider-agnostic
 * KanbanClient — the same contract `createOpenClawKanbanClient` satisfies from
 * Workboard RPC.
 */
export function createHermesKanbanClient(
  request: HermesKanbanRequest,
  options: HermesKanbanClientOptions = {},
): KanbanClient {
  const board = (path: string, params?: Record<string, string | undefined>) =>
    appendHttpQuery(path, { board: options.boardId, ...params });

  const patchTask = async (id: string, body: Record<string, unknown>): Promise<KanbanCard> => {
    const payload = await request<TaskResponse>(board(KANBAN_PLUGIN_API_ENDPOINTS.task(id)), {
      method: "PATCH",
      body,
    });
    return toKanbanCard(requireTask(payload, "update"), 0, options.boardId);
  };

  return {
    listBoards: async () => {
      const payload = await request<BoardsResponse>(KANBAN_PLUGIN_API_ENDPOINTS.boards);
      return (payload.boards ?? []).map((entry): KanbanBoard => {
        const { slug, name, ...rest } = entry;
        return {
          id: slug,
          ...(name === undefined ? {} : { name }),
          statuses: statusDefs(KANBAN_PLUGIN_BOARD_COLUMNS),
          metadata: rest,
        };
      });
    },

    listCards: async (params) => {
      const slug = params?.boardId ?? options.boardId;
      const payload = await request<BoardResponse>(
        appendHttpQuery(KANBAN_PLUGIN_API_ENDPOINTS.board, { board: slug }),
      );
      const columns = payload.columns ?? [];
      // The plugin already orders each column by priority DESC, created_at ASC;
      // the index within a column is the card's position.
      const cards = columns.flatMap((column) =>
        (column.tasks ?? []).map((task, index) => toKanbanCard(task, index, slug)),
      );
      return { cards, statuses: statusDefs(columns.map((column) => column.name)) };
    },

    createCard: async (input: KanbanCardCreate) => {
      const payload = await request<TaskResponse>(
        board(KANBAN_PLUGIN_API_ENDPOINTS.tasks, { board: input.boardId }),
        {
          method: "POST",
          body: {
            title: input.title,
            ...(input.notes === undefined ? {} : { body: input.notes }),
            ...(input.agentId === undefined ? {} : { assignee: input.agentId }),
            ...(input.priority === undefined ? {} : { priority: PRIORITY_VALUE[input.priority] }),
            ...(input.labels === undefined ? {} : { skills: input.labels }),
            // `triage: true` is how the plugin opens a card in the triage
            // column; every other status is reached by a follow-up PATCH.
            ...(input.status === "triage" ? { triage: true } : {}),
          },
        },
      );
      const task = requireTask(payload, "create");
      const created = toKanbanCard(task, 0, input.boardId ?? options.boardId);
      if (input.status === undefined || input.status === task.status) return created;
      return await patchTask(task.id, { status: input.status });
    },

    updateCard: async (id: string, patch: KanbanCardPatch) =>
      await patchTask(id, {
        ...(patch.title === undefined ? {} : { title: patch.title }),
        ...(patch.notes === undefined ? {} : { body: patch.notes }),
        ...(patch.agentId === undefined ? {} : { assignee: patch.agentId }),
        ...(patch.priority === undefined ? {} : { priority: PRIORITY_VALUE[patch.priority] }),
      }),

    // Native-status passthrough — the plugin validates the status token and
    // rejects an unknown one with 400, or an illegal transition with 409.
    //
    // Provider difference worth knowing: the plugin refuses `running` here
    // ("Cannot set status to 'running' directly; use the dispatcher/claim
    // path", 400). A card enters `running` through the dispatcher, not through
    // moveCard. OpenClaw has no such restriction. The error is surfaced rather
    // than translated, so the caller sees the plugin's own reason.
    //
    // `position` is not settable: the plugin orders each column by
    // priority DESC, created_at ASC, so there is no per-card position to write.
    moveCard: async (id: string, status: string) => await patchTask(id, { status }),

    // The plugin has no hard-delete route; `archived` is its retire status.
    deleteCard: async (id: string) => {
      await patchTask(id, { status: KANBAN_PLUGIN_ARCHIVED_STATUS });
    },
  };
}
