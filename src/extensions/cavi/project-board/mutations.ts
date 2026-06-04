import type {
  ProjectBoardBacklogItem,
  ProjectBoardBacklogDraft,
  ProjectBoardCallResult,
  ProjectBoardCallRequest,
  ProjectBoardEmailDraft,
} from "../domain/index.js";
import { GatewayHttpError } from "../../../core/http/gateway-error.js";
import type { JsonHttpRequest } from "../../../core/http/json-client.js";
import {
  type MutationResult,
  withMutationResult,
} from "../../../core/gateway/envelope/index.js";
import { describeHttpContract } from "../../../core/http/contracts.js";
import {
  CAVI_CONTROL_API_ENDPOINTS,
  projectBoardBacklogItemPath,
} from "../contracts/paths.js";
import {
  PROJECT_BOARD_FALLBACK_LIMITATIONS,
} from "./constants.js";
import {
  normalizeProjectBoardBacklogItem,
  normalizeEmailAddress,
  parseProjectBoardCallAck,
} from "./normalize.js";
import { createTraceId } from "./trace-id.js";
import type { ProjectBoardLiveHelpers } from "./live.js";
import {
  projectBoardDraftToWorkboardCreate,
  projectBoardDraftToWorkboardPatch,
  projectBoardStatusToWorkboard,
  workboardCardToProjectBoardBacklogItem,
} from "./workboard-adapter.js";
import { OPENCLAW_WORKBOARD_RPC_METHODS } from "../../../providers/openclaw/workboard.js";

const PROJECT_BOARD_API = CAVI_CONTROL_API_ENDPOINTS.projectBoard;
const WORKBOARD_CALL_ACTIONS = {
  dispatch: OPENCLAW_WORKBOARD_RPC_METHODS.cardsDispatch,
  promote: OPENCLAW_WORKBOARD_RPC_METHODS.cardsPromote,
  reassign: OPENCLAW_WORKBOARD_RPC_METHODS.cardsReassign,
  reclaim: OPENCLAW_WORKBOARD_RPC_METHODS.cardsReclaim,
  unblock: OPENCLAW_WORKBOARD_RPC_METHODS.cardsUnblock,
} as const;

function isWorkboardCallAction(
  action: string,
): action is keyof typeof WORKBOARD_CALL_ACTIONS {
  return action in WORKBOARD_CALL_ACTIONS;
}

export type ProjectBoardMutations = {
  createProjectBoardEmail: (
    draft: ProjectBoardEmailDraft,
  ) => Promise<MutationResult<{ id: string; email: string }>>;
  updateProjectBoardEmail: (
    emailId: string,
    draft: ProjectBoardEmailDraft,
  ) => Promise<MutationResult<{ id: string; email: string }>>;
  removeProjectBoardEmail: (
    emailId: string,
  ) => Promise<MutationResult<{ id: string }>>;
  createProjectBoardBacklogItem: (
    draft: ProjectBoardBacklogDraft,
  ) => Promise<MutationResult<ProjectBoardBacklogItem>>;
  updateProjectBoardBacklogItem: (
    itemId: string,
    draft: ProjectBoardBacklogDraft,
  ) => Promise<MutationResult<ProjectBoardBacklogItem>>;
  callProjectBoard: (
    request: ProjectBoardCallRequest,
  ) => Promise<MutationResult<ProjectBoardCallResult>>;
};

