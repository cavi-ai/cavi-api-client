import type {
  ProjectBoardBacklogPriority,
  ProjectBoardBacklogSnapshot,
  ProjectBoardBacklogStatus,
  ProjectBoardCallResult,
  ProjectBoardEmailRecipient,
  ProjectBoardProfile,
  ProjectBoardSprintStatus,
  ProjectBoardStorageMode,
  ProjectBoardWorkspaceSnapshot,
} from "../domain/index.js";
import {
  asNumber,
  asString,
  asStringArray,
  isRecord,
} from "../../../core/data/guards.js";
import type {
  ProjectBoardBacklogApiItemResponse,
  ProjectBoardBacklogApiResponse,
  ProjectBoardProfileApiResponse,
  ProjectBoardSprintApiResponse,
} from "./constants.js";
import { CAVI_CONTROL_BASE_PATH } from "../contracts/paths.js";
import {
  PROJECT_BOARD_CANONICAL_AVATAR_CANDIDATES,
  PROJECT_BOARD_FALLBACK_LIMITATIONS,
} from "./constants.js";
import {
  resolveProjectBoardAssetPath,
  withRuntimeBasePath,
} from "../runtime/paths.js";

export function normalizeProjectBoardPriority(value: unknown): ProjectBoardBacklogPriority {
  const normalized = asString(value)?.toLowerCase();
  if (
    normalized === "p0" ||
    normalized === "p1" ||
    normalized === "p2" ||
    normalized === "p3"
  ) {
    return normalized;
  }
  return "p2";
}

export function normalizeProjectBoardStatus(value: unknown): ProjectBoardBacklogStatus {
  const normalized = asString(value)?.toLowerCase().replace(/-/g, "_");
  if (
    normalized === "todo" ||
    normalized === "in_progress" ||
    normalized === "blocked" ||
    normalized === "done"
  ) {
    return normalized;
  }
  return "todo";
}

export function normalizeProjectBoardStorageMode(
  value: unknown,
): ProjectBoardStorageMode {
  return asString(value)?.toLowerCase() === "sqlite" ? "sqlite" : "json-file";
}

export function normalizeEmailAddress(value: unknown): string | null {
  const email = asString(value)?.toLowerCase();
  if (!email) {
    return null;
  }
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizeEmailList(emails: string[]): string[] {
  return Array.from(
    new Set(
      emails
        .map((email) => normalizeEmailAddress(email))
        .filter((email): email is string => Boolean(email)),
    ),
  );
}

export function normalizeLimitations(value: unknown): readonly string[] {
  const limitations = asStringArray(value);
  return limitations.length > 0 ? limitations : PROJECT_BOARD_FALLBACK_LIMITATIONS;
}

export function normalizeSection(value: unknown): string {
  return asString(value)?.toLowerCase() ?? "inbox";
}

export function sortBacklogItems(
  items: ProjectBoardBacklogApiItemResponse[],
): ProjectBoardBacklogApiItemResponse[] {
  const priorityOrder: Record<ProjectBoardBacklogPriority, number> = {
    p0: 0,
    p1: 1,
    p2: 2,
    p3: 3,
  };

  return [...items].sort((left, right) => {
    const byPriority =
      priorityOrder[left.priority] - priorityOrder[right.priority];
    if (byPriority !== 0) {
      return byPriority;
    }
    return right.updatedAt - left.updatedAt;
  });
}

function toProjectBoardAssetPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\\/g, "/");
  const caviControlPrefix = `${CAVI_CONTROL_BASE_PATH}/`;
  const withoutCanonicalPrefix = normalized.startsWith(caviControlPrefix)
    ? normalized.slice(CAVI_CONTROL_BASE_PATH.length)
    : normalized;

  if (withoutCanonicalPrefix.startsWith("/deb/")) {
    return withRuntimeBasePath(withoutCanonicalPrefix);
  }

  const filename = normalized.split("/").pop() ?? "";
  if (
    (filename.startsWith("deb-") || filename.startsWith("project-board-")) &&
    filename.endsWith(".png")
  ) {
    return resolveProjectBoardAssetPath(filename);
  }

  if (withoutCanonicalPrefix.startsWith("/")) {
    return withRuntimeBasePath(withoutCanonicalPrefix);
  }

  return withRuntimeBasePath(`/${withoutCanonicalPrefix.replace(/^\/+/, "")}`);
}

