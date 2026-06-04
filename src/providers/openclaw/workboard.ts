import type { OpenClawRpcTransport } from "./client.js";

// Mirrors upstream OpenClaw Workboard values. OpenClaw remains the contract owner.
export const OPENCLAW_WORKBOARD_STATUSES = [
  "triage",
  "backlog",
  "todo",
  "scheduled",
  "ready",
  "running",
  "review",
  "blocked",
  "done",
] as const;

export const OPENCLAW_WORKBOARD_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;

export const OPENCLAW_WORKBOARD_RPC_METHODS = {
  cardsList: "workboard.cards.list",
  cardsCreate: "workboard.cards.create",
  cardsUpdate: "workboard.cards.update",
  cardsMove: "workboard.cards.move",
  cardsDelete: "workboard.cards.delete",
  cardsComment: "workboard.cards.comment",
  cardsLink: "workboard.cards.link",
  cardsLinkDependency: "workboard.cards.linkDependency",
  cardsProof: "workboard.cards.proof",
  cardsArtifact: "workboard.cards.artifact",
  cardsClaim: "workboard.cards.claim",
  cardsHeartbeat: "workboard.cards.heartbeat",
  cardsRelease: "workboard.cards.release",
  cardsPromote: "workboard.cards.promote",
  cardsReassign: "workboard.cards.reassign",
  cardsReclaim: "workboard.cards.reclaim",
  cardsComplete: "workboard.cards.complete",
  cardsBlock: "workboard.cards.block",
  cardsUnblock: "workboard.cards.unblock",
  cardsBulk: "workboard.cards.bulk",
  cardsDiagnostics: "workboard.cards.diagnostics",
  cardsDiagnosticsRefresh: "workboard.cards.diagnostics.refresh",
  cardsDispatch: "workboard.cards.dispatch",
  cardsStats: "workboard.cards.stats",
  cardsRuns: "workboard.cards.runs",
  cardsSpecify: "workboard.cards.specify",
  cardsDecompose: "workboard.cards.decompose",
  cardsArchive: "workboard.cards.archive",
  cardsExport: "workboard.cards.export",
  boardsList: "workboard.boards.list",
  boardsUpsert: "workboard.boards.upsert",
  boardsArchive: "workboard.boards.archive",
  boardsDelete: "workboard.boards.delete",
  notificationsSubscribe: "workboard.notifications.subscribe",
  notificationsList: "workboard.notifications.list",
  notificationsDelete: "workboard.notifications.delete",
  notificationsEvents: "workboard.notifications.events",
  notificationsAdvance: "workboard.notifications.advance",
  attachmentsList: "workboard.cards.attachments.list",
  attachmentsGet: "workboard.cards.attachments.get",
  attachmentsAdd: "workboard.cards.attachments.add",
  attachmentsDelete: "workboard.cards.attachments.delete",
  workerLog: "workboard.cards.workerLog",
  protocolViolation: "workboard.cards.protocolViolation",
} as const;

export type OpenClawWorkboardStatus =
  (typeof OPENCLAW_WORKBOARD_STATUSES)[number];

export type OpenClawWorkboardPriority =
  (typeof OPENCLAW_WORKBOARD_PRIORITIES)[number];

export type OpenClawWorkboardCard = {
  id: string;
  title: string;
  notes?: string;
  status: OpenClawWorkboardStatus;
  priority: OpenClawWorkboardPriority;
  labels: string[];
  agentId?: string;
  boardId?: string;
  sessionKey?: string;
  runId?: string;
  taskId?: string;
  position: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
};

export type OpenClawWorkboardRpc = {
  request<TPayload>(
    method: string,
    params?: Record<string, unknown>,
  ): Promise<TPayload>;
  listCards(params?: {
    boardId?: string;
  }): Promise<{
    cards: OpenClawWorkboardCard[];
    statuses?: readonly OpenClawWorkboardStatus[];
  }>;
  createCard(
    params: Record<string, unknown>,
  ): Promise<{ card: OpenClawWorkboardCard }>;
  updateCard(
    id: string,
    patch: Record<string, unknown>,
  ): Promise<{ card: OpenClawWorkboardCard }>;
  moveCard(
    id: string,
    status: OpenClawWorkboardStatus,
    position?: number,
  ): Promise<{ card: OpenClawWorkboardCard }>;
  dispatch(params?: Record<string, unknown>): Promise<Record<string, unknown>>;
};

export function createOpenClawWorkboardRpc(
  transport: OpenClawRpcTransport,
): OpenClawWorkboardRpc {
  const request = <TPayload>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<TPayload> => transport.request<TPayload>(method, params);

  return {
    request,
    listCards: (params: { boardId?: string } = {}) =>
      request<{
        cards: OpenClawWorkboardCard[];
        statuses?: readonly OpenClawWorkboardStatus[];
      }>(OPENCLAW_WORKBOARD_RPC_METHODS.cardsList, params),
    createCard: (params: Record<string, unknown>) =>
      request<{ card: OpenClawWorkboardCard }>(
        OPENCLAW_WORKBOARD_RPC_METHODS.cardsCreate,
        params,
      ),
    updateCard: (id: string, patch: Record<string, unknown>) =>
      request<{ card: OpenClawWorkboardCard }>(
        OPENCLAW_WORKBOARD_RPC_METHODS.cardsUpdate,
        { id, patch },
      ),
    moveCard: (
      id: string,
      status: OpenClawWorkboardStatus,
      position?: number,
    ) =>
      request<{ card: OpenClawWorkboardCard }>(
        OPENCLAW_WORKBOARD_RPC_METHODS.cardsMove,
        { id, status, ...(position === undefined ? {} : { position }) },
      ),
    dispatch: (params: Record<string, unknown> = {}) =>
      request<Record<string, unknown>>(
        OPENCLAW_WORKBOARD_RPC_METHODS.cardsDispatch,
        params,
      ),
  };
}
