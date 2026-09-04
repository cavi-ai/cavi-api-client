# Antigravity (AGY) Integration

AGY is the active successor direction for new compatible orchestration
integrations in `@cavi-ai/api-client`. The existing Gemini provider remains a
legacy compatibility surface; both providers continue to use the same
provider-agnostic runtime contract.

## Getting started

Callers supply the AGY service `baseUrl`; the package does not choose a default
endpoint. Supply the provider API key through the AGY module configuration.

```ts
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
} from "@cavi-ai/api-client";
import { createAgyProviderModule } from "@cavi-ai/api-client/providers/agy";

const registry = createRuntimeProviderRegistry({
  modules: [
    createAgyProviderModule({
      apiKey: process.env.AGY_API_KEY,
    }),
  ],
});

const client = createRuntimeClient("agy", {
  registry,
  clientOptions: {
    baseUrl: process.env.AGY_BASE_URL,
  },
});
```

`baseUrl` is required when the AGY client is constructed. `AgyApiClientOptions`
also accepts the shared runtime HTTP policy fields (`defaultTimeoutMs`,
`cache`, and `credentials`) alongside provider-owned authentication.

## Operations and stream behavior

- **Runs:** `startRun` sends the provider's run request and stores the returned
  status for subsequent `getRun` and `cancelRun` calls.
- **Streaming:** `streamRun` consumes AGY Server-Sent Events and maps output
  deltas and terminal states to the canonical runtime stream events.
- **Failed runs:** an upstream failed run emits a canonical `run.failed` event
  and records the failed status. This is distinct from a transport-level
  `onError` callback.
- **Malformed frames:** a malformed JSON SSE frame is reported through
  `onError` as a non-terminal error. Later valid frames continue to be
  processed.
- **Caller abort:** aborting the supplied signal stops the stream without
  synthesizing a `run.completed` event.

## Capabilities

| Capability | Supported | Notes |
| :--- | :--- | :--- |
| **Runs** | Yes | Uses the AGY run operation |
| **Streaming** | Yes | Maps AGY SSE frames to canonical runtime events |
| **Batching** | No | The AGY module does not declare batch support |
