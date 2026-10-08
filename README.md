<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="@cavi-ai/api-client" width="440">
</h1>

<p align="center"><strong>One application. Several agent runtimes.</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)

Give users a choice of runtime without writing another progress renderer, batch
collector, or failure handler for each backend. `@cavi-ai/api-client` adapts
Claude, Codex, AGY, OpenCode, Hermes, and OpenClaw to shared TypeScript contracts.
Gemini remains available for existing integrations.

Your application consumes run IDs, statuses, text, token usage, and stream
events. Provider adapters own the HTTP, SSE, or WebSocket mapping. Capabilities
tell your application which features to offer; unsuccessful calls carry a
structured gap.

## Where it helps

| You are building | The package gives you |
| --- | --- |
| An assistant UI with a runtime selector | One stream event handler for text, tools, approvals, and terminal states |
| A service that starts background work | A shared run/status contract for retrieval and cancellation |
| A batch processing job | Request correlation by `customId` and per-item success/failure results |
| A gateway dashboard | Sessions, models, usage, tasks, and workspace access, gated by the configured backend |

The package is ESM, includes TypeScript declarations, has no runtime
dependencies, and keeps React optional. Models, credentials, native tools,
and persistence still belong to the provider. Installing the package does not
install a runtime.

If your application only needs one provider's native API and no shared workflow,
its direct SDK may be simpler. This package is useful when the integration
boundary needs to survive another backend.

## Build an answer service

Use Node.js 20 or later and keep provider credentials on your server.

```sh
npm install @cavi-ai/api-client
```

Put this factory in your server application. Supply your Anthropic API key and
an account-accessible model from server configuration. It creates a reusable
service that returns text, run identity, and usage to its caller.

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

Call `assistant.answer(question)` on the service returned by `createAssistant`.
When `result.ok` is true, use `result.data.text` in your HTTP response, saved
record, or UI. When it is false, handle `result.gap.reason`; retain the gap for
diagnostics. Authentication errors, unclassified failures, unsuccessful runs,
and missing text reject, so use your server's exception boundary.

The service's exceptions use `ApiClientError`: `run_failed`, `run_cancelled`,
`run_incomplete`, or `run_output_missing`. Narrow with `isApiClientError` and
branch on `code`; keep `cause` in protected diagnostics for run reconciliation.
The new `ApiClientErrorCode.Run*` members and `ApiClientErrorType.Run` are
unreleased; the example uses their string values to work on npm's pinned
release. See [error handling](https://cavi-ai.xyz/docs/api-client/guides/errors)
for guards and safe application responses.

Development builds add `requireRunText(run)` and `requireStreamText(stream)`
to replace those execution checks with package APIs. Completion-only helpers
also support tool-oriented runs without requiring text. See the
[development guide and complete examples](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/run-results.md).
These helpers are unreleased; the quickstart above remains compatible with npm.

For background workflows, development builds also provide `waitForRun` with
time and poll budgets, caller cancellation, and the last observed run retained.
Stopping a local wait leaves backend work running. The development guide
includes a complete background answer example.
The [authorized background workflow](https://github.com/cavi-ai/cavi-api-client/blob/main/docs/guides/owned-background-runs.md)
shows stored-owner checks for retrieval, polling, and explicit cancellation.

Development builds also expose structured execution failure details for Codex
responses/streams and Claude Messages error streams. Branch on observed
provider codes or reasons without parsing diagnostic messages; completion
helpers retain those details in their error causes.

The factory above is example application code, not an exported package API.
It uses Claude Messages' synchronous lifecycle. Background adapters need
retrieval; they do not promise an answer when `startRun` returns.
Create one service per credential/configuration scope, reuse it, and call
`assistant.dispose()` when its owner shuts down.

## Integrate the workflow you need

- [Test your server integration](https://cavi-ai.xyz/docs/api-client/guides/testing):
  runnable application tests for answers, progress, validation, and safe failures.

- [First response](https://cavi-ai.xyz/docs/api-client/introduction/quickstart):
  reusable service and result handling.
- [Server requests](https://cavi-ai.xyz/docs/api-client/guides/server):
  validate input and return run state through an application endpoint.
- [Provider setup](https://cavi-ai.xyz/docs/api-client/guides/providers):
  credentials, model selection, and backend requirements.
- [Streaming](https://cavi-ai.xyz/docs/api-client/guides/streaming):
  send deltas to your UI and distinguish call failure from run failure.
- [Background runs](https://cavi-ai.xyz/docs/api-client/guides/requests) and
  [batches](https://cavi-ai.xyz/docs/api-client/guides/batching):
  bound local waits and preserve IDs for later retrieval.
- [Errors](https://cavi-ai.xyz/docs/api-client/guides/errors):
  gaps, exceptions, and safe retry decisions.

Prefer `createApiClient` for applications. Its `CapabilityClient` keeps
accessors present and returns `CapabilityResult<T>`. Use the raw
`RuntimeClient` when implementing an adapter or managing the execution
contract directly; its optional methods return raw values and can throw.

## Project references

[Migration](MIGRATION.md) · [Changelog](CHANGELOG.md) ·
[Architecture](ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md) ·
[Security](SECURITY.md)

Versioned documentation ships in the package under
`docs/api-client/v<package.json version>` for offline reading. The site ingests
the GitHub release docs artifact; merging documentation changes alone does not
refresh an already published release. See the
[host ingestion contract](docs/api-client/CONSUMER.md).

## License

[MIT](LICENSE)
