import type { AgentMemorySnapshot } from "../../domain/index.js";

export const fallbackAgentMemory: AgentMemorySnapshot = {
  agentId: "unknown",
  activeFiles: [],
  journalCount: 0,
  lastJournalDate: null,
};
