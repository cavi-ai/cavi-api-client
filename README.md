<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="cavi-ai/api-client" width="440">
</h1>

<p align="center">
  <strong>One TypeScript client for every agent runtime. 🛰️</strong><br>
  Talk to Hermes, OpenClaw, Claude, Codex, and Gemini through a single <code>RuntimeClient</code> contract — HTTP, WebSocket RPC, SSE streaming, media, wiki, team routing, React hooks, and typed data adapters, all behind one package boundary. <strong>Swap providers, not your code.</strong>
</p>

<p align="center">
  🤖 <strong>Now with first-class <a href="#-claude-managed-agents-beta">Claude Managed Agents (beta)</a></strong> — Anthropic's stateful, server-run agents (sessions · environments · SSE steering), wired to the same contract. <strong>The easy way in.</strong>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)
[![Claude Managed Agents](https://img.shields.io/badge/Claude%20Managed%20Agents-beta-7C3AED)](#-claude-managed-agents-beta)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Types](https://img.shields.io/badge/types-included-blue)
![ESM](https://img.shields.io/badge/module-ESM-blueviolet)

<p align="center">
  <img src="docs/assets/api-client-hero.svg" alt="@cavi-ai/api-client provider-agnostic architecture diagram" width="100%">
</p>

```sh
npm install @cavi-ai/api-client
```

Create one provider registry, then construct the universal `RuntimeClient`:

```ts
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  runtimeSupports,
} from "@cavi-ai/api-client";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex/runtime";

const registry = createRuntimeProviderRegistry({
  modules: [createCodexProviderModule({ apiKey: process.env.OPENAI_API_KEY! })],
});
const client = createRuntimeClient("codex", {
  registry,
  clientOptions: { baseUrl: "https://api.openai.com" },
});
const capabilities = await client.getRuntimeCapabilities();

if (runtimeSupports(capabilities, "streaming")) {
  await client.streamRun?.(
    { input: "Summarize the release notes." },
    { onEvent: (event) => console.log(event) },
  );
}
```

Provider modules capture provider credentials. The universal factory receives
only provider-neutral transport options and returns the same `RuntimeClient`
shape for every provider.

## Contents

- [Why This Package Exists](#why-this-package-exists)
- [Runtime](#runtime)
- [Exports](#exports)
- [Quick Start](#quick-start)
- [🤖 Claude Managed Agents (Beta)](#-claude-managed-agents-beta)
- [Core Concepts](#core-concepts)
  - [One Client Shape](#one-client-shape)
  - [Providers](#providers)
  - [Credential Schemes](#credential-schemes)
  - [Typed Errors](#typed-errors)
  - [Usage & Cost](#usage--cost)
  - [Graceful Degradation](#graceful-degradation)
  - [Route Mirrors](#route-mirrors)
  - [Team Manifest](#team-manifest)
- [Common Surfaces](#common-surfaces)
  - [HTTP](#http)
  - [WebSocket RPC](#websocket-rpc)
  - [Run Event Streams](#run-event-streams)
  - [Media And Wiki](#media-and-wiki)
  - [React](#react)
  - [Batch](#batch)
  - [CAVI Extension Adapters](#cavi-extension-adapters)
- [Secure Credential Handling](#secure-credential-handling)
- [Architecture](#architecture)
- [Development](#development)
  - [Versioned API Documentation](#versioned-api-documentation)
- [Contributing](#contributing)
- [Code of Conduct](#code-of-conduct)
- [Security](#security)
- [License](#license)

## Why This Package Exists

Building on top of agent runtimes means writing the same plumbing over and over:
authenticated requests, WebSocket RPC, run-event streams, capability snapshots,
route contracts, typed errors, and fallback behavior for when the backend
inevitably hiccups. `@cavi-ai/api-client` keeps all of it in one reusable,
provider-agnostic package — so your app code focuses on the *workflow*, not the
transport.

### 🤔 This package is for you if…

1. 🛰️ **You run multiple gateways and runtimes** across different providers, and you'd rather have one client than a pile of one-off integrations.
2. 🎛️ **You're building interactive, agentic UI** — live runs, streaming events, capability-aware panels — and don't want to rebuild the transport layer every single project.
3. ⏰ **You don't love the *timing* of upstream bugs** (always mid-demo, never a quiet Tuesday) and want your UI to shrug them off instead of faceplanting.
4. 🤷 **You've made peace with the one universal constant:** humans *and* agents ship mistakes. So here, degradation is a **contract** — a backend gap returns typed fallback data with a structured `contractGap`, not a white screen of death.
5. 🔀 **You need to switch providers without a rewrite** — Hermes today, OpenClaw tomorrow, Claude on Friday — all behind the exact same calls.
6. 📐 **You want stable, schema-correct endpoints** that hand back the *same shape* no matter which provider answered, so per-provider `if/else` spaghetti never leaks into your components.
7. 🎉 **You want in on a genuinely fun open-source project** (MIT, strict-typed to the teeth, conformance-tested — and yes, PRs are actually welcome).
8. 🐶🐱 **You like puppies and kittens.** …alright, we're reaching. But you're still reading, so maybe we're onto something. 😄

### 🧩 How it holds together

The core is provider-agnostic. Every provider implements one universal
`RuntimeClient` contract (capabilities · runs · streaming); gateway-style
providers (Hermes, OpenClaw) extend it with `GatewayClient` (teams, kanban,
workspace, operator), while non-gateway providers (Claude / Anthropic, Codex /
OpenAI Responses, Gemini / Google) implement the runtime tier only. Provider modules customize only what's *actually*
different — endpoint maps, headers, auth scheme, method transport. The shared
transports, error handling, stream parsing, and trace behavior stay in one
place, and an executable conformance kit keeps every provider honest.

## Runtime

- Pure TypeScript ESM with generated `.d.ts` files.
- Node.js `>=20`, or any modern runtime with `fetch` and `WebSocket`.
- Zero runtime dependencies.
- React is an optional peer dependency used only by
  `@cavi-ai/api-client/frameworks/react`.
- `fetchImpl` can be supplied anywhere a runtime needs an explicit fetch
  implementation.

## Exports

The **root export** is a curated stable API: the unified client + provider
registry, the universal `RuntimeClient`/`GatewayClient` types, errors and guards,
the graceful-degradation envelope, the auth-seam credential helpers, the team
manifest interface + resolver, and the run-stream contract. Everything else lives
behind a **subpath** so consumers import only the slice they need:

- `@cavi-ai/api-client/core/http` — `BaseHttpApiClient`, raw/JSON clients, redaction
- `@cavi-ai/api-client/core/data`
- `@cavi-ai/api-client/core/errors`
- `@cavi-ai/api-client/core/memory` — the `MemoryStore` contract
  (`remember`/`recall`/`forget`, `MemoryScope`, `MemoryFact`); gateway/harness-
  agnostic, implemented by node-only engines and runtime providers elsewhere
- `@cavi-ai/api-client/core/runtime` — `RuntimeClient`, run-stream contract
- `@cavi-ai/api-client/core/runtime/providers` — runtime registry and factory kernel
- `@cavi-ai/api-client/core/kanban` — the provider-agnostic `KanbanClient`
  interface + canonical card/status types; providers (OpenClaw Workboard today)
  adapt to it
- `@cavi-ai/api-client/core/sse`
- `@cavi-ai/api-client/core/ws`
- `@cavi-ai/api-client/core/gateway` — gateway resource clients (media, wiki, agent-config, jobs)
- `@cavi-ai/api-client/core/env`
- `@cavi-ai/api-client/core/transport` — universal HTTP, SSE, WebSocket,
  JSON-RPC, framing, lifecycle, and error infrastructure
- `@cavi-ai/api-client/core/transport/node` — Node-only stdio and Unix-domain
  socket `TransportByteChannel` drivers
- `@cavi-ai/api-client/contracts`
- `@cavi-ai/api-client/extensions/cavi` — `CaviControlApiClient`, registry, portal, library, adapters
- `./extensions/cavi/library-clip-contract.json` — the CaviClip ingest
  contract (`endpoint`, `defaultTeam`, `sourceTag`) as a raw JSON asset export,
  for hosts that need the contract without importing TypeScript
- `@cavi-ai/api-client/providers/hermes`
- `@cavi-ai/api-client/providers/openclaw`
- `@cavi-ai/api-client/providers/claude` — Claude (Anthropic): the stateless
  Messages-API runtime provider **and** the [Managed Agents (beta)](#-claude-managed-agents-beta) surface
- `@cavi-ai/api-client/providers/codex` — Codex-flavored OpenAI Responses
  runtime provider (`gpt-5-codex`, background runs, polling, cancellation,
  SSE streaming)
- `@cavi-ai/api-client/providers/gemini` — Google Gemini runtime provider
  (`GeminiApiClient`, `createGeminiProviderModule`, `GeminiFilesClient`,
  `x-goog-api-key` auth, model in URL path, batch + canonical run-stream events)
- `@cavi-ai/api-client/frameworks/react`
- Narrow entries are available for new code:
  `@cavi-ai/api-client/providers/claude/messages`,
  `@cavi-ai/api-client/providers/claude/managed-agents`,
  `@cavi-ai/api-client/providers/codex/runtime`,
  `@cavi-ai/api-client/providers/codex/files`,
  `@cavi-ai/api-client/providers/gemini/runtime`,
  `@cavi-ai/api-client/providers/gemini/files`,
  `@cavi-ai/api-client/providers/hermes/runtime`, and
  `@cavi-ai/api-client/providers/openclaw/runtime`.
- `@cavi-ai/api-client/testing` exposes the runner-neutral
  `inspectRuntimeProviderConformance` and `inspectRuntimeControlPlaneConformance`
  reports for third-party providers.

> **Upgrading from a flat-import version?** Provider modules, the CAVI extension,
> and low-level primitives moved off the root entry to their subpaths. See
> [MIGRATION.md](MIGRATION.md) for the import map.

### Shared Transport Infrastructure

Universal runtimes import `createHttpTransport`, `createSseTransport`,
`createWebSocketTransport`, and `createJsonRpcTransport` from
`@cavi-ai/api-client/core/transport`. Node applications may additionally import
`createStdioTransport` and `createUnixSocketTransport` from the isolated
`@cavi-ai/api-client/core/transport/node` entry. The root and universal entry
stay free of Node built-ins. See the compile-checked
[browser](docs/examples/runtime-transport-browser.ts) and
[Node](docs/examples/runtime-transport-node.ts) examples.

Retries and reconnects are finite, opt-in policies. HTTP mutations are never
replayed unless the caller supplies an explicit idempotency key. SSE reconnects
resume from the latest cursor and suppress duplicate event IDs within a bounded
window; WebSocket and Unix-socket reconnects are also bounded, and pending
writes are never replayed onto a replacement connection. JSON-RPC composes over
WebSocket message channels or framed stdio/Unix byte streams.

Transport errors redact credentials and expose structured
`TransportErrorMetadata`; lifecycle events provide secret-safe connection and
retry observability. This is transport infrastructure, not a provider adapter:
it does not claim support for any provider surface or map provider methods.

## Quick Start

```ts
import { createGatewayApiClient } from "@cavi-ai/api-client";

const gateway = createGatewayApiClient({
  baseUrl: process.env.GATEWAY_API_BASE_URL!,
  auth: {
    bearerToken: process.env.GATEWAY_API_AUTH_TOKEN,
    clientId: "dashboard",
  },
});

const run = await gateway.startRun({
  input: "Summarize the current workspace state.",
  session_id: "dashboard",
});
// run.run_id / run.status are your handle for polling, streaming, or UI state.
// Failures are typed — see Typed Errors below for how to branch on them.
```

## 🤖 Claude Managed Agents (Beta)

Anthropic ships a second, far less famous way to run Claude: **Managed Agents**
(beta). Instead of you running the agent loop, Anthropic does — a *persisted,
versioned agent config* spawns *stateful sessions*, each in its own
*containerized environment* where Claude executes tools (bash, file ops, code),
streaming every step over SSE. Skills, MCP servers, file mounts, multiagent
threads, and rubric-graded outcomes are all part of it. Most people don't even
know it exists.

This package is meant to be **the easy on-ramp**. It's runtime-only and additive:
the same `RuntimeClient` you already use, one extra import, no app rewrite, and
**nothing about your existing setup has to change**. Already have a harness you
like? Keep it — try Managed Agents alongside it and see which fits which job.

```ts
import {
  ClaudeManagedAgentClient,
  driveManagedAgentSession,
} from "@cavi-ai/api-client/providers/claude";

const claude = new ClaudeManagedAgentClient({
  apiKey: process.env.ANTHROPIC_API_KEY!, // or `authToken` for an OAuth bearer
});

// Agents + environments are persisted — create them once, reference them by id.
const agent = await claude.createAgent({
  name: "researcher",
  model: "claude-opus-4-8",
  system: "You are a meticulous research assistant.",
});
const env = await claude.createEnvironment({ name: "research-env" });

// A session is one stateful run against that agent in that environment.
const session = await claude.createSession({
  agentId: agent.id,
  environmentId: env.id,
});
await claude.sendMessage(session.id, { input: "Summarize today's commits." });

// Tail the SSE stream, answer tool confirmations + custom tools, survive drops.
await driveManagedAgentSession(claude, session.id, {
  onMessage: (text) => appendAgentText(text),
  onToolConfirmation: () => ({ result: "allow" }), // omit → deny
  onComplete: () => markRunComplete(),
});
```

Everything is exported from `@cavi-ai/api-client/providers/claude`, targeting the
`managed-agents-2026-04-01` beta surface:

- **Sessions & steering** — `createSession`, `sendMessage`/`sendEvents`,
  `interruptSession`, `confirmTool`, `respondCustomTool`, `openEventStream`,
  and `driveManagedAgentSession` (a deadlock-safe stream driver with lossless
  reconnect and dedupe). Session lifecycle: `getSession`, `listSessions`,
  `updateSession` (session-local tools/MCP/vault override), `archiveSession`,
  `deleteSession`.
- **Agents & environments** — persisted, versioned configs and per-session
  containers, with full lifecycle: `createAgent` / `updateAgent` / `getAgent` /
  `listAgents` / `listAgentVersions` / `archiveAgent`, and `createEnvironment` /
  `getEnvironment` / `listEnvironments` / `updateEnvironment` /
  `deleteEnvironment` / `archiveEnvironment`. `createSession` can pin an agent
  version or apply `agent_with_overrides` for a single session.
- **Session resources** — attach `file` / `github_repository` resources to a
  live session (and rotate a GitHub token mid-run): `addResource`, `getResource`,
  `listResources`, `updateResource`, `deleteResource`.
- **Scheduled deployments** — run an agent on a recurring cron schedule:
  `createDeployment`, `pauseDeployment`, `unpauseDeployment`, `archiveDeployment`,
  `runDeployment`, plus `listDeploymentRuns` / `getDeploymentRun`.
- **Typed events** — `parseSessionEvent` + a discriminated
  `ManagedAgentSessionEvent` union (messages, tool calls, status, errors,
  outcomes, threads).
- **Outcomes** — `defineOutcome` for rubric-graded session loops.
- **Multiagent threads** — `listThreads`, `openThreadEventStream`, and friends.
- **Memory stores** — full CRUD over stores, memories, and memory versions.
- **Vaults & MCP credentials** — vault/credential CRUD plus
  `validateMcpOauthCredential` for `static_bearer` and `mcp_oauth` auth.
- **Teams** — `buildManagedAgentTeamsPlan` maps a `TeamManifest` to a
  coordinator + roster.
- **Webhook verification** — `verifyManagedAgentWebhook` implements the
  Standard Webhooks signing scheme via Web Crypto (verified against the scheme;
  live delivery is out of scope for this release); `MANAGED_AGENT_WEBHOOK_EVENT_TYPES`
  covers the session, agent, deployment, and vault event types.
- **Self-hosted environments** — `getWorkQueueStats` / `stopWork` observe and
  control the work queue (queue monitoring only — the tool-executing worker
  stays with the host).

> The stateless Claude Messages-API client (`ClaudeApiClient`, below) is
> unchanged — Managed Agents is an additive sibling under the same subpath.

## Core Concepts

### Runtime Execution and Control Plane

`RuntimeClient` remains the execution contract for starting, inspecting,
cancelling, and streaming runs. The additive `RuntimeControlPlane` is separate:
it can expose focused clients for sessions, models, usage, tasks, workspaces, and
read-only authentication status, plus normalized events and declared transport
capabilities. A provider must omit a module it does not implement; consumers
should rely on stable declarations and never infer support from provider identity.

The package ships the contracts, capability matrix, conformance inspection, and
an OpenClaw canonical adapter. OpenClaw registers all seven canonical modules;
other providers retain the complete shape with typed unavailable operations. Hosted Codex/OpenAI
Responses remains distinct from the future `codex-app-server` JSON-RPC adapter.
Authentication status is observational only and cannot contain secrets such as
tokens, API keys, passwords, cookies, or authorization headers.

This foundation is additive. Existing `RuntimeClient` and `GatewayClient`
consumers do not need to change, and the optional `RuntimeControlPlane` contract
remains supported. For consumers that need one predictable control-plane shape,
`RuntimeControlClient` requires all seven modules: `authStatus`,
`sessions`, `models`, `usage`, `tasks`, `workspace`, and `events`, plus an
idempotent `dispose()`. `createUnavailableRuntimeControlClient(providerId,
capabilities)` supplies that complete shape when no adapter is available; every
module method rejects with a fresh `CapabilityUnavailable` containing the
provider ID and method-specific capability. Adopt `createControlPlane` only
after a provider truthfully declares the optional modules it returns. See the
compile-checked [custom runtime provider example](docs/examples/custom-runtime-provider.ts).

The `RuntimeControlClient` vocabulary is a direct rename of the unreleased
facade and factory surface, not a compatibility removal. No aliases for the
unreleased names are retained; the older released `RuntimeControlPlane`
declaration API is unchanged.

`createRuntimeControlClient(provider, options)` is the provider-neutral canonical
entry point. The package root resolves kinds and aliases through a fresh
registry composed from the shipped Hermes and OpenClaw provider modules, while
an explicit `options.registry` replaces that default. The core/providers
subpath remains registry-driven and provider-agnostic. A resolved module's
`createRuntimeControlClient` factory is called when present; otherwise the
complete unavailable facade is returned.
Options are provider-neutral: `baseUrl`, `webSocketUrl`, `token`, `resolveAuth`,
`signal`, `trace`, `transport`, and `registry`. Registry membership alone does
not advertise an adapter: only OpenClaw currently registers the canonical hook;
other shipped providers produce the unavailable facade. A structurally
compatible deterministic transport fixture can be passed through `transport`;
OpenClaw consumes it internally without adding a provider-specific package-root
option.

```ts
import { createRuntimeControlClient } from "@cavi-ai/api-client";

const controlPlane = await createRuntimeControlClient(config.provider, {
  baseUrl: config.baseUrl,
  webSocketUrl: config.webSocketUrl,
  resolveAuth: () => authStore.resolve(config.provider),
});

const sessions = await controlPlane.sessions.listSessions({ limit: 50 });
```

The package contract is canonical for its consumers; upstream wire APIs remain
provider-owned and mirrored. OpenClaw native event cursor resume is unsupported:
supplying a cursor rejects with `CapabilityUnavailable("openclaw",
"controlPlane.events.cursor")`. On reconnect, the adapter emits
`stream.reconnected` followed by `stream.gap` when continuity cannot be proven;
it does not claim replay. The factory disposes a WebSocket client it creates,
while an injected transport remains caller-owned. Factory-owned connections
resolve `resolveAuth` before opening the socket; a resolver-provided bearer
authorization overrides the static token case-insensitively, with duplicate
semantic headers collapsed deterministically. OpenClaw workspace results require
an explicit upstream workspace descriptor, and currency-less upstream cost is
reported as canonically unavailable. Malformed control-plane payloads and
unsafe native events fail with sanitized, non-retryable protocol errors. Native
event names are bounded and secret-safe before mapping or metadata; safe unknown
names remain available as `operation.updated` provider data.

The public `runRuntimeControlClientConformance({ providerId, create })` helper from
`@cavi-ai/api-client/testing` verifies the exact required methods, exercises
representative operations, accepts canonical results or typed unavailable
rejections, and always disposes the facade. The harness `providerId` is the exact
provider every unavailable error must identify; each error must also name the
operation's exact canonical capability. Its report separates `supported`,
`unavailable`, and `failures`; empty module objects fail conformance.

### One Client Shape

Every provider implements the universal **`RuntimeClient`** contract — capability
profile, runs (`startRun`/optional `getRun`/`cancelRun`), optional `streamRun`,
and an optional batch surface (`submitBatch`/`getBatch`/`cancelBatch`/`getBatchResults`,
gated by `supports.batch`). **`GatewayClient`** *extends* `RuntimeClient` for gateway-style
backends, adding teams, kanban, workspace, and operator surfaces. `GatewayApiClient`
implements both tiers; a non-gateway provider (e.g. Claude, Codex, Gemini) implements
`RuntimeClient` only and declares its capability profile so unsupported surfaces
fail with a typed `EndpointNotFound` rather than a hard crash.

```ts
import {
  GatewayApiClient,
  createGatewayApiClient,
  createGatewayProviderRegistry,
} from "@cavi-ai/api-client";
import type { GatewayProviderModule } from "@cavi-ai/api-client/core/gateway";

const provider: GatewayProviderModule = {
  kind: "acme",
  aliases: ["acme-gateway"],
  createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
};

const registry = createGatewayProviderRegistry({ modules: [provider] });
const client = createGatewayApiClient(config.gateway, {
  provider: "acme-gateway",
  registry,
});
```

Provider modules should reuse core transports. They should not fork JSON request
handling, RPC flow, SSE parsing, trace redaction, or error normalization.

### Providers

Built-in providers register through the same registry; `createRuntimeProviderRegistry`
accepts runtime-only modules (no gateway factories required):

```ts
import { createRuntimeProviderRegistry } from "@cavi-ai/api-client";
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes";
import { OPENCLAW_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/openclaw";
import { createClaudeProviderModule } from "@cavi-ai/api-client/providers/claude";
import { createCodexProviderModule } from "@cavi-ai/api-client/providers/codex";
import { createGeminiProviderModule } from "@cavi-ai/api-client/providers/gemini";

const registry = createRuntimeProviderRegistry({
  modules: [
    HERMES_PROVIDER_MODULE,
    OPENCLAW_PROVIDER_MODULE,
    createClaudeProviderModule({ apiKey: process.env.ANTHROPIC_API_KEY! }),
    createCodexProviderModule({ apiKey: process.env.OPENAI_API_KEY! }),
    createGeminiProviderModule({ apiKey: process.env.GEMINI_API_KEY! }),
  ],
});

registry.resolveProvider("claude-sdk"); // -> the Claude module
registry.resolveProvider("codex"); // -> the Codex Responses module
registry.resolveProvider("google-gemini"); // -> the Gemini module (aliases: google, gemini)
```

The **Claude (Anthropic) provider** is runtime-only — it maps `startRun` to
`POST /v1/messages` and streams the Messages SSE into the canonical
`RunStreamEvent`:

```ts
import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude";

const claude = new ClaudeApiClient({ apiKey: process.env.ANTHROPIC_API_KEY! });

const run = await claude.startRun({
  input: "Summarize the workspace state.",
  model: "claude-opus-4-8",
  instructions: "Be concise.",
});

await claude.streamRun(
  { input: "Stream a haiku.", model: "claude-opus-4-8" },
  {
    onEvent: (event) => appendRunEvent(event), // canonical RunStreamEvent
    onComplete: () => markRunComplete(),
  },
);
```

For Claude's **stateful, server-run** mode — persisted agents, containerized
sessions, and SSE steering — see [🤖 Claude Managed Agents (Beta)](#-claude-managed-agents-beta)
above; it ships from the same `@cavi-ai/api-client/providers/claude` subpath.

The **Codex provider** is also runtime-only. It uses the OpenAI Responses API
with `gpt-5-codex` by default, starts background responses so UIs can poll or
cancel by response id, and streams Responses SSE into canonical
`RunStreamEvent`s:

```ts
import { CodexApiClient } from "@cavi-ai/api-client/providers/codex";

const codex = new CodexApiClient({ apiKey: process.env.OPENAI_API_KEY! });

const run = await codex.startRun({
  input: "Review this component plan for risks.",
  instructions: "Return concise engineering guidance.",
});

await codex.streamRun(
  { input: "Draft the implementation checklist." },
  { onEvent: (event) => appendRunEvent(event) },
);
```

A public `CodexFilesClient` (from `@cavi-ai/api-client/providers/codex`) is also
available for the OpenAI Files API (upload / download content / retrieve /
delete); it is used internally by Codex batch.

Keep OpenAI API keys backend-owned. Browser and mobile apps should call your
backend, which can instantiate `CodexApiClient`; they should not embed raw
OpenAI credentials.

The **Gemini provider** is runtime-only. It maps `startRun` to the Gemini
Developer API `:generateContent` (the model goes in the URL path) and streams
`:streamGenerateContent` into canonical `RunStreamEvent`s. It also implements
`supports.batch` over `:batchGenerateContent` (inline under ~18MB, otherwise
JSONL via `GeminiFilesClient`). Pass a model on each run or set `defaultModel`
in the client constructor (no default model ships in the package). All requests
in a batch must share the same model. Authenticates with `x-goog-api-key`.
`getRun`/`cancelRun` throw `EndpointNotFound` because generateContent is
synchronous request/response.

```ts
import { GeminiApiClient } from "@cavi-ai/api-client/providers/gemini";

const gemini = new GeminiApiClient({ apiKey: process.env.GEMINI_API_KEY! });

const run = await gemini.startRun({
  input: "Summarize the workspace state.",
  model: "gemini-2.5-flash",
});

await gemini.streamRun(
  { input: "Stream a haiku.", model: "gemini-2.5-flash" },
  { onEvent: (event) => console.log(event) },
);

const batch = await gemini.submitBatch([
  { customId: "a", body: { input: "Summarize doc A.", model: "gemini-2.5-flash" } },
  { customId: "b", body: { input: "Summarize doc B.", model: "gemini-2.5-flash" } },
]);
```

A public `GeminiFilesClient` (from `@cavi-ai/api-client/providers/gemini`) is
also available for the Gemini Files API (resumable upload / download / retrieve /
delete); batch file mode uses it internally for large submissions.

Keep Gemini API keys backend-owned; browser and mobile apps should call your
backend rather than embedding the key.

Writing your own provider? Point the shared **conformance kit**
(`src/__tests__/support/runtime-conformance.ts`) at your client and it must pass
the same contract every built-in provider does.

### Credential Schemes

A provider declares its auth scheme through `auth.resolveHeaders` instead of the
core hardcoding a bearer token. Ready-made resolvers cover the common cases:

```ts
import { bearerCredentials, apiKeyCredentials } from "@cavi-ai/api-client";

// Gateway bearer token (the default if you pass auth.bearerToken)
const gatewayAuth = { resolveHeaders: bearerCredentials(process.env.GATEWAY_API_AUTH_TOKEN) };

// Anthropic api-key + version header
const anthropicAuth = {
  resolveHeaders: apiKeyCredentials(process.env.ANTHROPIC_API_KEY!, {
    header: "x-api-key",
    extra: { "anthropic-version": "2023-06-01" },
  }),
};
```

A provider can also report a protocol version; `assertProtocolVersion(caps, expected)`
turns a backend version mismatch into a typed `ProtocolMismatch` error instead of
a confusing downstream failure.

### Typed Errors

Every failure is one of the package's typed classes — `HttpApiError` (non-2xx,
network failure, abort, invalid JSON), `GatewayHttpError` (gateway HTTP detail),
`GatewayRpcError` (WebSocket RPC rejection), or `ApiClientError` (synthesized
config/validation/transport). Branch on a guard, never on `error.message`, and
never re-wrap a failure in a generic `Error`.

```ts
import {
  getErrorStatus,
  isAbortError,
  isAuthError,
  isEndpointNotFoundError,
  isHttpApiError,
} from "@cavi-ai/api-client";

try {
  await cavi.getOperatorSnapshot();
} catch (error) {
  if (isAbortError(error)) return;          // request was cancelled
  if (isAuthError(error)) return signOut(); // 401/403 across HTTP error classes
  if (isEndpointNotFoundError(error)) return markUnsupported();
  if (getErrorStatus(error) === 404) return markUnavailable();
  if (isHttpApiError(error)) {
    reportError({ status: error.status, path: error.path, body: error.body });
  }
  throw error; // unknown shape: never swallow it
}
```

`isAuthError` covers both `HttpApiError` and `GatewayHttpError`; `getErrorStatus`
returns the numeric HTTP status or `undefined`. `isEndpointNotFoundError` flags a
synthesized `EndpointNotFound` failure — the everyday cross-provider branch for a
surface a provider declares unsupported (Gemini `getRun`/`cancelRun`, OpenClaw
wiki/media). Lower-level helpers (`getErrorMessage`, `serializeError`, `toError`,
and the `ApiClientErrorType` / `ApiClientErrorCode` enums) remain available from
`core/errors`.

> **Antipattern:**
>
> ```ts
> // ❌ Message matching breaks on rewording/localization and swallows real failures.
> catch (e: any) {
>   if (e.message.includes("401")) signOut();
>   else console.log("request failed");
> }
> // ❌ Re-wrapping erases status, path, body, and the cause chain.
> throw new Error("snapshot failed");
> ```

### Usage & Cost

Every provider populates a provider-agnostic `tokens` field on the run status, so
you read token usage the same way regardless of backend:

```ts
const run = await client.startRun({ input: "Summarize.", model: "claude-opus-4-8" });
run.tokens?.inputTokens;   // normalized across Claude / Codex / Gemini / gateways
run.tokens?.outputTokens;
run.tokens?.cacheReadTokens;
run.tokens?.raw;           // lossless provider-native counts
```

The streamed `run.completed` event carries the same `usage: RuntimeUsage` when the
provider reports it. The legacy `run.usage` (raw provider keys) is **deprecated** but
still populated.

Cost is **pluggable** — the package ships no price table. Supply your own
per-million-token prices:

```ts
import { estimateUsageCost } from "@cavi-ai/api-client";

const usd = estimateUsageCost(run.tokens ?? {}, {
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheReadPerMTok: 0.3,
});
```

### Graceful Degradation

Gateway loaders can return a typed `DataEnvelope<T>`:

```ts
type DataEnvelope<T> = {
  data: T;
  source: "gateway" | "mock";
  fetchedAt: number;
  contractGaps: ContractGap[];
};
```

`withFallback` and `withMutationResult` keep expected backend gaps visible
without crashing an entire dashboard. Auth failures and unknown errors still
throw.

### Route Mirrors

OpenClaw, Caviclaw plugins, and gateway hosts own their runtime API routes.
This package only mirrors those routes so client code has one import path and
does not drift into hand-built strings. Mirrored route literals belong in:

- Global contracts: `src/contracts/paths.ts` and `src/contracts/surfaces.ts`.
- CAVI extension contracts:
  `src/extensions/cavi/contracts/paths.ts` and
  `src/extensions/cavi/contracts/surfaces.ts`.
- OpenClaw provider mirrors:
  `src/providers/openclaw/manifest.ts` and
  `src/providers/openclaw/workboard.ts`.

Consumers should use exported constants and resolvers such as `resolvePath` and
`appendHttpQuery` (root), and `resolveCaviPath` plus the CAVI contract helpers
(`@cavi-ai/api-client/extensions/cavi`). Avoid assembling paths by hand in
clients, components, or adapters. New or changed paths must come from the
upstream gateway/plugin contract first.

### Team Manifest

The team manifest is an **interface, not data the package owns**. The package
ships the manifest *shape* (types + normalization + lookup validation), a
`TeamRouteResolver`, and a `TeamManifestSource` "bring-your-own-manifest" seam —
the host supplies the actual team/member/workspace/action data at runtime. CAVI
identity specifics live in `identity.metadata`, keeping the contract agnostic.

```ts
import {
  createStaticManifestSource,
  createTeamRouteResolver,
  normalizeTeamManifest,
  resolveTeamWorkspaceApiPath,
  type TeamManifest,
} from "@cavi-ai/api-client";

const source = createStaticManifestSource({
  version: 1,
  teams: [
    {
      id: "research",
      identity: { displayName: "Research", slug: "research", code: "RND" },
      workspace: {
        rootPath: "/teams/research/workspace",
        paths: ["reports", { key: "media.images", path: "media/images" }],
      },
      members: [{ id: "analyst", capabilities: ["research.read"] }],
    },
  ],
} satisfies TeamManifest);

const manifest = await source.getManifest();
const resolver = createTeamRouteResolver();
const path = resolver.resolveWorkspaceApiPath(manifest, "research", "media.images", {
  memberId: "analyst",
});
```

> The CAVI team registry (which overlays operator-dispatch data on top of the
> generic manifest) lives in `@cavi-ai/api-client/extensions/cavi` —
> `createTeamRegistry`, `configureTeamRegistryConfig`, `TEAM_REGISTRY_CONFIG`.

See [docs/team-manifest.md](docs/team-manifest.md) and
[docs/team-manifest.consumer.template.ts](docs/team-manifest.consumer.template.ts)
for consumer-owned manifest examples.

## Common Surfaces

### HTTP

```ts
import {
  CaviControlApiClient,
  resolveHttpApiConfigFromEnv,
} from "@cavi-ai/api-client/extensions/cavi";

const config = resolveHttpApiConfigFromEnv(process.env);
const cavi = new CaviControlApiClient({
  baseUrl: config.cavi.baseUrl,
  auth: {
    bearerToken: config.cavi.authToken,
    clientId: config.cavi.clientId,
  },
});
```

Canonical environment keys:

- `CAVI_API_BASE_URL`, `CAVI_API_AUTH_TOKEN`, `CAVI_API_CLIENT_ID`
- `GATEWAY_API_BASE_URL`, `GATEWAY_API_AUTH_TOKEN`, `GATEWAY_API_CLIENT_ID`
- `LIBRARY_API_BASE_URL`, `LIBRARY_API_AUTH_TOKEN`, `LIBRARY_API_CLIENT_ID`

Alias keys for common web and mobile app runtimes are supported by default.
Pass `{ includeAliases: false }` to disable aliases.

### WebSocket RPC

```ts
import { createGatewayWebSocketClient } from "@cavi-ai/api-client";

const ws = createGatewayWebSocketClient(target.wsUrl, authToken, {
  clientId: "dashboard",
  requestedScopes: ["operator.read"],
});

await ws.connect();
const sessions = await ws.request<{ sessions: unknown[] }>("sessions.list", {
  limit: 20,
});
```

### Run Event Streams

```ts
import { createGatewaySseRunEventProvider } from "@cavi-ai/api-client";

const stream = createGatewaySseRunEventProvider({
  httpBase: config.gateway.baseUrl,
  authToken: config.gateway.authToken,
  clientId: config.gateway.clientId,
  sessionKey: "dashboard",
});

// Keep the subscription handle so you can `subscription.dispose()` on unmount.
const subscription = await stream.subscribe(
  { runId: "run-123" },
  {
    onEvent: (event) => appendRunEvent(event),
    onError: (error) => reportError(error),
    onComplete: () => markRunComplete(),
  },
);
```

### Media And Wiki

```ts
import {
  createGatewayMediaClient,
  createGatewayWikiClient,
} from "@cavi-ai/api-client";

const media = createGatewayMediaClient({ baseUrl, auth });
const image = await media.generateImage({
  input: "diagram of a workflow",
  format: "png",
});

const wiki = createGatewayWikiClient({ baseUrl, auth });
const page = await wiki.readWikiPage("default", "index.qmd");
```

### React

```tsx
import {
  GatewayClientProvider,
  useGatewayClientContext,
} from "@cavi-ai/api-client/frameworks/react";

function App() {
  return (
    <GatewayClientProvider
      gatewayBaseUrl={gatewayBaseUrl}
      authToken={authToken}
      clientId="portal"
      autoReconnect
    >
      <Panel />
    </GatewayClientProvider>
  );
}

function Panel() {
  const { client, state, connect } = useGatewayClientContext();
  return <button onClick={() => void connect()}>{state}</button>;
}
```

### Batch

Providers that declare `supports.batch` accept a set of runs, process them
asynchronously, and return results correlated by `customId`. Backed by Claude
(Anthropic Message Batches), Codex/OpenAI (the OpenAI Batch API's file-based
upload → poll → download flow), and Gemini (`batchGenerateContent` with inline
or file input).

```ts
import { ClaudeApiClient } from "@cavi-ai/api-client/providers/claude";

const claude = new ClaudeApiClient({ apiKey: process.env.ANTHROPIC_API_KEY! });

const batch = await claude.submitBatch([
  { customId: "a", body: { input: "Summarize doc A.", model: "claude-opus-4-8" } },
  { customId: "b", body: { input: "Summarize doc B.", model: "claude-opus-4-8" } },
]);

const status = await claude.getBatch(batch.batch_id);
if (status.resultsAvailable) {
  const results = await claude.getBatchResults(batch.batch_id);
  // results: { customId, outcome, run?: RuntimeRunStatus (incl. tokens), error? }[]
}
// await claude.cancelBatch(batch.batch_id) to cancel in-flight.
```

`getBatchResults` throws until the batch has ended — poll `getBatch` and check
`resultsAvailable`. Codex/OpenAI and Gemini result downloads are parsed strictly
and throw `invalid_json` if the returned JSONL is malformed; the exported
`parseOpenAIBatchOutput` helper keeps its compatible default of skipping
malformed lines unless `{ malformedLine: "throw" }` is passed.

### CAVI Extension Adapters

`extensions/cavi` contains product-shaped composition over the generic core.
The extension mirrors CAVI-specific DTOs, adapters, fallback providers, and
plugin route contracts while still using shared transports and error handling.

```ts
import { createCaviControlAdapters } from "@cavi-ai/api-client/extensions/cavi";

const adapters = createCaviControlAdapters({
  gatewayBaseUrl,
  apiBaseUrl,
  authToken,
  client: gatewayRpcClient,
  fallbackMode: "empty",
});

const overview = await adapters.loadOverview();
```

Hermes dashboard and optional CAVI plugin control surfaces can be composed from
the same extension without adding provider-specific fields to the core factory:

```ts
import { createHermesRuntimeControlClient } from "@cavi-ai/api-client/extensions/cavi";

const control = await createHermesRuntimeControlClient({
  dashboardBaseUrl,
  dashboardWebSocketUrl,
  dashboardToken,
  cavi: { gatewayBaseUrl, authToken },
});

await control.dispose();
```

All seven canonical modules are always present. Dashboard REST config enables
auth status, models, and usage; a dashboard channel enables sessions and events;
and explicit CAVI plugin config enables tasks and workspace. Other operations
reject with method-specific `CapabilityUnavailable` errors. Injected channels
are borrowed unless `ownsChannel: true` is set.

## Secure Credential Handling

The client never persists credentials — applications pass `auth.bearerToken` and
own storage. On devices that means the OS keychain/keystore or an encrypted
store, **never** plaintext `AsyncStorage` or `localStorage`. Keep the client
storage-agnostic behind one interface:

```ts
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
```

`expo-secure-store` (Keychain / Keystore) and `react-native-mmkv` (encrypted
instance) are drop-in backends:

```ts
import * as SecureStore from "expo-secure-store";
import { MMKV } from "react-native-mmkv";

const KEY = "cavi.gateway.bearer";

export const secureStoreTokens: TokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) =>
    SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

const storage = new MMKV({ id: "cavi-auth", encryptionKey: deviceEncryptionKey });
export const mmkvTokens: TokenStore = {
  get: async () => storage.getString(KEY) ?? null,
  set: async (token) => storage.set(KEY, token),
  clear: async () => storage.delete(KEY),
};
```

Build the client from the stored token and refresh only on a typed auth
failure — `isAuthError` covers `HttpApiError` and `GatewayHttpError`, so you
never re-check `.status` by hand:

```ts
import { isAuthError } from "@cavi-ai/api-client";
import { CaviControlApiClient } from "@cavi-ai/api-client/extensions/cavi";

async function withFreshAuth<T>(
  tokens: TokenStore,
  call: (client: CaviControlApiClient) => Promise<T>,
): Promise<T> {
  const build = async () =>
    new CaviControlApiClient({
      baseUrl: config.cavi.baseUrl,
      auth: { bearerToken: (await tokens.get()) ?? undefined, clientId: "cavi-mobile" },
    });
  try {
    return await call(await build());
  } catch (error) {
    if (!isAuthError(error)) throw error; // only refresh on 401/403
    await tokens.set(await refreshAccessToken());
    return call(await build());
  }
}
```

Avoid logging raw request headers, auth tokens, or full error bodies; trace
helpers redact sensitive values before emitting previews.

> **Antipattern:**
>
> ```ts
> // ❌ Plaintext token on disk — readable by backups, other apps, rooted devices.
> await AsyncStorage.setItem("token", token);
> localStorage.setItem("token", token);
> ```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the layer map, provider boundary,
route mirror rules, and extension/plugin split.

## Development

### Versioned API Documentation

The immutable documentation artifact for this release is
[`docs/api-client/v0.11.0`](docs/api-client/v0.11.0). Its
[`manifest.json`](docs/api-client/v0.11.0/manifest.json) and
[`navigation.json`](docs/api-client/v0.11.0/navigation.json) are the consumer
entry points. Run the stable artifact drift gate before handing documentation
to a host:

```sh
pnpm docs:check
```

Hosts copying the artifact under `/docs/api-client/v0.11.0` must follow the
[`CONSUMER.md`](docs/api-client/CONSUMER.md) version and integrity contract.

```sh
pnpm install
pnpm test
pnpm run build
pnpm run lint:md
pnpm run verify
```

Strict TypeScript is the lint gate. Relative source imports use `.js`
extensions. Tests live under `src/__tests__/**`.

The hardening tests in
[`src/__tests__/package-hardening.test.ts`](src/__tests__/package-hardening.test.ts)
enforce package boundaries, path ownership, forbidden imports, and output shape.
Update them only when the package boundary intentionally changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, provider-author guidance,
and boundary rules.

## Code of Conduct

Participation in this project is covered by
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
