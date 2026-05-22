import type {
  DebBacklogDraft,
  DebBacklogPriority,
  DebBacklogStatus,
  DebProfile,
  DebWorkspaceSnapshot,
} from "../domain/index.js";
import { GatewayHttpError } from "../../core/http/gateway-error.js";
import type { JsonHttpRequest } from "../../core/http/json-client.js";
import { API_DEB, DEB_API } from "../paths.js";
import {
  normalizeEmailList,
  toDebProfile,
  toDebWorkspaceFromCompatPayload,
  toDebWorkspaceSnapshot,
} from "./normalize.js";
import { asString } from "../../core/data/guards.js";

export function createDebLiveHelpers(requestJson: JsonHttpRequest) {
  const loadDebWorkspaceLive = async (): Promise<DebWorkspaceSnapshot> => {
    try {
      const [profilePayload, sprintPayload, backlogPayload] = await Promise.all(
        [
          requestJson<unknown>(DEB_API.profile),
          requestJson<unknown>(DEB_API.sprint),
          requestJson<unknown>(DEB_API.backlog),
        ],
      );

      return toDebWorkspaceSnapshot({
        profilePayload,
        sprintPayload,
        backlogPayload,
      });
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }

      const compatPayload = await requestJson<unknown>(API_DEB);
      return toDebWorkspaceFromCompatPayload(compatPayload);
    }
  };

  const loadDebProfileForEmailMutation = async (): Promise<DebProfile> => {
    try {
      const profilePayload = await requestJson<unknown>(DEB_API.profile);
      return toDebProfile(profilePayload);
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }
      const compatPayload = await requestJson<unknown>(API_DEB);
      return toDebWorkspaceFromCompatPayload(compatPayload).profile;
    }
  };

  const persistDebEmails = async (emails: string[]): Promise<DebProfile> => {
    const normalizedEmails = normalizeEmailList(emails);

    try {
      const payload = await requestJson<unknown>(DEB_API.profile, {
        method: "PUT",
        body: {
          emails: normalizedEmails,
        },
      });
      return toDebProfile(payload);
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }

      const compatPayload = await requestJson<unknown>(API_DEB, {
        method: "PUT",
        body: {
          emails: normalizedEmails,
        },
      });
      return toDebWorkspaceFromCompatPayload(compatPayload).profile;
    }
  };

  const toBacklogMutationPayload = (
    draft: DebBacklogDraft,
  ): {
    title: string;
    description: string | null;
    section: string;
    priority: DebBacklogPriority;
    status: DebBacklogStatus;
    tags: string[];
  } => {
    const title = draft.title.trim();
    const section = draft.section.trim();
    const description = draft.description.trim();

    return {
      title,
      description: description.length > 0 ? description : null,
      section,
      priority: draft.priority,
      status: draft.status,
      tags: Array.from(
        new Set(
          draft.tags
            .map((tag) => asString(tag))
            .filter((tag): tag is string => Boolean(tag))
            .map((tag) => tag.toLowerCase()),
        ),
      ),
    };
  };

  return {
    loadDebWorkspaceLive,
    loadDebProfileForEmailMutation,
    persistDebEmails,
    toBacklogMutationPayload,
  };
}
