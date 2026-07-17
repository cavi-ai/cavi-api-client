import { ApiClientError, ApiClientErrorCode } from "../../../core/errors.js";
import { isGatewayHttpError } from "../../../core/http/gateway-error.js";
import { CapabilityUnavailable } from "../../../core/runtime/control-plane/runtime-control-client.js";
import type { RuntimeControlPlaneMetadata, RuntimePage } from "../../../core/runtime/control-plane/types.js";
import type {
  RuntimeTaskState,
  RuntimeTaskSummary,
  TaskClient,
} from "../../../core/runtime/control-plane/tasks.js";
import type { KanbanCard, KanbanClient } from "../../../core/kanban/index.js";
import { createHermesKanbanClient, type HermesKanbanRequest } from "../kanban.js";

/**
 * Hermes runs work as kanban cards, so the plugin board is the task list.
 * A card's canonical category carries the lifecycle; `triage`/`backlog`/`todo`/
 * `scheduled` are all pre-start, `active` is running, and `blocked` is waiting
 * on something rather than failed.
 */
const STATE_BY_CATEGORY: Record<KanbanCard["category"], RuntimeTaskState> = {
  triage: "pending",
  backlog: "pending",
  todo: "pending",
  scheduled: "pending",
  active: "running",
  review: "running",
  blocked: "pending",
  done: "completed",
};

function metadata(card: KanbanCard): RuntimeControlPlaneMetadata {
  return {
    provider: "hermes",
    stability: "experimental",
    source: { transport: "http", method: "kanban.board" },
    providerData: {
      status: card.status,
      ...(card.agentId === undefined ? {} : { assignee: card.agentId }),
      ...(card.boardId === undefined ? {} : { board: card.boardId }),
    },
  };
}

function toTaskSummary(card: KanbanCard): RuntimeTaskSummary {
  return {
    id: card.id,
    state: STATE_BY_CATEGORY[card.category] ?? "unknown",
    createdAt: new Date(card.createdAt * 1000).toISOString(),
    updatedAt: new Date(card.updatedAt * 1000).toISOString(),
    ...(card.links?.runId === undefined ? {} : { runId: card.links.runId }),
    ...(card.links?.sessionKey === undefined ? {} : { sessionId: card.links.sessionKey }),
    // A card is retired by archiving it; the plugin exposes no hard delete.
    cancellable: card.category !== "done",
    metadata: metadata(card),
  };
}

/**
 * TaskClient over the Hermes kanban plugin — the provider's own task surface.
 * Mirrors providers/openclaw/control-plane/tasks.ts, which serves the same
 * contract from OpenClaw's native tasks RPC.
 */
export function createHermesTaskClient(
  requestOrClient: HermesKanbanRequest | KanbanClient,
  options: { boardId?: string } = {},
): TaskClient {
  const kanban: KanbanClient =
    typeof requestOrClient === "function"
      ? createHermesKanbanClient(requestOrClient, options)
      : requestOrClient;

  /**
   * The kanban plugin is plugin-gated: a Hermes install without it answers 404.
   * That is an absent capability, not a transport fault, so it surfaces as
   * CapabilityUnavailable — the same signal every other unserved module gives.
   */
  const gated = async <T>(capability: string, run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (error) {
      // json-client translates a non-2xx into GatewayHttpError, so match that.
      if (isGatewayHttpError(error) && error.status === 404) {
        throw new CapabilityUnavailable("hermes", capability);
      }
      throw error;
    }
  };

  const listAll = async (): Promise<RuntimeTaskSummary[]> => {
    const { cards } = await kanban.listCards(
      options.boardId === undefined ? undefined : { boardId: options.boardId },
    );
    return cards.map(toTaskSummary);
  };

  return {
    listTasks: async (query): Promise<RuntimePage<RuntimeTaskSummary>> => {
      const all = await gated("controlPlane.tasks.list", listAll);
      // The board returns every column in one response; page it in memory so
      // the canonical cursor contract holds.
      const start = query?.cursor === undefined ? 0 : Number(query.cursor);
      if (!Number.isInteger(start) || start < 0) {
        throw new ApiClientError(`Hermes task cursor is not an index: ${String(query?.cursor)}`, {
          code: ApiClientErrorCode.ValidationFailed,
        });
      }
      const limit = query?.limit ?? all.length;
      const data = all.slice(start, start + limit);
      const next = start + data.length;
      return {
        data,
        ...(next < all.length ? { nextCursor: String(next) } : {}),
      };
    },

    getTask: async (id: string): Promise<RuntimeTaskSummary> => {
      const task = (await gated("controlPlane.tasks.get", listAll)).find(
        (candidate) => candidate.id === id,
      );
      if (!task) {
        throw new ApiClientError(`Hermes task not found: ${id}`, {
          code: ApiClientErrorCode.EndpointNotFound,
        });
      }
      return task;
    },

    cancelTask: async (id: string): Promise<RuntimeTaskSummary> =>
      toTaskSummary(await gated("controlPlane.tasks.cancel", async () => {
        await kanban.deleteCard(id);
        const { cards } = await kanban.listCards();
        const card = cards.find((candidate) => candidate.id === id);
        if (!card) {
          throw new ApiClientError(`Hermes task not found after cancel: ${id}`, {
            code: ApiClientErrorCode.EndpointNotFound,
          });
        }
        return card;
      })),
  };
}
