---
documentedVersion: {{documentedVersion}}
---

# Choose a backend and keep workflows reusable

Construct clients at your application's configuration boundary. Pass the
resulting `CapabilityClient` into your run, stream, or batch functions.
Those functions should accept application input, not provider credentials.

| Provider | Execution lifecycle | Batch | Required configuration |
| --- | --- | --- | --- |
| Claude Messages | Synchronous; terminal state remembered locally | Yes | Anthropic key and available model |
| Claude Managed Agents | Server-side sessions | No | Beta access and persisted agent ID |
| Codex | Stored background responses | Yes | OpenAI key and available model |
| AGY | Synchronous; terminal state remembered locally | No | Service URL, API key, agent ID as model |
| OpenCode | Scoped server sessions | No | Compatible server and absolute project directory |
| Hermes | Gateway runs; SSE stream bridge | No | Gateway URL/token; session key for streaming |
| OpenClaw | Gateway RPC; WebSocket stream bridge | No | Gateway URL/authentication and granted scopes |

Runtime-only modules must be registered explicitly. The default registry
contains Hermes and OpenClaw. Credentials supplied to the facade do not
register an adapter. Resolved capabilities and each call's result determine
what an instance can actually do.

## Claude Messages and Codex at one boundary

This factory chooses the adapter from server configuration. Both clients can
be passed into the same [stream handler](streaming.md) or
[run retrieval helper](requests.md).

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude/messages";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

export function createBackend(config: { provider: "claude" | "codex"; apiKey: string }) {
  const module = config.provider === "claude"
    ? createClaudeProviderModule({ apiKey: config.apiKey })
    : createCodexProviderModule({ apiKey: config.apiKey });
  const registry = createRuntimeProviderRegistry({ modules: [module] });
  return createApiClient(config.provider, { registry, defaultTimeoutMs: 30_000 });
}
```

The returned client belongs to its application owner. Reuse it within the
selected credential/configuration scope; dispose when that owner shuts down.
Supply a provider-compatible model and tools in your run body. Changing the
adapter does not translate native tool schemas or grant model access.

### Claude Messages

`startRun` returns a terminal response. `getRun` reads remembered state from
this client rather than polling Anthropic; it is not durable across restarts.
Use `streamRun` for incremental events. The
[answer service](../introduction/quickstart.md) returns text and usage to a caller.

[Messages operations](../operations/providers/claude-anthropic.md)

### Codex

The adapter uses the OpenAI Responses API, not a local Codex CLI.
`startRun` can return an active run. Persist its ID and retrieve it later,
or use a [bounded local wait](requests.md). Decide explicitly whether a local
timeout should request cancellation.

Older releases normalize the response's `output_text` field without flattening
native `output` items. A completed response can have no normalized text. Check the
[repository changelog](https://github.com/cavi-ai/cavi-api-client/blob/main/CHANGELOG.md)
before relying on it.

[Codex operations](../operations/providers/codex.md)

## Claude Managed Agents

Use this stateful beta adapter when you already have provider access and a
persisted agent. Configure an optional environment at the same boundary.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createClaudeManagedAgentProviderModule } from "@cavi-ai/api-client/providers/claude/managed-agents";

export function createManagedBackend(config: {
  apiKey: string; agentId: string; environmentId?: string;
}) {
  const registry = createRuntimeProviderRegistry({
    modules: [createClaudeManagedAgentProviderModule(config)],
  });
  return createApiClient("claude-managed-agents", { registry });
}
```

The module declares runs and streaming, not batch. Use the concrete Managed
Agents client for agent, environment, vault, and deployment administration.
Those operations are not universal facade resources.

[Managed Agents operations](../operations/providers/claude-managed-agents.md)

## AGY

Supply the orchestration service URL. Set the run's `model` to the configured
agent ID, or configure a module `defaultModel`.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createAgyProviderModule } from "@cavi-ai/api-client/providers/agy";

export function createAgyBackend(config: { baseUrl: string; apiKey: string }) {
  const registry = createRuntimeProviderRegistry({
    modules: [createAgyProviderModule({ apiKey: config.apiKey })],
  });
  return createApiClient("agy", { registry, baseUrl: config.baseUrl });
}
```

Runs are synchronous; retrieval and cancellation use remembered terminal state.
Streaming distinguishes upstream failed runs from transport errors and does
not infer completion from premature EOF. AGY is the active successor direction
for new compatible orchestration integrations.

[AGY operations](../operations/providers/agy.md)

## OpenCode

Run the server separately. The adapter targets `OPENCODE_SERVER_VERSION` and
the `legacy-http-sse` endpoint family. Supply an absolute HTTP(S) URL without
embedded credentials, query, or fragment, and an absolute project directory.

```ts
import { createApiClient, createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { createOpenCodeProviderModule } from "@cavi-ai/api-client/providers/opencode";

export function createOpenCodeBackend(config: {
  baseUrl: string; directory: string; workspace?: string;
  username?: string; password?: string;
}) {
  const registry = createRuntimeProviderRegistry({
    modules: [createOpenCodeProviderModule({
      baseUrl: config.baseUrl,
      scope: { directory: config.directory, workspace: config.workspace },
      username: config.username,
      password: config.password,
    })],
  });
  return createApiClient("opencode", { registry });
}
```

A password enables Basic authentication; username defaults to `opencode`.
Username alone does not enable authentication. Scoping selects server resources;
it is not a sandbox guarantee.

OpenCode provides runs and streaming, without batch or gateway resources.
Streaming subscribes before submission and has no reconnect/replay.
Cancellation requests a server session abort.

[OpenCode operations](../operations/providers/opencode.md)

## Hermes

```ts
import { createApiClient } from "@cavi-ai/api-client";

export function createHermesBackend(baseUrl: string, token: string) {
  return createApiClient("hermes", { baseUrl, token });
}
```

Use your deployed gateway origin and accepted authentication. For
`streamRun`, supply the gateway's `sessionKey` in the body. Without it,
the call returns a `request-invalid` gap and starts no run.
Resources depend on the instance; teams also need a manifest or explicit backend.

[Gateway resources](gateway.md) · [Hermes operations](../operations/providers/hermes.md)

## OpenClaw

```ts
import { createApiClient } from "@cavi-ai/api-client";

export function createOpenClawBackend(baseUrl: string, token: string) {
  return createApiClient("openclaw", {
    baseUrl,
    token,
    clientMode: "cli",
    requestedScopes: ["operator.read", "operator.write"],
  });
}
```

This is a headless server configuration. The WebSocket URL is derived from
`baseUrl` unless supplied. In CLI mode no origin is derived automatically;
for origin-gated configurations supply an allowlisted `clientOrigin`.
Requesting scopes does not grant them.

The facade bridges native events into `streamRun`. Media/wiki depend on
native RPC and installed plugins. Browser applications need gateway-approved
identity/origin settings and browser-user credentials.

[OpenClaw operations](../operations/providers/openclaw.md)
