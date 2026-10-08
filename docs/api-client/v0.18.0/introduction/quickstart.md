---
documentedVersion: 0.18.0
---

# Build an answer service

Turn a question into text your application can return, save, or render.
This example uses Claude Messages: its `startRun` resolves with a terminal
run. For Codex and other background backends, use
[background run retrieval](../guides/requests.md).

## Install and configure

Use Node.js 20 or later. Keep your Anthropic API key in server configuration
and choose a model that account can access.

```sh
npm install @cavi-ai/api-client@0.18.0
```

Save the following as `assistant.ts` in your TypeScript application, or download
the [complete service](../examples/text-service.ts). Configuration is passed
to the factory; importing the module does not start a run.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";

export function createAssistant(config: { apiKey: string; model: string }) {
  const registry = createRuntimeProviderRegistry({
    modules: [createClaudeProviderModule({ apiKey: config.apiKey })],
  });
  const client = createApiClient("claude", { registry, defaultTimeoutMs: 30_000 });

  return {
    async answer(question: string) {
      const result = await client.startRun({ model: config.model, input: question });
      if (!result.ok) return result;

      const run = result.data;
      if (run.status !== "completed") {
        throw new Error(`Run ${run.run_id} ended as ${run.status}`, { cause: run });
      }
      const text = run.output ?? run.response;
      if (text === undefined) {
        throw new Error(`Run ${run.run_id} completed with no text`, { cause: run });
      }
      return {
        ok: true as const,
        source: result.source,
        data: { runId: run.run_id, text, tokens: run.tokens },
      };
    },
    dispose: () => client.dispose(),
  };
}
```

## Use it at your application boundary

Create the service with `createAssistant({ apiKey, model })` during server
startup. Call `assistant.answer(question)` from an authenticated request or
job. A successful result has this shape; token counts depend on the provider
response:

```json
{
  "ok": true,
  "source": "live",
  "data": {
    "runId": "msg_example",
    "text": "The generated answer.",
    "tokens": { "inputTokens": 12, "outputTokens": 8, "totalTokens": 20 }
  }
}
```

| Result | What the caller does |
| --- | --- |
| `ok: true` | Return or save `data.text`; retain `data.runId` and optional `data.tokens` |
| `ok: false` | Handle `gap.reason`; keep the full gap for server diagnostics |
| Rejected promise | Use the server's exception boundary; report failure without exposing credentials or provider payloads |

The factory preserves facade gaps. It deliberately rejects a non-completed run
or a completed run without text because this application needs an answer.
Those errors carry the run in `cause`; they are example application policy.
The client itself returns a run status. Empty text is a string and remains
distinct from absent text.

The service owns its client. Reuse it within one credential/configuration scope,
then call `assistant.dispose()` during shutdown. Do not dispose it after every
request or share one user's credentials with another user.

## Connect it to a product

- [Server requests](../guides/server.md): a framework-independent HTTP handler.
- [Streaming](../guides/streaming.md): deliver deltas instead of waiting for text.
- [Provider setup](../guides/providers.md): configure a different runtime.
- [Errors](../guides/errors.md): choose application responses and retry behavior.
