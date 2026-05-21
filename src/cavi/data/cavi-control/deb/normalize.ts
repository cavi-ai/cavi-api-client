import type {
  DebBacklogPriority,
  DebBacklogSnapshot,
  DebBacklogStatus,
  DebCallResult,
  DebEmailRecipient,
  DebProfile,
  DebSprintStatus,
  DebWorkspaceSnapshot,
} from "../../../domain/index.js";
import { asNumber, asString, asStringArray, isRecord } from "../guards.js";
import type {
  DebBacklogApiItemResponse,
  DebBacklogApiResponse,
  DebProfileApiResponse,
  DebSprintApiResponse,
} from "./constants.js";
import { CAVI_CONTROL_BASE_PATH } from "../../../paths.js";
import {
  DEB_CANONICAL_AVATAR_CANDIDATES,
  DEB_FALLBACK_LIMITATIONS,
} from "./constants.js";
import { resolveDebAssetPath, withRuntimeBasePath } from "../runtime-paths.js";

export function normalizeDebPriority(value: unknown): DebBacklogPriority {
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

export function normalizeDebStatus(value: unknown): DebBacklogStatus {
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
  return limitations.length > 0 ? limitations : DEB_FALLBACK_LIMITATIONS;
}

export function normalizeSection(value: unknown): string {
  return asString(value)?.toLowerCase() ?? "inbox";
}

export function sortBacklogItems(
  items: DebBacklogApiItemResponse[],
): DebBacklogApiItemResponse[] {
  const priorityOrder: Record<DebBacklogPriority, number> = {
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

function toDebAssetPath(value: string): string {
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
  if (filename.startsWith("deb-") && filename.endsWith(".png")) {
    return resolveDebAssetPath(filename);
  }

  if (withoutCanonicalPrefix.startsWith("/")) {
    return withRuntimeBasePath(withoutCanonicalPrefix);
  }

  return withRuntimeBasePath(`/${withoutCanonicalPrefix.replace(/^\/+/, "")}`);
}

function buildDebAvatarCandidates(params: {
  photoPath: string | null;
  photoUrl: string | null;
}): string[] {
  const candidates = [
    ...DEB_CANONICAL_AVATAR_CANDIDATES,
    params.photoPath ? toDebAssetPath(params.photoPath) : null,
    params.photoUrl ? toDebAssetPath(params.photoUrl) : null,
  ].filter((entry): entry is string => Boolean(entry));

  return Array.from(new Set(candidates));
}

function normalizeDebProfileResponse(raw: unknown): DebProfileApiResponse {
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
    name: asString(record.name) ?? "Deb",
    role: asString(record.role) ?? "Project Board Operator",
    photoPath,
    photoUrl,
    emails: normalizeEmailList(asStringArray(record.emails)),
    lastUpdated,
    storage: "json-file",
    limitations,
  };
}

export function toDebProfile(raw: unknown): DebProfile {
  const normalized = normalizeDebProfileResponse(raw);
  return {
    ...normalized,
    avatarCandidates: buildDebAvatarCandidates({
      photoPath: normalized.photoPath,
      photoUrl: normalized.photoUrl,
    }),
  };
}

export function normalizeDebBacklogItem(
  raw: unknown,
): DebBacklogApiItemResponse | null {
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
    priority: normalizeDebPriority(record.priority),
    status: normalizeDebStatus(record.status),
    tags: Array.from(
      new Set(asStringArray(record.tags).map((tag) => tag.toLowerCase())),
    ),
    createdAt,
    updatedAt,
  };
}

function normalizeDebBacklogResponse(raw: unknown): DebBacklogApiResponse {
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
        .map((item) => normalizeDebBacklogItem(item))
        .filter((item): item is DebBacklogApiItemResponse => item !== null);

      return {
        section,
        items: sortBacklogItems(items),
      };
    })
    .filter(
      (
        entry,
      ): entry is { section: string; items: DebBacklogApiItemResponse[] } =>
        entry !== null,
    );

  const allItems = sections.flatMap((section) => section.items);

  const priorities: Record<DebBacklogPriority, number> = {
    p0: 0,
    p1: 0,
    p2: 0,
    p3: 0,
  };

  const statusCounters: Record<DebBacklogStatus, number> = {
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
    storage: "json-file",
    limitations,
  };
}

function toDebBacklog(raw: unknown): DebBacklogSnapshot {
  return normalizeDebBacklogResponse(raw);
}

function normalizeDebSprintResponse(raw: unknown): DebSprintApiResponse {
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
    storage: "json-file",
    limitations,
  };
}

function toDebSprint(raw: unknown): DebSprintStatus {
  return normalizeDebSprintResponse(raw);
}

function normalizeDebEmailRecipients(emails: string[]): DebEmailRecipient[] {
  return normalizeEmailList(emails).map((email) => ({
    id: email,
    email,
  }));
}

export function toDebWorkspaceSnapshot(params: {
  profilePayload: unknown;
  sprintPayload: unknown;
  backlogPayload: unknown;
}): DebWorkspaceSnapshot {
  const profile = toDebProfile(params.profilePayload);
  return {
    profile,
    emails: normalizeDebEmailRecipients(profile.emails),
    sprint: toDebSprint(params.sprintPayload),
    backlog: toDebBacklog(params.backlogPayload),
  };
}

export function toDebWorkspaceFromCompatPayload(
  raw: unknown,
): DebWorkspaceSnapshot {
  const record = isRecord(raw) ? raw : {};

  if (
    isRecord(record.profile) &&
    isRecord(record.sprint) &&
    isRecord(record.backlog)
  ) {
    return toDebWorkspaceSnapshot({
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

  const profilePayload: DebProfileApiResponse = {
    name: asString(legacyProfile.name) ?? "Deb",
    role: asString(legacyProfile.role) ?? "Project Board Operator",
    photoPath: asString(legacyProfile.photoPath) ?? null,
    photoUrl: asString(legacyProfile.photoUrl) ?? null,
    emails: legacyEmails,
    lastUpdated: Date.now(),
    storage: "json-file",
    limitations: DEB_FALLBACK_LIMITATIONS,
  };

  const legacyBacklog = Array.isArray(record.backlog)
    ? record.backlog
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }
          const item = normalizeDebBacklogItem({
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
        .filter((item): item is DebBacklogApiItemResponse => item !== null)
    : [];

  const backlogPayload: DebBacklogApiResponse = {
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
    limitations: DEB_FALLBACK_LIMITATIONS,
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
        limitations: DEB_FALLBACK_LIMITATIONS,
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
        limitations: DEB_FALLBACK_LIMITATIONS,
      };

  return toDebWorkspaceSnapshot({
    profilePayload,
    sprintPayload,
    backlogPayload,
  });
}

export function parseDebCallAck(
  raw: unknown,
  fallback: { action: string; requestedBy: string; traceId: string },
): DebCallResult {
  const record = isRecord(raw) ? raw : {};

  const ackId =
    asString(record.ackId) ??
    asString(record.runId) ??
    `deb-call-${fallback.traceId}`;
  const queuedAt =
    asNumber(record.queuedAt) ?? asNumber(record.calledAt) ?? Date.now();
  const queueDepth = asNumber(record.queueDepth) ?? 1;
  const note =
    asString(record.note) ??
    asString(record.message) ??
    "Deb call acknowledged by Cavi Control compatibility mapper.";

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
    storage: "json-file",
    limitations,
    traceId: fallback.traceId,
  };
}
