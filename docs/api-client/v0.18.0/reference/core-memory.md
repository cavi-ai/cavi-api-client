# @cavi-ai/api-client/core/memory

Package subpath: ./core/memory

<a id="symbol-core-memory-agentid"></a>

## AgentId

Kind: type

```ts
/**
 * Canonical agent identity. Used by access/workspace contracts for "who is asking". Memory
 * itself is scoped by domain/role rather than by identity name (names change over time).
 */
export type AgentId = string;
```

<a id="symbol-core-memory-memoryfact"></a>

## MemoryFact

Kind: type

```ts
/** A remembered fact. The on-disk substrate is markdown text. */
export type MemoryFact = {
    id: string;
    text: string;
    scope: MemoryScope;
    tags?: readonly string[];
    /** Provenance — where this came from (runtime/session/file). Free-form. */
    source?: string;
    createdAt: string;
    updatedAt: string;
};
```

<a id="symbol-core-memory-memoryscope"></a>

## MemoryScope

Kind: type

```ts
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
```

<a id="symbol-core-memory-memorystore"></a>

## MemoryStore

Kind: interface

```ts
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
```

<a id="symbol-core-memory-recallhit"></a>

## RecallHit

Kind: type

```ts
export type RecallHit = {
    fact: MemoryFact;
    /** Opaque ranking score; ordering is meaningful, the scale is backend-owned. */
    score: number;
};
```

<a id="symbol-core-memory-recallquery"></a>

## RecallQuery

Kind: type

```ts
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
```

<a id="symbol-core-memory-rememberinput"></a>

## RememberInput

Kind: type

```ts
export type RememberInput = {
    text: string;
    scope?: MemoryScope;
    tags?: readonly string[];
    source?: string;
};
```
