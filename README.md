<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="@cavi-ai/api-client" width="440">
</h1>

<p align="center"><strong>Build your agent workflow once. Connect the runtime it needs.</strong></p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)

Agent runtimes disagree about how to start work, stream output, cancel runs, and
report failures. `@cavi-ai/api-client` gives your TypeScript application a common
client for those workflows, with provider adapters handling the wire details.

Use it when you are building an agent UI, connecting several runtimes, or
letting users choose their backend. Your application can consume the same run
and event shapes while discovering which features its configured runtime
actually provides.

- **Run and stream:** normalized execution across Claude, Codex, AGY, OpenCode,
  Hermes, and OpenClaw; Gemini remains available for legacy compatibility.
- **Handle missing features:** the capability facade returns a structured gap
  for unsupported or unavailable operations instead of fabricated results.
- **Connect gateways:** access sessions, models, tasks, workspace, and other
  resources when the backend provides them.
- **Keep dependencies small:** ESM, TypeScript declarations, no runtime
  dependencies, and optional React bindings.

Provider credentials, models, tools, and lifecycle differences still matter.
This is a client library; it does not host runtimes or make every provider
support every operation.

## Get your first result

Use Node.js 20 or later. Keep API keys on your server.

```sh
npm install @cavi-ai/api-client
```

Save this as `run.mjs`. Set `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` to an
API key and a model your account can use, then run `node run.mjs`.

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
  // Authentication and unclassified errors still reject.
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.dispose();
}
```

A successful run prints the generated sentence. Claude Messages returns a
terminal result from `startRun`; providers such as Codex can return an active
run that you retrieve later. The [consumer documentation](https://cavi-ai.xyz/docs/api-client)
covers both lifecycles, streaming, cancellation, and provider setup.

## Pick the interface your application needs

Prefer `createApiClient` for application integrations. Its `CapabilityClient`
always exposes the same accessors. Check `result.ok`; an unsuccessful call has
`data: null` and a `gap` explaining the failure. Authentication errors and
unclassified errors still throw, so keep an exception boundary.

Use `RuntimeClient` and `createRuntimeClient` when you need the lower-level
execution contract or are implementing an adapter. Raw methods return run
statuses directly, can throw, and optional operations require both a capability
check and a method-presence check. These are separate return contracts.

For streams, a successful call does not imply a successful run:
`result.data.outcome` can be `"failed"`. Handle both layers.

## Learn and integrate

- [Documentation](https://cavi-ai.xyz/docs/api-client): installation, provider
  setup, complete workflows, troubleshooting, and API reference.
- [Migration](MIGRATION.md): upgrade imports and client construction.
- [Changelog](CHANGELOG.md): changes by release.
- [Architecture](ARCHITECTURE.md): package boundaries and adapter ownership.
- [Contributing](CONTRIBUTING.md): development and verification.
- [Security](SECURITY.md): credential handling and vulnerability reporting.

For offline reading, the generated documentation is included under
`docs/api-client/v<package.json version>`. The site consumes the versioned
GitHub release docs artifact; [host ingestion](docs/api-client/CONSUMER.md)
describes its integrity checks.

## License

[MIT](LICENSE)
