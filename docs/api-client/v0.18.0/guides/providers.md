---
documentedVersion: 0.18.0
---

# Choose and configure a provider

Start with the backend your application needs. Runtime-only modules must be
registered explicitly; the default facade registry contains Hermes and
OpenClaw. Supplying credentials to the facade does not create an unregistered
runtime-only module.

| Provider | Execution lifecycle | Batch | Additional setup |
| --- | --- | --- | --- |
| Claude Messages | Synchronous; terminal status remembered locally | Yes | Anthropic API key and available model |
| Claude Managed Agents | Server-side sessions | No | Beta access, existing agent, optional environment |
| Codex | Stored background responses | Yes | OpenAI API key and available model |
| AGY | Synchronous; terminal status remembered locally | No | Service URL, API key, agent ID as model |
| OpenCode | Scoped server sessions | No | Compatible server and absolute project directory |
| Hermes | Gateway runs; SSE event bridge | No | Gateway URL, token, session key for streaming |
| OpenClaw | Native gateway RPC; WebSocket event bridge | No | Gateway URL, authentication and granted scopes |
| Gemini (legacy compatibility) | Synchronous; terminal status remembered locally | Yes | Google API key and explicit model |

This is orientation. Resolved capabilities and each call's result determine
what your configured instance can actually do. Runtime-only modules do not
supply gateway resources just because those accessors exist on the facade.

## Claude Messages

Use the [quickstart](../introduction/quickstart.md) for complete setup and a first
response. Import `createClaudeProviderModule` from
`@cavi-ai/api-client/providers/claude/messages`, register it with
`createRuntimeProviderRegistry`, and select `"claude"`.

Pass your API key to the module. Supply a model available to your account.
`startRun` returns a terminal result; `getRun` remembers it on this client
rather than polling Anthropic. Use `streamRun` for incremental events.

[Messages operations](../operations/providers/claude-anthropic.md)

## Claude Managed Agents

This is a separate stateful beta integration. Obtain provider access and an
existing agent before starting a run. An environment can also be configured.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeManagedAgentProviderModule } from "@cavi-ai/api-client/providers/claude/managed-agents";

const apiKey = process.env.ANTHROPIC_API_KEY;
const agentId = process.env.ANTHROPIC_AGENT_ID;
if (!apiKey || !agentId) throw new Error("Set the API key and persisted agent ID.");

const registry = createRuntimeProviderRegistry({
  modules: [createClaudeManagedAgentProviderModule({
    apiKey,
    agentId,
    environmentId: process.env.ANTHROPIC_ENVIRONMENT_ID,
  })],
});
const client = createApiClient("claude-managed-agents", { registry });
// Use client.startRun / client.streamRun, then dispose when its owner shuts down.
await client.dispose();
```

The provider module declares runs and streaming, not batch. Use the concrete
Managed Agents client for provider-specific agent, environment, vault, and
deployment operations; those are not universal facade resources.

[Managed Agents operations](../operations/providers/claude-managed-agents.md)

## Codex

The Codex adapter uses the OpenAI Responses API, not a local Codex CLI.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) throw new Error("Set OPENAI_API_KEY.");
const registry = createRuntimeProviderRegistry({
  modules: [createCodexProviderModule({ apiKey })],
});
const client = createApiClient("codex", { registry, defaultTimeoutMs: 30_000 });
await client.dispose();
```

Choose an account-accessible model on your run request. `startRun` may return
`started` or `running`; retrieve the run until it reaches a terminal state.
Use a bounded poll and explicitly decide whether to cancel on timeout.

The current mapper populates normalized text from the response's `output_text`
field; it does not flatten native `output` items. A completed response can
therefore have no normalized text. Do not print `undefined` as a successful
answer; keep this limitation visible when choosing the adapter.

[Request lifecycle](requests.md) · [Codex operations](../operations/providers/codex.md)

## AGY

AGY is the active successor direction for new compatible orchestration
integrations. The caller supplies the orchestration service URL.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createAgyProviderModule } from "@cavi-ai/api-client/providers/agy";

