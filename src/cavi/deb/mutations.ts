import type {
  DebBacklogDraft,
  DebCallRequest,
  DebEmailDraft,
} from "../domain/index.js";
import { GatewayHttpError } from "../../core/http/gateway-error.js";
import type { JsonHttpRequest } from "../../core/http/json-client.js";
import {
  type MutationResult,
  withMutationResult,
} from "../../core/gateway/envelope/index.js";
import { describeHttpContract } from "../../core/http/contracts.js";
import {
  DEB_API,
  debBacklogItemPath,
} from "../paths.js";
import {
  DEB_FALLBACK_LIMITATIONS,
  type DebCallApiAckResponse,
} from "./constants.js";
import {
  normalizeDebBacklogItem,
  normalizeEmailAddress,
  parseDebCallAck,
} from "./normalize.js";
import { createTraceId } from "./trace-id.js";
import type { createDebLiveHelpers } from "./live.js";

type DebLiveHelpers = ReturnType<typeof createDebLiveHelpers>;

export function createDebMutations(
  requestJson: JsonHttpRequest,
  debLive: DebLiveHelpers,
) {
  const {
    loadDebProfileForEmailMutation,
    persistDebEmails,
    toBacklogMutationPayload,
  } = debLive;

  return {
    createDebEmail: async (
      draft: DebEmailDraft,
    ): Promise<MutationResult<{ id: string; email: string }>> =>
      withMutationResult({
        area: "deb-email-create",
        expectedContract: describeHttpContract(
          "PUT",
          DEB_API.profile,
          "{ emails: string[] }",
        ),
        note: "Deb profile email mutation failed",
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

          const profile = await loadDebProfileForEmailMutation();
          if (profile.emails.includes(email)) {
            return { id: email, email };
          }

          const updatedProfile = await persistDebEmails([
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

    updateDebEmail: async (
      emailId: string,
      draft: DebEmailDraft,
    ): Promise<MutationResult<{ id: string; email: string }>> =>
      withMutationResult({
        area: "deb-email-update",
        expectedContract: describeHttpContract(
          "PUT",
          DEB_API.profile,
          "{ emails: string[] }",
        ),
        note: "Deb profile email update failed",
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

          const profile = await loadDebProfileForEmailMutation();
          const currentId = normalizeEmailAddress(emailId);
          if (!currentId || !profile.emails.includes(currentId)) {
            throw new Error("Email recipient not found.");
          }

          const nextEmails = profile.emails.map((email) =>
            email === currentId ? nextEmail : email,
          );
          const updatedProfile = await persistDebEmails(nextEmails);
          const persistedEmail =
            updatedProfile.emails.find((email) => email === nextEmail) ??
            nextEmail;

          return {
            id: persistedEmail,
            email: persistedEmail,
          };
        },
      }),

    removeDebEmail: async (
      emailId: string,
    ): Promise<MutationResult<{ id: string }>> =>
      withMutationResult({
        area: "deb-email-delete",
        expectedContract: describeHttpContract(
          "PUT",
          DEB_API.profile,
          "{ emails: string[] }",
        ),
        note: "Deb profile email delete failed",
        fallback: () => ({ id: emailId }),
        run: async () => {
          const normalizedEmailId = normalizeEmailAddress(emailId);
          if (!normalizedEmailId) {
            throw new Error("Email recipient id is invalid.");
          }

          const profile = await loadDebProfileForEmailMutation();
          const nextEmails = profile.emails.filter(
            (email) => email !== normalizedEmailId,
          );

          if (nextEmails.length === profile.emails.length) {
            throw new Error("Email recipient not found.");
          }

          await persistDebEmails(nextEmails);
          return { id: normalizedEmailId };
        },
      }),

    createDebBacklogItem: async (draft: DebBacklogDraft) =>
      withMutationResult({
        area: "deb-backlog-create",
        expectedContract: describeHttpContract("POST", DEB_API.backlog),
        note: "Deb backlog create failed",
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
          const response = await requestJson<unknown>(DEB_API.backlog, {
            method: "POST",
            body: payload,
          });
          const item = normalizeDebBacklogItem(response);
          if (!item) {
            throw new Error("Gateway returned invalid backlog item payload.");
          }
          return item;
        },
      }),

    updateDebBacklogItem: async (itemId: string, draft: DebBacklogDraft) =>
      withMutationResult({
        area: "deb-backlog-update",
        expectedContract: describeHttpContract(
          "PATCH",
          `${DEB_API.backlog}/:id`,
        ),
        note: "Deb backlog update failed",
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
          const response = await requestJson<unknown>(
            debBacklogItemPath(itemId),
            {
              method: "PATCH",
              body: payload,
            },
          );
          const item = normalizeDebBacklogItem(response);
          if (!item) {
            throw new Error("Gateway returned invalid backlog item payload.");
          }
          return item;
        },
      }),

    callDeb: async (request: DebCallRequest) =>
      withMutationResult({
        area: "deb-call",
        expectedContract: describeHttpContract(
          "POST",
          DEB_API.call,
          "{ action, requestedBy, metadata }",
        ),
        note: "Deb call endpoint failed",
        fallback: () => {
          const traceId = createTraceId();
          return {
            ackId: `deb-call-${traceId}`,
            status: "queued" as const,
            action: request.action,
            requestedBy: request.requestedBy,
            queuedAt: Date.now(),
            queueDepth: 0,
            note: "Deb call endpoint unavailable. Action stored as local fallback only.",
            storage: "json-file" as const,
            limitations: DEB_FALLBACK_LIMITATIONS,
            traceId,
          };
        },
        run: async () => {
          const traceId = createTraceId();
          const action = request.action.trim();
          const requestedBy = request.requestedBy.trim() || "cavi-control-ui";

          if (!action) {
            throw new Error("Deb action is required.");
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
            const response = await requestJson<DebCallApiAckResponse>(
              DEB_API.call,
              {
                method: "POST",
                body: payload,
              },
            );
            return parseDebCallAck(response, {
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

            const compatResponse = await requestJson<unknown>(DEB_API.call, {
              method: "POST",
              body: {
                instruction: action,
              },
            });

            return parseDebCallAck(compatResponse, {
              action,
              requestedBy,
              traceId,
            });
          }
        },
      }),
  };
}
