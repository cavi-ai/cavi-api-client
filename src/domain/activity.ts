export type ActivityEvent = {
  id: string;
  receivedAt: number;
  type: string;
  agentId: string | null;
  sessionKey: string | null;
  summary: string;
  raw: unknown;
};

export type ActivityFilters = {
  search: string;
  eventTypes: string[];
};