export function createProjectBoardMutations(
  requestJson: JsonHttpRequest,
  projectBoardLive: ProjectBoardLiveHelpers,
): ProjectBoardMutations {
  const {
    loadProjectBoardProfileForEmailMutation,
    persistProjectBoardEmails,
    toBacklogMutationPayload,
  } = projectBoardLive;

  return {
    createProjectBoardEmail: async (
      draft: ProjectBoardEmailDraft,
    ): Promise<MutationResult<{ id: string; email: string }>> =>
      withMutationResult({
        area: "project-board-email-create",
        expectedContract: describeHttpContract(
          "PUT",
          PROJECT_BOARD_API.profile,
          "{ emails: string[] }",
        ),
        note: "Project Board profile email mutation failed",
        fallback: () => ({
          id: normalizeEmailAddress(draft.email) ?? `mock-email-${Date.now()}`,
          email:
            normalizeEmailAddress(draft.email) ??
            draft.email.trim().toLowerCase(),
        }),
        run: async () => {
          const email = normalizeEmailAddress(draft.email);
          if (!email) {
            throw new Error("Valid email address required.");
          }

          const profile = await loadProjectBoardProfileForEmailMutation();
          if (profile.emails.includes(email)) {
            return { id: email, email };
          }

          const updatedProfile = await persistProjectBoardEmails([
            ...profile.emails,
            email,
          ]);
          const persistedEmail =
            updatedProfile.emails.find((entry) => entry === email) ?? email;
          return {
            id: persistedEmail,
            email: persistedEmail,
          };
        },
      }),

    updateProjectBoardEmail: async (
      emailId: string,
      draft: ProjectBoardEmailDraft,
    ): Promise<MutationResult<{ id: string; email: string }>> =>
      withMutationResult({
        area: "project-board-email-update",
        expectedContract: describeHttpContract(
          "PUT",
          PROJECT_BOARD_API.profile,
          "{ emails: string[] }",
        ),
        note: "Project Board profile email update failed",
        fallback: () => ({
          id: normalizeEmailAddress(draft.email) ?? emailId,
          email:
            normalizeEmailAddress(draft.email) ??
            draft.email.trim().toLowerCase(),
        }),
        run: async () => {
          const nextEmail = normalizeEmailAddress(draft.email);
          if (!nextEmail) {
            throw new Error("Valid email address required.");
          }

          const profile = await loadProjectBoardProfileForEmailMutation();
          const currentId = normalizeEmailAddress(emailId);
          if (!currentId || !profile.emails.includes(currentId)) {
            throw new Error("Email recipient not found.");
          }

          const nextEmails = profile.emails.map((email) =>
            email === currentId ? nextEmail : email,
          );
          const updatedProfile = await persistProjectBoardEmails(nextEmails);
          const persistedEmail =
            updatedProfile.emails.find((email) => email === nextEmail) ??
            nextEmail;

          return {
            id: persistedEmail,
            email: persistedEmail,
          };
        },
      }),

    removeProjectBoardEmail: async (
      emailId: string,
    ): Promise<MutationResult<{ id: string }>> =>
      withMutationResult({
        area: "project-board-email-delete",
        expectedContract: describeHttpContract(
          "PUT",
          PROJECT_BOARD_API.profile,
          "{ emails: string[] }",
        ),
        note: "Project Board profile email delete failed",
        fallback: () => ({ id: emailId }),
        run: async () => {
          const normalizedEmailId = normalizeEmailAddress(emailId);
          if (!normalizedEmailId) {
            throw new Error("Email recipient id is invalid.");
          }

          const profile = await loadProjectBoardProfileForEmailMutation();
          const nextEmails = profile.emails.filter(
            (email) => email !== normalizedEmailId,
          );

          if (nextEmails.length === profile.emails.length) {
            throw new Error("Email recipient not found.");
          }

          await persistProjectBoardEmails(nextEmails);
          return { id: normalizedEmailId };
        },
      }),

    createProjectBoardBacklogItem: async (
      draft: ProjectBoardBacklogDraft,
    ): Promise<MutationResult<ProjectBoardBacklogItem>> =>
      withMutationResult({
        area: "project-board-backlog-create",
        expectedContract: describeHttpContract("POST", PROJECT_BOARD_API.backlog),
        note: "Project Board backlog create failed",
        fallback: () => ({
          id: `mock-backlog-${Date.now()}`,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          section: draft.section.trim().toLowerCase() || "inbox",
          priority: draft.priority,
          status: draft.status,
          tags: draft.tags,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        run: async () => {
          const payload = toBacklogMutationPayload(draft);
          if (projectBoardLive.workboardRpc) {
            const response = await projectBoardLive.workboardRpc.createCard(
              projectBoardDraftToWorkboardCreate(payload),
            );
            return workboardCardToProjectBoardBacklogItem(response.card);
          }
          const response = await requestJson<unknown>(PROJECT_BOARD_API.backlog, {
            method: "POST",
            body: payload,
          });
          const item = normalizeProjectBoardBacklogItem(response);
          if (!item) {
            throw new Error("Gateway returned invalid backlog item payload.");
          }
          return item;
        },
      }),

    updateProjectBoardBacklogItem: async (
      itemId: string,
      draft: ProjectBoardBacklogDraft,
    ): Promise<MutationResult<ProjectBoardBacklogItem>> =>
      withMutationResult({
        area: "project-board-backlog-update",
        expectedContract: describeHttpContract(
          "PATCH",
          `${PROJECT_BOARD_API.backlog}/:id`,
        ),
        note: "Project Board backlog update failed",
        fallback: () => ({
          id: itemId,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          section: draft.section.trim().toLowerCase() || "inbox",
          priority: draft.priority,
          status: draft.status,
          tags: draft.tags,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        run: async () => {
          const payload = toBacklogMutationPayload(draft);
          if (projectBoardLive.workboardRpc) {
            await projectBoardLive.workboardRpc.updateCard(
              itemId,
              projectBoardDraftToWorkboardPatch(payload),
            );
            const response = await projectBoardLive.workboardRpc.moveCard(
              itemId,
              projectBoardStatusToWorkboard(payload.status),
            );
            return workboardCardToProjectBoardBacklogItem(response.card);
          }
          const response = await requestJson<unknown>(
            projectBoardBacklogItemPath(itemId),
            {
              method: "PATCH",
              body: payload,
            },
          );
          const item = normalizeProjectBoardBacklogItem(response);
          if (!item) {
            throw new Error("Gateway returned invalid backlog item payload.");
          }
          return item;
        },
      }),

    callProjectBoard: async (
      request: ProjectBoardCallRequest,
    ): Promise<MutationResult<ProjectBoardCallResult>> =>
      withMutationResult({
        area: "project-board-call",
        expectedContract: describeHttpContract(
          "POST",
          PROJECT_BOARD_API.call,
          "{ action, requestedBy, metadata }",
        ),
        note: "Project Board call endpoint failed",
        fallback: () => {
          const traceId = createTraceId();
          return {
            ackId: `project-board-call-${traceId}`,
            status: "queued" as const,
            action: request.action,
            requestedBy: request.requestedBy,
            queuedAt: Date.now(),
            queueDepth: 0,
            note: "Project Board call endpoint unavailable. Action stored as local fallback only.",
            storage: "json-file" as const,
            limitations: PROJECT_BOARD_FALLBACK_LIMITATIONS,
            traceId,
          };
        },
        run: async () => {
          const traceId = createTraceId();
          const action = request.action.trim();
          const requestedBy = request.requestedBy.trim() || "cavi-control-ui";

          if (!action) {
            throw new Error("Project Board action is required.");
          }

          if (projectBoardLive.workboardRpc && isWorkboardCallAction(action)) {
            const response = await projectBoardLive.workboardRpc.request<unknown>(
              WORKBOARD_CALL_ACTIONS[action],
              {
                ...request.metadata,
                requestedBy,
                source: "cavi-control-ui",
                traceId,
              },
            );
            return parseProjectBoardCallAck(response, {
              action,
              requestedBy,
              traceId,
            });
          }

          const payload = {
            action,
            requestedBy,
            metadata: {
              ...request.metadata,
              source: "cavi-control-ui",
              traceId,
            },
          };

          try {
            const response = await requestJson<unknown>(
              PROJECT_BOARD_API.call,
              {
                method: "POST",
                body: payload,
              },
            );
            return parseProjectBoardCallAck(response, {
              action,
              requestedBy,
              traceId,
            });
          } catch (error) {
            if (
              !(error instanceof GatewayHttpError) ||
              (error.status !== 422 && error.status !== 404)
            ) {
              throw error;
            }

            const compatResponse = await requestJson<unknown>(PROJECT_BOARD_API.call, {
              method: "POST",
              body: {
                instruction: action,
              },
            });

            return parseProjectBoardCallAck(compatResponse, {
              action,
              requestedBy,
              traceId,
            });
          }
        },
      }),
  };
}
