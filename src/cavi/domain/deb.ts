export type DebStorageMode = "json-file";

export type DebBacklogPriority = "p0" | "p1" | "p2" | "p3";

export type DebBacklogStatus = "todo" | "in_progress" | "blocked" | "done";

export type DebEmailRecipient = {
  id: string;
  email: string;
};

export type DebProfile = {
  name: string;
  role: string;
  photoPath: string | null;
  photoUrl: string | null;
  avatarCandidates: string[];
  emails: string[];
  lastUpdated: number;
  storage: DebStorageMode;
  limitations: readonly string[];
};

export type DebSprintStatus = {
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
  storage: DebStorageMode;
  limitations: readonly string[];
};

export type DebBacklogItem = {
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

export type DebBacklogSnapshot = {
  sections: Array<{
    section: string;
    items: DebBacklogItem[];
  }>;
  priorities: Record<DebBacklogPriority, number>;
  statusCounters: Record<DebBacklogStatus, number>;
  totalItems: number;
  lastUpdated: number;
  storage: DebStorageMode;
  limitations: readonly string[];
};

export type DebWorkspaceSnapshot = {
  profile: DebProfile;
  emails: DebEmailRecipient[];
  sprint: DebSprintStatus;
  backlog: DebBacklogSnapshot;
};

export type DebEmailDraft = {
  email: string;
};

export type DebBacklogDraft = {
  title: string;
  description: string;
  section: string;
  priority: DebBacklogPriority;
  status: DebBacklogStatus;
  tags: string[];
};

export type DebCallRequest = {
  action: string;
  requestedBy: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type DebCallResult = {
  ackId: string;
  status: "queued";
  action: string;
  requestedBy: string;
  queuedAt: number;
  queueDepth: number;
  note: string;
  storage: DebStorageMode;
  limitations: readonly string[];
  traceId: string;
};
