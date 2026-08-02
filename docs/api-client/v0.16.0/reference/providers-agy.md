# @cavi-ai/api-client/providers/agy

Package subpath: ./providers/agy

<a id="symbol-providers-agy-agy-provider-module"></a>

## AGY_PROVIDER_MODULE

Kind: variable

```ts
export declare const AGY_PROVIDER_MODULE: RuntimeProviderModule;
```

<a id="symbol-providers-agy-agy-runtime-support"></a>

## AGY_RUNTIME_SUPPORT

Kind: variable

```ts
/**
 * Antigravity (agy) orchestration supports runs and streaming.
 * Batching is optional and omitted for the initial implementation.
 */
export declare const AGY_RUNTIME_SUPPORT: {
    readonly runs: true;
    readonly streaming: true;
};
```

<a id="symbol-providers-agy-agyapiclient"></a>

## AgyApiClient

Kind: class

```ts
export declare class AgyApiClient extends BaseHttpApiClient implements RuntimeClient {
    readonly request: HttpApiTransport;
    private readonly defaultModel?;
    private readonly runStore;
    constructor(options: AgyApiClientOptions);
    getRuntimeCapabilities(): Promise<RuntimeCapabilities>;
    startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>;
    streamRun(body: RuntimeRunStartBody, handlers: RunEventStreamHandlers, options?: {
        signal?: AbortSignal;
    }): Promise<void>;
    getRun(runId: string): Promise<RuntimeRunStatus>;
    cancelRun(runId: string): Promise<{
        status: string;
    }>;
}
```

<a id="symbol-providers-agy-agyapiclientoptions"></a>

## AgyApiClientOptions

Kind: type

```ts
export type AgyApiClientOptions = {
    /** Antigravity Orchestration API key. */
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    fetchImpl?: typeof fetch;
    onTrace?: HttpApiClientOptions["onTrace"];
};
```

<a id="symbol-providers-agy-agygenerateresponse"></a>

## AgyGenerateResponse

Kind: interface

```ts
/**
 * Standard shape of an Antigravity orchestration synchronous response.
 */
export interface AgyGenerateResponse {
    run_id?: string;
    status?: string;
    result?: {
        output?: string;
        artifacts?: string[];
    };
}
```

<a id="symbol-providers-agy-agyrunrequestbody"></a>

## AgyRunRequestBody

Kind: interface

```ts
/**
 * The standard request payload structure for Antigravity (AGY) orchestration APIs.
 */
export interface AgyRunRequestBody {
    agent_id: string;
    instructions?: string;
    context?: Record<string, unknown>;
    stream?: boolean;
}
```

<a id="symbol-providers-agy-buildagyrequestbody"></a>

## buildAgyRequestBody

Kind: function

```ts
/**
 * Builds the Antigravity request body from the universal run-start body.
 * Maps universal concepts (model -> agent_id, instructions -> instructions)
 * to the AGY orchestration surface.
 */
export declare function buildAgyRequestBody(body: RuntimeRunStartBody, defaultAgentId?: string, stream?: boolean): {
    agentId: string;
    payload: AgyRunRequestBody;
};
```

<a id="symbol-providers-agy-createagyprovidermodule"></a>

## createAgyProviderModule

Kind: function

```ts
export declare function createAgyProviderModule(config?: AgyApiClientOptions): RuntimeProviderModule;
```

<a id="symbol-providers-agy-mapagyresponsetorunstatus"></a>

## mapAgyResponseToRunStatus

Kind: function

```ts
/**
 * Maps an AGY orchestration response back to the universal RuntimeRunStatus contract.
 */
export declare function mapAgyResponseToRunStatus(agentId: string, response: AgyGenerateResponse, fallbackRunId: string): RuntimeRunStatus;
```
