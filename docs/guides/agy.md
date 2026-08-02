# Antigravity (AGY) Integration

The `@cavi-ai/api-client` package provides native, first-class support for Google Antigravity (AGY) orchestration APIs. While traditional providers like Claude or Gemini talk to foundational models directly, the `agy` provider orchestrates powerful Antigravity agents capable of solving tasks, utilizing local tools, and performing multi-step reasoning.

## Getting Started

To orchestrate an Antigravity agent, initialize the `AgyApiClient` with your AGY endpoint and API key, then register it with the universal runtime client.

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
    })
  ],
});

// Create the unified client configured for Antigravity
const client = createRuntimeClient("agy", {
  registry,
  clientOptions: {
    baseUrl: "https://api.antigravity.google",
  },
});
```

## Features

The `agy` provider is designed to offer a premium experience when interacting with Antigravity agents:

- **Runs**: Execute a full agent task using `startRun`. The provider bridges the universal run start body into AGY's native orchestration payload.
- **Streaming**: Supports real-time feedback using `streamRun`. As the Antigravity agent executes its plan, the client seamlessly translates AGY's Server-Sent Events (SSE) into standard `RunEventStreamHandlers` callbacks.
- **Universal Contract**: Antigravity agents can be swapped seamlessly with simple models like `gemini` or `codex` without needing to change your application's logic.

## Capabilities

| Capability | Supported | Notes |
| :--- | :--- | :--- |
| **Runs** | Yes | Orchestrates tasks natively via AGY |
| **Streaming** | Yes | Streams agent thought processes and outputs |
| **Batching** | No | Async batching is not currently scoped for AGY |

For more details on the Antigravity local code harness, check out the [Antigravity Guide](https://antigravity.google/docs).