const baseUrl = process.env.AGY_BASE_URL;
const apiKey = process.env.AGY_API_KEY;
if (!baseUrl || !apiKey) throw new Error("Set AGY_BASE_URL and AGY_API_KEY.");
const registry = createRuntimeProviderRegistry({
  modules: [createAgyProviderModule({ apiKey })],
});
const client = createApiClient("agy", { registry, baseUrl });
await client.dispose();
```

Set `body.model` to the configured AGY agent ID (or provide `defaultModel`
in the module). Input becomes the orchestration context. Runs are synchronous;
retrieval/cancellation use remembered terminal state. Streaming handles upstream
failed runs separately from transport errors and does not fabricate completion
on premature EOF.

[AGY operations](../operations/providers/agy.md)

## OpenCode

This opt-in adapter targets the server version declared by `OPENCODE_SERVER_VERSION` and the `legacy-http-sse` endpoint
family. Run the compatible server separately. Supply an absolute HTTP(S) URL
without embedded credentials, query, or fragment, and an absolute scoped
project directory.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createOpenCodeProviderModule } from "@cavi-ai/api-client/providers/opencode";

const baseUrl = process.env.OPENCODE_URL;
const directory = process.env.OPENCODE_DIRECTORY;
if (!baseUrl || !directory) throw new Error("Set OPENCODE_URL and OPENCODE_DIRECTORY.");
const registry = createRuntimeProviderRegistry({
  modules: [createOpenCodeProviderModule({
    baseUrl,
    scope: { directory, workspace: process.env.OPENCODE_WORKSPACE },
    username: process.env.OPENCODE_USERNAME,
    password: process.env.OPENCODE_PASSWORD,
  })],
});
const client = createApiClient("opencode", { registry });
await client.dispose();
```

Workspace is optional; scope strings are encoded in requests. A password enables
Basic authentication and the username defaults to `opencode`. A username alone
does not enable authentication. Treat scopes as configuration, not a sandbox
guarantee.

OpenCode has runs and streaming, without batch or gateway resources. Streaming
subscribes before sending the prompt; it does not reconnect or replay.
Cancellation requests a server session abort.

[OpenCode operations](../operations/providers/opencode.md)

## Hermes

```ts
import { createApiClient } from "@cavi-ai/api-client";

const baseUrl = process.env.GATEWAY_URL;
const token = process.env.GATEWAY_TOKEN;
if (!baseUrl || !token) throw new Error("Set GATEWAY_URL and GATEWAY_TOKEN.");
const client = createApiClient("hermes", { baseUrl, token });
await client.dispose();
```

Use your deployed gateway origin and the authentication it accepts.
For facade `streamRun`, provide the gateway's `sessionKey` in the run body.
Without it the call returns a `request-invalid` gap and starts no run.
Streaming bridges SSE run events. Resources and plugins depend on the instance;
teams also require an available manifest or explicit backend.

[Gateway resources](gateway.md) · [Hermes operations](../operations/providers/hermes.md)

## OpenClaw

```ts
import { createApiClient } from "@cavi-ai/api-client";

const baseUrl = process.env.GATEWAY_URL;
const token = process.env.GATEWAY_TOKEN;
if (!baseUrl || !token) throw new Error("Set GATEWAY_URL and GATEWAY_TOKEN.");
const client = createApiClient("openclaw", {
  baseUrl,
  token,
  clientMode: "cli",
  requestedScopes: ["operator.read", "operator.write"],
});
await client.dispose();
```

The WebSocket URL is derived from the base URL unless you supply
`webSocketUrl`. Origin-gated deployments require an allowlisted
`clientOrigin`; the default uses the gateway's own origin. Scope requests
must also be allowed by the gateway. Requesting a scope does not grant it.

The facade bridges native events into `streamRun`. Media/wiki support depends
on native RPC and installed plugins, not invented REST endpoints.
Dispose the client when its owner shuts down.

[OpenClaw operations](../operations/providers/openclaw.md)

## Gemini legacy compatibility

Keep this adapter for existing consumers. It is not the package's direction
for new orchestration integrations.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createGeminiProviderModule } from "@cavi-ai/api-client/providers/gemini/runtime";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error("Set GEMINI_API_KEY.");
const registry = createRuntimeProviderRegistry({
  modules: [createGeminiProviderModule({ apiKey })],
});
const client = createApiClient("gemini", { registry });
await client.dispose();
```

Every run requires an explicit model. Runs are synchronous, with client-local
terminal retrieval. Files and batch processing are provider-specific.
[Gemini operations](../operations/providers/gemini.md)

## Recover from setup failures

Unknown provider: register the runtime-only module and use a declared kind or
alias. Missing model or scope: correct module/run configuration before retrying.
401/403: verify credentials and granted permissions. Resource gap: inspect the
capability map and the deployment's plugins rather than checking method presence.

Continue with [requests](requests.md), [streaming](streaming.md), and
[error handling](errors.md).
