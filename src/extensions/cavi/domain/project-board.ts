export type ProjectBoardStorageMode = "json-file" | "sqlite";

export type ProjectBoardBacklogPriority = "p0" | "p1" | "p2" | "p3";

export type ProjectBoardBacklogStatus = "todo" | "in_progress" | "blocked" | "done";

export type ProjectBoardEmailRecipient = {
  id: string;
  email: string;
};

export type ProjectBoardProfile = {
  name: string;
  role: string;
  photoPath: string | null;
  photoUrl: string | null;
  avatarCandidates: string[];
  emails: string[];
  lastUpdated: number;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};

export type ProjectBoardSprintStatus = {
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

export type ProjectBoardBacklogItem = {
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

export type ProjectBoardBacklogSnapshot = {
  sections: Array<{
    section: string;
    items: ProjectBoardBacklogItem[];
  }>;
  priorities: Record<ProjectBoardBacklogPriority, number>;
  statusCounters: Record<ProjectBoardBacklogStatus, number>;
  totalItems: number;
  lastUpdated: number;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
};

export type ProjectBoardWorkspaceSnapshot = {
  profile: ProjectBoardProfile;
  emails: ProjectBoardEmailRecipient[];
  sprint: ProjectBoardSprintStatus;
  backlog: ProjectBoardBacklogSnapshot;
};

export type ProjectBoardEmailDraft = {
  email: string;
};

export type ProjectBoardBacklogDraft = {
  title: string;
  description: string;
  section: string;
  priority: ProjectBoardBacklogPriority;
  status: ProjectBoardBacklogStatus;
  tags: string[];
};

export type ProjectBoardCallRequest = {
  action: string;
  requestedBy: string;
  metadata: Record<string, string | number | boolean | null>;
};

export type ProjectBoardCallResult = {
  ackId: string;
  status: "queued";
  action: string;
  requestedBy: string;
  queuedAt: number;
  queueDepth: number;
  note: string;
  storage: ProjectBoardStorageMode;
  limitations: readonly string[];
  traceId: string;
};
