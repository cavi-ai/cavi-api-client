import type {
  OpenClawWorkboardCard,
  OpenClawWorkboardPriority,
  OpenClawWorkboardStatus,
} from "../../../providers/openclaw/workboard.js";
import { asNumber, asString } from "../../../core/data/guards.js";
import type {
  ProjectBoardBacklogItem,
  ProjectBoardBacklogPriority,
  ProjectBoardBacklogStatus,
  ProjectBoardWorkspaceSnapshot,
} from "../domain/index.js";
import {
  normalizeSection,
  sortBacklogItems,
} from "./normalize.js";

const WORKBOARD_COMPAT_LIMITATIONS = [
  "Native OpenClaw Workboard projected into CAVI Project Board compatibility shape.",
] as const;

export function projectBoardStatusToWorkboard(
  status: ProjectBoardBacklogStatus,
): OpenClawWorkboardStatus {
  if (status === "in_progress") return "running";
  return status;
}

export function workboardStatusToProjectBoard(
  status: OpenClawWorkboardStatus,
): ProjectBoardBacklogStatus {
  if (status === "running" || status === "review") return "in_progress";
  if (status === "blocked") return "blocked";
  if (status === "done") return "done";
  return "todo";
}

export function projectBoardPriorityToWorkboard(
  priority: ProjectBoardBacklogPriority,
): OpenClawWorkboardPriority {
  if (priority === "p0") return "urgent";
  if (priority === "p1") return "high";
  if (priority === "p3") return "low";
  return "normal";
}

export function workboardPriorityToProjectBoard(
  priority: OpenClawWorkboardPriority,
): ProjectBoardBacklogPriority {
  if (priority === "urgent") return "p0";
  if (priority === "high") return "p1";
  if (priority === "low") return "p3";
  return "p2";
}

export function workboardCardToProjectBoardBacklogItem(
  card: OpenClawWorkboardCard,
): ProjectBoardBacklogItem {
  const section =
    asString(card.metadata?.section) ??
    asString(card.boardId) ??
    card.status;
  return {
    id: card.id,
    title: card.title,
    description: card.notes ?? null,
    section: normalizeSection(section),
    priority: workboardPriorityToProjectBoard(card.priority),
    status: workboardStatusToProjectBoard(card.status),
    tags: Array.from(new Set(card.labels.map((label) => label.toLowerCase()))),
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

function countByPriority(
  items: readonly ProjectBoardBacklogItem[],
): Record<ProjectBoardBacklogPriority, number> {
  const priorities: Record<ProjectBoardBacklogPriority, number> = {
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
  };
  for (const item of items) priorities[item.priority] += 1;
  return priorities;
}

function countByStatus(
  items: readonly ProjectBoardBacklogItem[],
): Record<ProjectBoardBacklogStatus, number> {
  const statusCounters: Record<ProjectBoardBacklogStatus, number> = {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };
  for (const item of items) statusCounters[item.status] += 1;
  return statusCounters;
}

function latestUpdatedAt(items: readonly ProjectBoardBacklogItem[]): number {
  const latest = items.reduce(
    (max, item) => Math.max(max, asNumber(item.updatedAt) ?? 0),
    0,
  );
  return latest > 0 ? latest : Date.now();
}

export function workboardCardsToProjectBoardWorkspace(
  cards: readonly OpenClawWorkboardCard[],
): ProjectBoardWorkspaceSnapshot {
  const items = cards.map((card) => workboardCardToProjectBoardBacklogItem(card));
  const sortedSections = Array.from(
    new Set(items.map((item) => item.section)),
  ).sort();
  const statusCounters = countByStatus(items);
  const totalItems = items.length;
  const done = statusCounters.done;
  const lastUpdated = latestUpdatedAt(items);
  const limitations = WORKBOARD_COMPAT_LIMITATIONS;

  return {
    profile: {
      name: "OpenClaw Workboard",
      role: "Native Workboard compatibility adapter",
      photoPath: null,
      photoUrl: null,
      avatarCandidates: [],
      emails: [],
      lastUpdated,
      storage: "sqlite",
      limitations,
    },
    emails: [],
    sprint: {
      sprint: {
        id: "workboard",
        name: "OpenClaw Workboard",
        goal: "Project Board compatibility projection over native Workboard cards.",
        startsOn: null,
        endsOn: null,
      },
      statusMetrics: {
        total: totalItems,
        todo: statusCounters.todo,
        inProgress: statusCounters.in_progress,
        blocked: statusCounters.blocked,
        done,
        completionRate: totalItems > 0 ? done / totalItems : 0,
      },
      lastUpdated,
      storage: "sqlite",
      limitations,
    },
    backlog: {
      sections: sortedSections.map((section) => ({
        section,
        items: sortBacklogItems(
          items.filter((item) => item.section === section),
        ),
      })),
      priorities: countByPriority(items),
      statusCounters,
      totalItems,
      lastUpdated,
      storage: "sqlite",
      limitations,
    },
  };
}

export function projectBoardDraftToWorkboardCreate(params: {
  title: string;
  description: string | null;
  section: string;
  priority: ProjectBoardBacklogPriority;
  status: ProjectBoardBacklogStatus;
  tags: string[];
}): Record<string, unknown> {
  return {
    title: params.title,
    notes: params.description ?? "",
    status: projectBoardStatusToWorkboard(params.status),
    priority: projectBoardPriorityToWorkboard(params.priority),
    labels: params.tags,
    metadata: { section: normalizeSection(params.section) },
  };
}

export function projectBoardDraftToWorkboardPatch(params: {
  title: string;
  description: string | null;
  section: string;
  priority: ProjectBoardBacklogPriority;
  tags: string[];
}): Record<string, unknown> {
  return {
    title: params.title,
    notes: params.description ?? "",
    priority: projectBoardPriorityToWorkboard(params.priority),
    labels: params.tags,
    metadata: { section: normalizeSection(params.section) },
  };
}
