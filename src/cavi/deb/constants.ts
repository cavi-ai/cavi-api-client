import type {
  DebBacklogPriority,
  DebBacklogStatus,
} from "../domain/index.js";
import { resolveDebAssetPath } from "../runtime/paths.js";

export const DEB_CANONICAL_AVATAR_CANDIDATES = [
  resolveDebAssetPath("deb-wave.png"),
  resolveDebAssetPath("deb-reports.png"),
  resolveDebAssetPath("deb-laptop.png"),
] as const;

export const DEB_FALLBACK_LIMITATIONS = [
  "Cavi Control adapter used compatibility projection for Deb payload.",
] as const;

export type DebProfileApiResponse = {
  name: string;
  role: string;
  photoPath: string | null;
  photoUrl: string | null;
  emails: string[];
  lastUpdated: number;
  storage: "json-file";
  limitations: readonly string[];
};

export type DebSprintApiResponse = {
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
  storage: "json-file";
  limitations: readonly string[];
};

export type DebBacklogApiItemResponse = {
  id: string;
  title: string;
  description: string | null;
  section: string;
  priority: DebBacklogPriority;
  status: DebBacklogStatus;
  tags: string[];
  createdAt: number;
  updatedAt: number;
};

export type DebBacklogApiResponse = {
  sections: Array<{
    section: string;
    items: DebBacklogApiItemResponse[];
  }>;
  priorities: Record<DebBacklogPriority, number>;
  statusCounters: Record<DebBacklogStatus, number>;
  totalItems: number;
  lastUpdated: number;
  storage: "json-file";
  limitations: readonly string[];
};

export type DebCallApiAckResponse = {
  ackId: string;
  status: "queued";
  action: string;
  requestedBy: string;
  queuedAt: number;
  queueDepth: number;
  note: string;
  storage: "json-file";
  limitations: readonly string[];
};
