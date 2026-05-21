/** Fleet Library Schema v1 — team library status and candidate data for Cavi Control. */

export type LibraryNoteType =
  | "concept"
  | "source"
  | "meeting"
  | "decision"
  | "transcript"
  | "synthesis"
  | "person"
  | "org"
  | "project";

export type LibraryStatus = "draft" | "active" | "archived";
export type LibraryVerification = "unreviewed" | "reviewed" | "disputed";
export type LibrarySensitivity = "public" | "internal" | "confidential";

export type LibrarySourceEntry = {
  uri: string;
  title?: string;
  kind: "web" | "file" | "repo" | "meeting" | "chat" | "manual";
  format: "html" | "pdf" | "md" | "txt" | "audio" | "video" | "email" | "json";
  capture_method: "clip" | "upload" | "transcription" | "manual" | "agent";
  captured_at: string;
  author?: string;
  site?: string;
  published_at?: string;
};

export type LibraryNote = {
  schema_version: number;
  id: string;
  note_type: LibraryNoteType;
  title: string;
  aliases: string[];
  tags: string[];
  domains: string[];
  summary: string;
  status: LibraryStatus;
  verification: LibraryVerification;
  language: string;
  sensitivity: LibrarySensitivity;
  compiled_at: string;
  compiled_by: string;
  content_hash: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sources: LibrarySourceEntry[];
};

export type TeamLibraryStatus = {
  teamId: string;
  teamName: string;
  lead: string;
  inboxCount: number;
  candidatesCount: number;
  promotedCount: number;
  rejectedCount: number;
  recentPromotions: Array<{
    id: string;
    title: string;
    note_type: LibraryNoteType;
    promoted_at: string;
    promoted_by: string;
    /** When set, mobile/web can open this path in the gateway wiki vault reader. */
    wiki_path?: string;
  }>;
  qmdHealth: {
    lastIndexedAt: number | null;
    collectionSize: number;
    healthy: boolean;
  };
};

export type FleetLibrarySnapshot = {
  generatedAt: number;
  teams: TeamLibraryStatus[];
  sigmund: {
    status: "online" | "offline" | "unknown";
    lastIngestAt: number | null;
    totalProcessed: number;
  };
};

export type AgentMemoryFile = {
  filename: string;
  content: string;
  lastModified: number;
};

export type AgentMemorySnapshot = {
  agentId: string;
  activeFiles: AgentMemoryFile[];
  journalCount: number;
  lastJournalDate: string | null;
};
