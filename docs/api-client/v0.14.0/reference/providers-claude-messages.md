# @cavi-ai/api-client/providers/claude/messages

Package subpath: ./providers/claude/messages

<a id="symbol-providers-claude-messages-claude-runtime-support"></a>

## CLAUDE_RUNTIME_SUPPORT

Kind: variable

```ts
/** Derived from PROVIDER_CAPABILITIES — the single declaration site. */
export declare const CLAUDE_RUNTIME_SUPPORT: Readonly<Partial<Record<"runs" | "streaming" | "media" | "wiki" | "agentConfig" | "teams" | "kanban" | "workspace" | "operator" | "discourse" | "batch", boolean>>>;
```

<a id="symbol-providers-claude-messages-claudeapiclient"></a>

## ClaudeApiClient

Kind: class

```ts
export declare class ClaudeApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly defaultModel?;
    private readonly defaultMaxTokens;
    private readonly runStore;
    constructor(options: ClaudeApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    /**
     * Start a run and stream it as canonical RunStreamEvents. Anthropic starts
     * and streams in one POST (stream:true), so there is no prior runId — it is
     * captured from the message_start event. (Finding F4: this is why Claude uses
     * streamRun rather than RunEventStreamProvider.subscribe(runId).)
     */
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
    submitBatch(requests: RuntimeBatchRequest[]): Promise<RuntimeBatchStatus>;
    getBatch(batchId: string): Promise<RuntimeBatchStatus>;
    cancelBatch(batchId: string): Promise<RuntimeBatchStatus>;
    getBatchResults(batchId: string): Promise<RuntimeBatchResult[]>;
}
```

<a id="symbol-providers-claude-messages-claudeapiclientoptions"></a>

## ClaudeApiClientOptions

Kind: type

```ts
export type ClaudeApiClientOptions = {
    apiKey: string;
    /** Default model when a run does not specify one. */
    defaultModel?: string;
    /** Default max_tokens when a run does not specify one (Anthropic requires it). */
    defaultMaxTokens?: number;
    anthropicVersion?: string;
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
};
```

<a id="symbol-providers-claude-messages-createclaudeprovidermodule"></a>

## createClaudeProviderModule

Kind: function

```ts
/**
 * Build the runtime-only Claude (Anthropic) provider module. The Anthropic API
 * key is captured here, so `createApiClient` needs no cast — the registry's
 * HttpApiClientOptions (baseUrl/fetchImpl/onTrace) merge over the captured
 * config. (Resolves spike finding F2b.)
 *
 * Claude is not a gateway — no teams, kanban, workspace, or WS-RPC. It
 * implements the universal RuntimeClient only and registers via
 * createRuntimeProviderRegistry (F2).
 */
export declare function createClaudeProviderModule(config: ClaudeApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-claude-messages-mapanthropicstreamevent"></a>

## mapAnthropicStreamEvent

Kind: function

```ts
/**
 * Map one Anthropic Messages SSE event to a canonical RunStreamEvent.
 * Returns null for events with no RunStreamEvent equivalent (message_start,
 * ping, content_block_start/stop, message_delta) — the caller skips those.
 * `runId` is supplied by the caller (captured from `message_start`).
 */
export declare function mapAnthropicStreamEvent(sse: SseMessage, runId: string): RunStreamEvent | null;
```

<a id="symbol-providers-claude-messages-readanthropicrunid"></a>

## readAnthropicRunId

Kind: function

```ts
/** Extract the run id from an Anthropic `message_start` SSE event, if present. */
export declare function readAnthropicRunId(sse: SseMessage): string | null;
```
