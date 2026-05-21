import type {
  DebBacklogDraft,
  DebBacklogPriority,
  DebBacklogStatus,
  DebProfile,
  DebWorkspaceSnapshot,
} from "../../domain/index.js";
import { CaviControlApiError } from "../../data/cavi-control/api-error.js";
import { DEB_API } from "../../data/cavi-control/api-paths.js";
import { API_DEB } from "../../data/cavi-control/constants.js";
import {
  normalizeEmailList,
  toDebProfile,
  toDebWorkspaceFromCompatPayload,
  toDebWorkspaceSnapshot,
} from "../../data/cavi-control/deb/normalize.js";
import type { CaviControlRequestJson } from "../../data/cavi-control/http-client.js";
import { asString } from "../../data/cavi-control/guards.js";

export function createDebLiveHelpers(requestJson: CaviControlRequestJson) {
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
      if (!(error instanceof CaviControlApiError) || error.status !== 404) {
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
      if (!(error instanceof CaviControlApiError) || error.status !== 404) {
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
      if (!(error instanceof CaviControlApiError) || error.status !== 404) {
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
