# @cavi-ai/api-client/core/kanban

Package subpath: ./core/kanban

<a id="symbol-core-kanban-iskanbanpriority"></a>

## isKanbanPriority

Kind: function

```ts
export declare function isKanbanPriority(value: unknown): value is KanbanPriority;
```

<a id="symbol-core-kanban-iskanbanstatuscategory"></a>

## isKanbanStatusCategory

Kind: function

```ts
export declare function isKanbanStatusCategory(value: unknown): value is KanbanStatusCategory;
```

<a id="symbol-core-kanban-kanban-priorities"></a>

## KANBAN_PRIORITIES

Kind: variable

```ts
export declare const KANBAN_PRIORITIES: readonly [
    "low",
    "normal",
    "high",
    "urgent"
];
```

<a id="symbol-core-kanban-kanban-status-categories"></a>

## KANBAN_STATUS_CATEGORIES

Kind: variable

```ts
export declare const KANBAN_STATUS_CATEGORIES: readonly [
    "triage",
    "backlog",
    "todo",
    "scheduled",
    "active",
    "review",
    "blocked",
    "done"
];
```

<a id="symbol-core-kanban-kanbanboard"></a>

## KanbanBoard

Kind: interface

```ts
export interface KanbanBoard {
    id: string;
    name?: string;
    statuses?: readonly KanbanStatusDef[];
    metadata?: Record<string, unknown>;
}
```

<a id="symbol-core-kanban-kanbancard"></a>

## KanbanCard

Kind: interface

```ts
export interface KanbanCard {
    id: string;
    title: string;
    notes?: string;
    /** Native backend status, preserved. */
    status: string;
    /** Canonical category derived from `status` by the adapter. */
    category: KanbanStatusCategory;
    priority: KanbanPriority;
    labels: string[];
    agentId?: string;
    boardId?: string;
    links?: KanbanCardLinks;
    position: number;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}
```

<a id="symbol-core-kanban-kanbancardcreate"></a>

## KanbanCardCreate

Kind: interface

```ts
export interface KanbanCardCreate {
    title: string;
    notes?: string;
    /** Native status; when omitted the backend chooses its default column. */
    status?: string;
    priority?: KanbanPriority;
    labels?: string[];
    agentId?: string;
    boardId?: string;
    links?: KanbanCardLinks;
    metadata?: Record<string, unknown>;
}
```

<a id="symbol-core-kanban-kanbancardlinks"></a>

## KanbanCardLinks

Kind: interface

```ts
/** Generic linkage a card may carry to runtime objects. */
export interface KanbanCardLinks {
    sessionKey?: string;
    runId?: string;
    taskId?: string;
}
```

<a id="symbol-core-kanban-kanbancardpatch"></a>

## KanbanCardPatch

Kind: interface

```ts
export interface KanbanCardPatch {
    title?: string;
    notes?: string;
    priority?: KanbanPriority;
    labels?: string[];
    agentId?: string;
    metadata?: Record<string, unknown>;
}
```

<a id="symbol-core-kanban-kanbanclient"></a>

## KanbanClient

Kind: interface

```ts
/**
 * Provider-agnostic kanban contract. Every backend (OpenClaw Workboard, CAVI
 * Project Board, gateway REST, and any future one incl. Managed Agents) is an
 * adapter behind this interface. Core methods are mandatory; `extended` is
 * feature-detected.
 */
export interface KanbanClient {
    listBoards(): Promise<KanbanBoard[]>;
    listCards(params?: {
        boardId?: string;
    }): Promise<{
        cards: KanbanCard[];
        statuses?: readonly KanbanStatusDef[];
    }>;
    createCard(input: KanbanCardCreate): Promise<KanbanCard>;
    updateCard(id: string, patch: KanbanCardPatch): Promise<KanbanCard>;
    /** Move a card to a native `status` (and optional position). */
    moveCard(id: string, status: string, position?: number): Promise<KanbanCard>;
    deleteCard(id: string): Promise<void>;
    readonly extended?: KanbanExtended;
}
```

<a id="symbol-core-kanban-kanbanextended"></a>

## KanbanExtended

Kind: interface

```ts
/** Optional agent-orchestration surface. Present iff the backend supports it. */
export interface KanbanExtended {
    comment?(cardId: string, body: string): Promise<void>;
    claim?(cardId: string, agentId: string): Promise<KanbanCard>;
    release?(cardId: string): Promise<KanbanCard>;
    complete?(cardId: string): Promise<KanbanCard>;
    block?(cardId: string, reason?: string): Promise<KanbanCard>;
    unblock?(cardId: string): Promise<KanbanCard>;
    dispatch?(params?: Record<string, unknown>): Promise<unknown>;
}
```

<a id="symbol-core-kanban-kanbanpriority"></a>

## KanbanPriority

Kind: type

```ts
export type KanbanPriority = (typeof KANBAN_PRIORITIES)[number];
```

<a id="symbol-core-kanban-kanbanstatuscategory"></a>

## KanbanStatusCategory

Kind: type

```ts
export type KanbanStatusCategory = (typeof KANBAN_STATUS_CATEGORIES)[number];
```

<a id="symbol-core-kanban-kanbanstatusdef"></a>

## KanbanStatusDef

Kind: interface

```ts
/** A backend status token plus its canonical category and column order. */
export interface KanbanStatusDef {
    /** The backend's native status token, preserved verbatim. */
    status: string;
    category: KanbanStatusCategory;
    /** Column order for rendering; lower is earlier. */
    order: number;
}
```