function buildProjectBoardAvatarCandidates(params: {
  photoPath: string | null;
  photoUrl: string | null;
}): string[] {
  const candidates = [
    ...PROJECT_BOARD_CANONICAL_AVATAR_CANDIDATES,
    params.photoPath ? toProjectBoardAssetPath(params.photoPath) : null,
    params.photoUrl ? toProjectBoardAssetPath(params.photoUrl) : null,
  ].filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(candidates));
}

function normalizeProjectBoardProfileResponse(raw: unknown): ProjectBoardProfileApiResponse {
  const record = isRecord(raw) ? raw : {};
  const photoPath =
    record.photoPath === null ? null : asString(record.photoPath);
  const photoUrl = record.photoUrl === null ? null : asString(record.photoUrl);

  const lastUpdated =
    asNumber(record.lastUpdated) ?? asNumber(record.updatedAt) ?? Date.now();
  const limitations =
    record.limitations === undefined
      ? ([] as readonly string[])
      : normalizeLimitations(record.limitations);

  return {
    name: asString(record.name) ?? "Project Board",
    role: asString(record.role) ?? "Project Board Operator",
    photoPath,
    photoUrl,
    emails: normalizeEmailList(asStringArray(record.emails)),
    lastUpdated,
    storage: normalizeProjectBoardStorageMode(record.storage),
    limitations,
  };
}

export function toProjectBoardProfile(raw: unknown): ProjectBoardProfile {
  const normalized = normalizeProjectBoardProfileResponse(raw);
  return {
    ...normalized,
    avatarCandidates: buildProjectBoardAvatarCandidates({
      photoPath: normalized.photoPath,
      photoUrl: normalized.photoUrl,
    }),
  };
}

export function normalizeProjectBoardBacklogItem(
  raw: unknown,
): ProjectBoardBacklogApiItemResponse | null {
  const record = isRecord(raw) ? raw : null;
  if (!record) {
    return null;
  }

  const id = asString(record.id);
  const title = asString(record.title);
  if (!id || !title) {
    return null;
  }

  const createdAt = asNumber(record.createdAt) ?? Date.now();
  const updatedAt = asNumber(record.updatedAt) ?? createdAt;

  return {
    id,
    title,
    description:
      record.description === null ? null : asString(record.description),
    section: normalizeSection(record.section),
    priority: normalizeProjectBoardPriority(record.priority),
    status: normalizeProjectBoardStatus(record.status),
    tags: Array.from(
      new Set(asStringArray(record.tags).map((tag) => tag.toLowerCase())),
    ),
    createdAt,
    updatedAt,
  };
}

function normalizeProjectBoardBacklogResponse(raw: unknown): ProjectBoardBacklogApiResponse {
  const record = isRecord(raw) ? raw : {};
  const sectionsRaw = Array.isArray(record.sections) ? record.sections : [];

  const sections = sectionsRaw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const section = normalizeSection(entry.section);
      const itemsRaw = Array.isArray(entry.items) ? entry.items : [];
      const items = itemsRaw
        .map((item) => normalizeProjectBoardBacklogItem(item))
        .filter((item): item is ProjectBoardBacklogApiItemResponse => item !== null);

      return {
        section,
        items: sortBacklogItems(items),
      };
    })
    .filter(
      (
        entry,
      ): entry is { section: string; items: ProjectBoardBacklogApiItemResponse[] } =>
        entry !== null,
    );

  const allItems = sections.flatMap((section) => section.items);

  const priorities: Record<ProjectBoardBacklogPriority, number> = {
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
  };

  const statusCounters: Record<ProjectBoardBacklogStatus, number> = {
    todo: 0,
    in_progress: 0,
    blocked: 0,
    done: 0,
  };

  for (const item of allItems) {
    priorities[item.priority] += 1;
    statusCounters[item.status] += 1;
  }

  const lastUpdated =
    asNumber(record.lastUpdated) ??
    asNumber(record.updatedAt) ??
    (() => {
      const latest = allItems.reduce(
        (max, item) => Math.max(max, item.updatedAt),
        0,
      );
      return latest > 0 ? latest : Date.now();
    })();
  const limitations =
    record.limitations === undefined
      ? ([] as readonly string[])
      : normalizeLimitations(record.limitations);

  return {
    sections,
    priorities,
    statusCounters,
    totalItems: allItems.length,
    lastUpdated,
    storage: normalizeProjectBoardStorageMode(record.storage),
    limitations,
  };
}

