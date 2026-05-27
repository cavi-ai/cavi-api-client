// Agent memory boundary — gateway/runtime-agnostic. Callers touch memory only through this
// contract, never raw paths or a concrete database. Universal (no node deps): safe for
// browser/React/node consumers. The node-only same-host engine and the runtime providers
// live elsewhere and implement this interface.

/**
 * Canonical agent identity. Used by access/workspace contracts for "who is asking". Memory
 * itself is scoped by domain/role rather than by identity name (names change over time).
 */
export type AgentId = string;

/**
 * Where a memory lives, by domain/role rather than a personal name. Three tiers:
 *   - `{}`                 → fleet-wide shared memory
 *   - `{ domain }`         → that domain/team's shared memory
 *   - `{ domain, member }` → a member's persistent memory inside the domain
 * `member` requires `domain`.
 */
export type MemoryScope = {
  domain?: string;
  member?: string;
};

/** A remembered fact. The on-disk substrate is markdown text. */
export type MemoryFact = {
  id: string;
  text: string;
  scope: MemoryScope;
  tags?: readonly string[];
  /** Provenance — where this came from (runtime/session/file). Free-form. */
  source?: string;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
};

export type RememberInput = {
  text: string;
  scope?: MemoryScope; // default: fleet-wide shared (no domain)
  tags?: readonly string[];
  source?: string;
};

export type RecallQuery = {
  /** Natural-language / keyword query. The ranking backend is an implementation detail. */
  query: string;
  /**
   * Scope of the search, resolved up the hierarchy (each level also sees the broader ones):
   *   - `{}`                 → everything (operator view)
   *   - `{ domain }`         → fleet-shared + that domain's shared memory
   *   - `{ domain, member }` → fleet-shared + domain-shared + that member's memory
   */
  scope?: MemoryScope;
  limit?: number;
};

export type RecallHit = {
  fact: MemoryFact;
  /** Opaque ranking score; ordering is meaningful, the scale is backend-owned. */
  score: number;
};

/**
 * The one boundary callers touch memory through. Interchangeable implementations behind it,
 * no caller rewrite to move between them:
 *   - same-host:   a local SQLite/markdown engine (node host)
 *   - distributed: a client to a remote memory service
 *
 * The durable contract is the canonical on-disk markdown-facts layout plus a shared
 * lock/drift protocol; this TS type is the native binding for TS hosts, while other-language
 * hosts bind to the same on-disk files. Provider-neutral by design.
 */
export interface MemoryStore {
  /** Idempotent by content: identical (normalized text + scope) returns the existing fact. */
  remember(input: RememberInput): Promise<MemoryFact>;
  recall(query: RecallQuery): Promise<readonly RecallHit[]>;
  /** Returns true if a fact was removed; false if no fact had that id. */
  forget(id: string): Promise<boolean>;
}
