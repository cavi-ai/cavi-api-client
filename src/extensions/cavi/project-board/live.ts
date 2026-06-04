import type {
  ProjectBoardBacklogDraft,
  ProjectBoardBacklogPriority,
  ProjectBoardBacklogStatus,
  ProjectBoardProfile,
  ProjectBoardWorkspaceSnapshot,
} from "../domain/index.js";
import type { OpenClawWorkboardRpc } from "../../../providers/openclaw/workboard.js";
import { GatewayHttpError } from "../../../core/http/gateway-error.js";
import type { JsonHttpRequest } from "../../../core/http/json-client.js";
import { CAVI_CONTROL_API_ENDPOINTS } from "../contracts/paths.js";
import {
  normalizeEmailList,
  toProjectBoardProfile,
  toProjectBoardWorkspaceFromCompatPayload,
  toProjectBoardWorkspaceSnapshot,
} from "./normalize.js";
import { asString } from "../../../core/data/guards.js";
import { workboardCardsToProjectBoardWorkspace } from "./workboard-adapter.js";

const PROJECT_BOARD_API = CAVI_CONTROL_API_ENDPOINTS.projectBoard;
const API_PROJECT_BOARD = PROJECT_BOARD_API.root;

export type ProjectBoardBacklogMutationPayload = {
  title: string;
  description: string | null;
  section: string;
  priority: ProjectBoardBacklogPriority;
  status: ProjectBoardBacklogStatus;
  tags: string[];
};

export type ProjectBoardLiveHelpers = {
  workboardRpc?: OpenClawWorkboardRpc | null;
  loadProjectBoardWorkspaceLive: () => Promise<ProjectBoardWorkspaceSnapshot>;
  loadProjectBoardProfileForEmailMutation: () => Promise<ProjectBoardProfile>;
  persistProjectBoardEmails: (emails: string[]) => Promise<ProjectBoardProfile>;
  toBacklogMutationPayload: (
    draft: ProjectBoardBacklogDraft,
  ) => ProjectBoardBacklogMutationPayload;
};

export function createProjectBoardLiveHelpers(
  requestJson: JsonHttpRequest,
  options: { workboardRpc?: OpenClawWorkboardRpc | null } = {},
): ProjectBoardLiveHelpers {
  const loadProjectBoardWorkspaceLive = async (): Promise<ProjectBoardWorkspaceSnapshot> => {
    if (options.workboardRpc) {
      try {
        const payload = await options.workboardRpc.listCards();
        return workboardCardsToProjectBoardWorkspace(payload.cards);
      } catch {
        // Preserve the existing REST compatibility path when Workboard is absent.
      }
    }

    try {
      const [profilePayload, sprintPayload, backlogPayload] = await Promise.all(
        [
          requestJson<unknown>(PROJECT_BOARD_API.profile),
          requestJson<unknown>(PROJECT_BOARD_API.sprint),
          requestJson<unknown>(PROJECT_BOARD_API.backlog),
        ],
      );

      return toProjectBoardWorkspaceSnapshot({
        profilePayload,
        sprintPayload,
        backlogPayload,
      });
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }

      const compatPayload = await requestJson<unknown>(API_PROJECT_BOARD);
      return toProjectBoardWorkspaceFromCompatPayload(compatPayload);
    }
  };

  const loadProjectBoardProfileForEmailMutation = async (): Promise<ProjectBoardProfile> => {
    try {
      const profilePayload = await requestJson<unknown>(PROJECT_BOARD_API.profile);
      return toProjectBoardProfile(profilePayload);
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }
      const compatPayload = await requestJson<unknown>(API_PROJECT_BOARD);
      return toProjectBoardWorkspaceFromCompatPayload(compatPayload).profile;
    }
  };

  const persistProjectBoardEmails = async (emails: string[]): Promise<ProjectBoardProfile> => {
    const normalizedEmails = normalizeEmailList(emails);

    try {
      const payload = await requestJson<unknown>(PROJECT_BOARD_API.profile, {
        method: "PUT",
        body: {
          emails: normalizedEmails,
        },
      });
      return toProjectBoardProfile(payload);
    } catch (error) {
      if (!(error instanceof GatewayHttpError) || error.status !== 404) {
        throw error;
      }

      const compatPayload = await requestJson<unknown>(API_PROJECT_BOARD, {
        method: "PUT",
        body: {
          emails: normalizedEmails,
        },
      });
      return toProjectBoardWorkspaceFromCompatPayload(compatPayload).profile;
    }
  };

  const toBacklogMutationPayload = (
    draft: ProjectBoardBacklogDraft,
  ): ProjectBoardBacklogMutationPayload => {
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
    workboardRpc: options.workboardRpc ?? null,
    loadProjectBoardWorkspaceLive,
    loadProjectBoardProfileForEmailMutation,
    persistProjectBoardEmails,
    toBacklogMutationPayload,
  };
}