function toProjectBoardBacklog(raw: unknown): ProjectBoardBacklogSnapshot {
  return normalizeProjectBoardBacklogResponse(raw);
}

function normalizeProjectBoardSprintResponse(raw: unknown): ProjectBoardSprintApiResponse {
  const record = isRecord(raw) ? raw : {};
  const sprintRecord = isRecord(record.sprint) ? record.sprint : {};
  const metricsRecord = isRecord(record.statusMetrics)
    ? record.statusMetrics
    : {};

  const total = asNumber(metricsRecord.total) ?? 0;
  const todo = asNumber(metricsRecord.todo) ?? 0;
  const inProgress = asNumber(metricsRecord.inProgress) ?? 0;
  const blocked = asNumber(metricsRecord.blocked) ?? 0;
  const done = asNumber(metricsRecord.done) ?? 0;

  const lastUpdated =
    asNumber(record.lastUpdated) ?? asNumber(record.updatedAt) ?? Date.now();
  const limitations =
    record.limitations === undefined
      ? ([] as readonly string[])
      : normalizeLimitations(record.limitations);

  return {
    sprint: {
      id: asString(sprintRecord.id) ?? "current",
      name: asString(sprintRecord.name) ?? "Current Sprint",
      goal:
        asString(sprintRecord.goal) ??
        "Drive board clarity and delivery throughput.",
      startsOn:
        sprintRecord.startsOn === null ? null : asString(sprintRecord.startsOn),
      endsOn:
        sprintRecord.endsOn === null ? null : asString(sprintRecord.endsOn),
    },
    statusMetrics: {
      total,
      todo,
      inProgress,
      blocked,
      done,
      completionRate:
        asNumber(metricsRecord.completionRate) ??
        (total > 0 ? done / total : 0),
    },
    lastUpdated,
    storage: normalizeProjectBoardStorageMode(record.storage),
    limitations,
  };
}

function toProjectBoardSprint(raw: unknown): ProjectBoardSprintStatus {
  return normalizeProjectBoardSprintResponse(raw);
}

function normalizeProjectBoardEmailRecipients(emails: string[]): ProjectBoardEmailRecipient[] {
  return normalizeEmailList(emails).map((email) => ({
    id: email,
    email,
  }));
}

export function toProjectBoardWorkspaceSnapshot(params: {
  profilePayload: unknown;
  sprintPayload: unknown;
  backlogPayload: unknown;
}): ProjectBoardWorkspaceSnapshot {
  const profile = toProjectBoardProfile(params.profilePayload);
  return {
    profile,
    emails: normalizeProjectBoardEmailRecipients(profile.emails),
    sprint: toProjectBoardSprint(params.sprintPayload),
    backlog: toProjectBoardBacklog(params.backlogPayload),
  };
}

