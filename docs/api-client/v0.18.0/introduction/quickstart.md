---
documentedVersion: 0.18.0
---

# Get your first response

This example uses Claude Messages because `startRun` returns a terminal result:
you can see the full request and error-handling flow without a polling loop.
For a background provider, follow [request lifecycles](../guides/requests.md).

## Prepare

Use Node.js 20 or later and an Anthropic API key with access to your chosen
model. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` in your trusted server
environment. Choose a model available to that account.

```sh
npm install @cavi-ai/api-client@0.18.0
node run.mjs
```

Create `run.mjs` with the following code before running the command:

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL;
if (!apiKey || !model) {
  throw new Error("Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL.");
}
const registry = createRuntimeProviderRegistry({
  modules: [createClaudeProviderModule({ apiKey })],
});
const client = createApiClient("claude", { registry, defaultTimeoutMs: 30_000 });

try {
  const result = await client.startRun({
    model,
    input: "Explain capability checks in one sentence.",
  });
  if (!result.ok) {
    console.error(result.gap.reason, result.gap.note);
    process.exitCode = 1;
  } else if (result.data.status === "completed") {
    console.log(result.data.output ?? result.data.response);
  } else {
    console.error(result.data.status, result.data.error);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.dispose();
}
```

## Read the result

A successful run prints a generated sentence. The wording depends on the
provider. `result.ok` describes the client call; `result.data.status`
describes the run. A completed call can still report a failed run.

A missing environment variable stops execution before a request. A structured
gap is printed with its reason and note. Authentication or unclassified errors
reach `catch`; fix credentials or investigate the original error instead of
silently retrying. Set a shorter request timeout if your application requires it.

## Continue

- [Provider setup](../guides/providers.md): configure a different backend.
- [Streaming](../guides/streaming.md): show incremental output.
- [Errors and troubleshooting](../guides/errors.md): decide what to display or retry.
- [Raw runtime contract](../concepts/runtime-client.md): lower-level adapter use.
