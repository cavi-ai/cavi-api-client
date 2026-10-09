---
documentedVersion: 0.18.0
---

# Build an answer service

Turn a question into text your application can return, save, or render.
This example uses Claude Messages and requires a completed response from
`startRun`. For Codex and other background backends, use
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
import { ApiClientError, createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
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
        const code = run.status === "failed" ? "run_failed"
          : run.status === "cancelled" ? "run_cancelled" : "run_incomplete";
        throw new ApiClientError(`Run ${run.run_id} has no completed answer (status: ${run.status})`, {
          type: "run", code, cause: run,
        });
      }
      const text = run.output ?? run.response;
      if (text === undefined) {
        throw new ApiClientError(`Run ${run.run_id} completed with no text`, {
          type: "run", code: "run_output_missing", cause: run,
        });
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
Those are `ApiClientError` instances with `type: "run"` and codes
`run_failed`, `run_cancelled`, `run_incomplete`, or `run_output_missing`.
They carry the run in `cause` for protected diagnostics and reconciliation.
An active or unknown run is incomplete, not a reported failure. The client
itself returns a run status. Empty text remains distinct from absent text.
When an adapter supplies `output: ""`, the service accepts it. Claude's current
mapper omits empty-only text, so that response triggers `run_output_missing`.

Use `isApiClientError` to narrow exceptions and `isAuthError` for provider
authentication failures. The [error guide](../guides/errors.md) shows a caller
mapper and package enum aliases for these codes, when exported. String values keep
this example compatible with the pinned published release.

If the release exports `requireRunText`, use it to replace these
execution checks. See the
[development service example](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/run-results.md).
The implementation above also supports releases without that helper.

The service owns its client. Reuse it within one credential/configuration scope,
then call `assistant.dispose()` during shutdown. Do not dispose it after every
request or share one user's credentials with another user.

## Connect it to a product

- [Server requests](../guides/server.md): a framework-independent HTTP handler.
- [Streaming](../guides/streaming.md): deliver deltas instead of waiting for text.
- [Provider setup](../guides/providers.md): configure a different runtime.
- [Errors](../guides/errors.md): choose application responses and retry behavior.