export function toProjectBoardWorkspaceFromCompatPayload(
  raw: unknown,
): ProjectBoardWorkspaceSnapshot {
  const record = isRecord(raw) ? raw : {};

  if (
    isRecord(record.profile) &&
    isRecord(record.sprint) &&
    isRecord(record.backlog)
  ) {
    return toProjectBoardWorkspaceSnapshot({
      profilePayload: record.profile,
      sprintPayload: record.sprint,
      backlogPayload: record.backlog,
    });
  }

  const legacyProfile = isRecord(record.profile) ? record.profile : {};
  const legacyEmails = Array.isArray(record.emails)
    ? record.emails
        .map((entry) =>
          isRecord(entry) ? normalizeEmailAddress(entry.email) : null,
        )
        .filter((email): email is string => Boolean(email))
    : [];

  const profilePayload: ProjectBoardProfileApiResponse = {
    name: asString(legacyProfile.name) ?? "Project Board",
    role: asString(legacyProfile.role) ?? "Project Board Operator",
    photoPath: asString(legacyProfile.photoPath) ?? null,
    photoUrl: asString(legacyProfile.photoUrl) ?? null,
    emails: legacyEmails,
    lastUpdated: Date.now(),
    storage: "json-file",
    limitations: PROJECT_BOARD_FALLBACK_LIMITATIONS,
  };

  const legacyBacklog = Array.isArray(record.backlog)
    ? record.backlog
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }
          const item = normalizeProjectBoardBacklogItem({
            id: entry.id,
            title: entry.title,
            description: entry.notes,
            section: entry.section,
            priority: entry.priority,
            status: entry.status,
            tags: [],
            createdAt: entry.updatedAt,
            updatedAt: entry.updatedAt,
          });
          return item;
        })
        .filter((item): item is ProjectBoardBacklogApiItemResponse => item !== null)
    : [];

  const backlogPayload: ProjectBoardBacklogApiResponse = {
    sections: [
      {
        section: "inbox",
        items: sortBacklogItems(legacyBacklog),
      },
    ],
    priorities: {
      p0: legacyBacklog.filter((item) => item.priority === "p0").length,
      p1: legacyBacklog.filter((item) => item.priority === "p1").length,
      p2: legacyBacklog.filter((item) => item.priority === "p2").length,
      p3: legacyBacklog.filter((item) => item.priority === "p3").length,
    },
    statusCounters: {
      todo: legacyBacklog.filter((item) => item.status === "todo").length,
      in_progress: legacyBacklog.filter((item) => item.status === "in_progress")
        .length,
      blocked: legacyBacklog.filter((item) => item.status === "blocked").length,
      done: legacyBacklog.filter((item) => item.status === "done").length,
    },
    totalItems: legacyBacklog.length,
    lastUpdated: Date.now(),
    storage: "json-file",
    limitations: PROJECT_BOARD_FALLBACK_LIMITATIONS,
  };

  const sprintPayload = isRecord(record.sprint)
    ? {
        sprint: {
          id: "current",
          name: asString(record.sprint.sprintLabel) ?? "Current Sprint",
          goal:
            asString(record.sprint.focus) ??
            "Keep backlog routing and ownership current.",
          startsOn: null,
          endsOn: null,
        },
        statusMetrics: {
          total: legacyBacklog.length,
          todo: backlogPayload.statusCounters.todo,
          inProgress: backlogPayload.statusCounters.in_progress,
          blocked: backlogPayload.statusCounters.blocked,
          done: backlogPayload.statusCounters.done,
          completionRate:
            legacyBacklog.length > 0
              ? backlogPayload.statusCounters.done / legacyBacklog.length
              : 0,
        },
        lastUpdated: asNumber(record.sprint.updatedAt) ?? Date.now(),
        storage: "json-file" as const,
        limitations: PROJECT_BOARD_FALLBACK_LIMITATIONS,
      }
    : {
        sprint: {
          id: "current",
          name: "Current Sprint",
          goal: "Keep backlog routing and ownership current.",
          startsOn: null,
          endsOn: null,
        },
        statusMetrics: {
          total: legacyBacklog.length,
          todo: backlogPayload.statusCounters.todo,
          inProgress: backlogPayload.statusCounters.in_progress,
          blocked: backlogPayload.statusCounters.blocked,
          done: backlogPayload.statusCounters.done,
          completionRate:
            legacyBacklog.length > 0
              ? backlogPayload.statusCounters.done / legacyBacklog.length
              : 0,
        },
        lastUpdated: Date.now(),
        storage: "json-file" as const,
        limitations: PROJECT_BOARD_FALLBACK_LIMITATIONS,
      };

  return toProjectBoardWorkspaceSnapshot({
    profilePayload,
    sprintPayload,
    backlogPayload,
  });
}

export function parseProjectBoardCallAck(
  raw: unknown,
  fallback: { action: string; requestedBy: string; traceId: string },
): ProjectBoardCallResult {
  const record = isRecord(raw) ? raw : {};

  const ackId =
    asString(record.ackId) ??
    asString(record.runId) ??
    `project-board-call-${fallback.traceId}`;
  const queuedAt =
    asNumber(record.queuedAt) ?? asNumber(record.calledAt) ?? Date.now();
  const queueDepth = asNumber(record.queueDepth) ?? 1;
  const note =
    asString(record.note) ??
    asString(record.message) ??
    "Project Board call acknowledged by Cavi Control compatibility mapper.";

  const limitations =
    record.limitations === undefined
      ? ([] as readonly string[])
      : normalizeLimitations(record.limitations);

  return {
    ackId,
    status: "queued",
    action: asString(record.action) ?? fallback.action,
    requestedBy: asString(record.requestedBy) ?? fallback.requestedBy,
    queuedAt,
    queueDepth,
    note,
    storage: normalizeProjectBoardStorageMode(record.storage),
    limitations,
    traceId: fallback.traceId,
  };
}
