import type {
  ProjectBoardBacklogPriority,
  ProjectBoardBacklogStatus,
  ProjectBoardStorageMode,
} from "../domain/index.js";
import { resolveProjectBoardAssetPath } from "../runtime/paths.js";

export const PROJECT_BOARD_CANONICAL_AVATAR_CANDIDATES = [
  resolveProjectBoardAssetPath("project-board-wave.png"),
  resolveProjectBoardAssetPath("project-board-reports.png"),
  resolveProjectBoardAssetPath("project-board-laptop.png"),
] as const;

export const PROJECT_BOARD_FALLBACK_LIMITATIONS = [
  "Cavi Control adapter used compatibility projection for Project Board payload.",
] as const;

export type ProjectBoardProfileApiResponse = {
  name: string;
  role: string;
  photoPath: string | null;
  photoUrl: string | null;
  emails: string[];
  lastUpdated: number;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};

export type ProjectBoardSprintApiResponse = {
  sprint: {
    id: string;
    name: string;
    goal: string;
    startsOn: string | null;
    endsOn: string | null;
  };
  statusMetrics: {
    total: number;
    todo: number;
    inProgress: number;
    blocked: number;
    done: number;
    completionRate: number;
  };
  lastUpdated: number;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};

export type ProjectBoardBacklogApiItemResponse = {
  id: string;
  title: string;
  description: string | null;
  section: string;
  priority: ProjectBoardBacklogPriority;
  status: ProjectBoardBacklogStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type ProjectBoardBacklogApiResponse = {
  sections: Array<{
    section: string;
    items: ProjectBoardBacklogApiItemResponse[];
  }>;
  priorities: Record<ProjectBoardBacklogPriority, number>;
  statusCounters: Record<ProjectBoardBacklogStatus, number>;
  totalItems: number;
  lastUpdated: number;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};

export type ProjectBoardCallApiAckResponse = {
  ackId: string;
  status: "queued";
  action: string;
  requestedBy: string;
  queuedAt: number;
  queueDepth: number;
  note: string;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};
