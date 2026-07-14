# Architecture

`@cavi-ai/api-client` is one provider-agnostic TypeScript client package. Every
provider implements a universal `RuntimeClient` contract; gateway-style providers
extend it with `GatewayClient`. The public API stays unified even when a provider,
product extension, or UI framework needs custom behavior behind the boundary.

## Layers

```text
src/index.ts
  -> core/
  -> contracts/
  -> providers/hermes | providers/openclaw | providers/claude | providers/codex | providers/gemini
  -> extensions/cavi
  -> frameworks/react
```

- `core/` owns shared HTTP, WebSocket, JSON-RPC, SSE, data-envelope, error, and
  gateway-client primitives, plus the universal `RuntimeClient` contract and the
  canonical run-stream contract in `core/runtime/`. It must not import provider,
  extension, or framework modules.
- `contracts/` owns provider-agnostic path tables, surface maps, path resolvers,
  and the team manifest *interface* — its types, normalization, a
  `TeamRouteResolver`, and a `TeamManifestSource` seam (host-supplied data).
- `providers/*` adapt a concrete backend to the shared client interfaces. Gateway
  providers (Hermes, OpenClaw) implement `GatewayClient`; runtime-only providers
  (Claude / Anthropic, Codex / OpenAI Responses, Gemini / Google) implement
  `RuntimeClient`. They may customize endpoint maps, headers, auth scheme, default
  surfaces, and transport method mapping, but they reuse the core transports and
  error handling.
- `extensions/cavi/` owns CAVI-specific product adapters, plugin contracts,
  fallback snapshots, and DTO shaping. It composes the generic core instead of
  changing the provider interface. The complete, compiler-checked ownership
  inventory and the four released provider forwarding exceptions are recorded
  in [CAVI Extension Ownership](docs/extension-ownership.md).
  Its runtime-control registry enhancer clones an application registry and
  installs only the resolved Hermes CAVI factory; it does not mutate the base
  registry, root capability matrix, provider-neutral factory, or other modules.
  Canonical normalized-kind cardinality and semantic kind/alias resolution are
  validated before composition, so missing, ambiguous, and alias-shadowed
  registries fail closed. Mutable extension configuration is snapshotted per
  registry while opaque runtime resources retain caller-owned identity.
- `frameworks/react/` contains optional React bindings. React is an optional peer
  dependency and is never imported by the root entry.

## Provider Model

The contract is tiered. **`RuntimeClient`** is the universal surface every
provider implements — `getRuntimeCapabilities`, `startRun`, optional
`getRun`/`cancelRun`, optional `streamRun`, and an optional batch surface
(`submitBatch`/`getBatch`/`cancelBatch`/`getBatchResults`). **`GatewayClient`** extends it for
gateway backends, adding teams, kanban, workspace, and operator surfaces. Each
provider declares a capability profile; calling an unsupported surface returns a
typed `EndpointNotFound` rather than crashing.

Consumers build one client and choose a provider through a runtime-owned registry.
`createGatewayProviderRegistry` holds gateway providers; the generic
`createRuntimeProviderRegistry` also accepts runtime-only modules. Built-in
modules live under `src/providers/{hermes,openclaw,claude,codex,gemini}`; host applications can
supply their own `RuntimeProviderModule` / `GatewayProviderModule`. A provider
authenticates through an `auth.resolveHeaders` credential scheme (bearer, cookie,
or api-key) instead of the core hardcoding a token.

The provider-neutral module, registry, and `createRuntimeClient` factory live in
`core/runtime/providers`; gateway provider APIs extend and compatibility-export
that kernel. Narrow runtime provider entries exclude CAVI product adapters.
Historical Hermes/OpenClaw team-registry exports remain deprecated forwarding
aliases, while their implementations are owned by `extensions/cavi/providers`.
The public `testing` entry exposes runner-neutral conformance reports for
third-party provider authors.

OpenClaw/Hermes-specific behavior belongs in the matching provider module; Claude
(Anthropic) is runtime-only and maps `startRun` to the Messages API. Claude also
implements the batch surface (`supports.batch`) over Anthropic Message Batches
(`/v1/messages/batches`), with results mapped to `RuntimeRunStatus` by `customId`.
Codex also implements the batch surface (`supports.batch`) over the OpenAI Batch API
(JSONL upload → batch creation → poll → download), with results mapped to
`RuntimeRunStatus` by `customId`; downloaded result JSONL is parsed strictly so
malformed provider files fail with `invalid_json` instead of silently dropping rows.
Gemini also implements the batch surface (`supports.batch`) over the Gemini
`batchGenerateContent` API (inline requests under ~18MB, otherwise JSONL file
upload via `GeminiFilesClient`), with the same canonical batch methods and strict
result JSONL parsing.
Claude also carries a `managed-agents/` subtree (beta `managed-agents-2026-04-01`):
`ClaudeManagedAgentClient` is a second, stateful `RuntimeClient` over Anthropic's
server-run agents (full agent/environment/session lifecycle) with SSE steering,
outcomes, threads, memory, vaults, session resources, scheduled deployments,
webhook verification, and a `TeamManifest`→teams mapper. It is additive and re-exported from the same `providers/claude` entry, so
the stateless Messages-API client is unchanged. Codex (`providers/codex`, OpenAI
Responses, default `gpt-5-codex`) and Gemini (`providers/gemini`, the Gemini
Developer API — model in the URL path, `x-goog-api-key`, explicit model
required) are additional runtime-only providers; each ships a `RuntimeClient` +
provider module and passes the shared conformance kit. CAVI Control
and plugin/operator behavior belongs in `extensions/cavi`. Keeping these planes
separate lets each provider track its own API without turning the core package
into a single-provider client. The shared conformance kit
(`src/__tests__/support/runtime-conformance.ts`) is the executable contract every
provider must pass.

## Execution and Control-Plane Separation

The execution plane remains `RuntimeClient`: runs, run status, cancellation,
streaming, and optional batch processing. `RuntimeControlPlane` is an additive,
optional plane for provider discovery and administration. It groups six focused
clients—sessions, models, usage, tasks, workspace, and read-only authentication
status—alongside normalized control-plane events and independently declared
transport capabilities.

`RuntimeControlClient` is an additive, required-shape facade over those
seven modules: authentication status, sessions, models, usage, tasks, workspace,
and events. It also owns an idempotent `dispose()` lifecycle method. When an
adapter is unavailable, `createUnavailableRuntimeControlClient` preserves the
shape while rejecting every module operation with a fresh
`CapabilityUnavailable` that identifies the provider and capability; disposal
remains side-effect free. The existing optional `RuntimeControlPlane` is
preserved for declaration-driven providers.

This vocabulary is a pre-release direct rename of the unreleased facade and
factory architecture, not a compatibility removal. The unreleased names have no
aliases; the older released `RuntimeControlPlane` declaration architecture stays
intact.

The provider registry is also the boundary for canonical construction. Core
remains registry-driven and never imports provider implementations. The
package-root `createRuntimeControlClient(provider, options)` supplies a fresh
registry composed at the provider layer from the shipped Hermes and OpenClaw
modules unless the caller supplies `options.registry`. It uses the registry's
existing kind/alias normalization and delegates to an optional provider
`createRuntimeControlClient` hook, and falls back to the required unavailable
facade. Its configuration remains provider-neutral (`baseUrl`, `webSocketUrl`,
`token`, `resolveAuth`, `signal`, `trace`, `transport`, and `registry`), so adding
the facade does not couple core to a provider. OpenClaw registers that hook at
the provider layer; providers without one fall back truthfully to the typed
unavailable facade.

The OpenClaw boundary resolves fresh auth before a factory-owned WebSocket is
opened and validates all native payloads before mapping. Wire parser failures
are converted at each operation boundary into sanitized, non-retryable protocol
errors. Workspace identity is derived only from explicit upstream workspace
strings, and upstream cost without a validated currency is not promoted to
canonical available cost.

The provider-neutral `transport` option is also the deterministic test seam.
The OpenClaw provider recognizes a structurally compatible request/subscription
transport internally, so tests exercise the real package registry and factory
path without placing an OpenClaw-specific contract in the root API. The public
canonical conformance runner checks every required method, exercises supported
and unavailable behavior, and owns facade disposal with `try`/`finally`. Its
harness declares the expected provider ID, and unavailable results conform only
when both that ID and the operation-specific canonical capability match exactly.

Provider declarations are stable-first and truthful: an absent or experimental
module is unsupported, and a factory may return only modules it declares. The
OpenClaw declaration lists all seven modules and its stable authenticated
WebSocket transport; other declarations remain empty. The frozen root capability
matrix preserves every existing key and adds this detail additively.

OpenClaw event continuity follows the native gateway stream. Cursor resume is
unsupported: supplying any cursor rejects with
`CapabilityUnavailable("openclaw", "controlPlane.events.cursor")`. On reconnect,
the adapter emits `stream.reconnected` followed by `stream.gap` when continuity
cannot be proven; it does not claim replay.

The CAVI extension composes Hermes without changing that provider boundary.
Hermes dashboard calls use standard JSON-RPC 2.0 over a shared message-channel
contract, whereas OpenClaw uses its authenticated gateway handshake and custom
WebSocket RPC framing. Hermes session list and usage operations can fall back
from JSON-RPC to dashboard REST only for channel unavailability; detail remains
REST. Hermes events are JSON-RPC notifications. SSE is a separate core
transport and is not implied by either runtime-control adapter.

Hermes dashboard REST auth is resolved before construction when an explicit
dashboard token is absent: resolver headers outrank dashboard and generic
tokens, and the dashboard token otherwise outranks the generic token. Owned
channels are closed on disposal and reverse-order construction unwind; borrowed
channels retain caller ownership unless explicitly transferred. CAVI plugin
task and workspace modules are independently installable from the dashboard
modules. Tasks model operator task lifecycle rather than cron schedules, and
workspace output requires explicit upstream workspace identity. Uncertain cost
or cost without validated currency stays provider data instead of becoming a
canonical monetary amount.

The package contract is canonical for its consumers while upstream wire APIs
remain provider-owned and mirrored. The seven facade modules are `authStatus`,
`sessions`, `models`, `usage`, `tasks`, `workspace`, and `events`. Resources
created by the OpenClaw factory are client-owned and closed by `dispose()`;
injected transports are caller-owned and are never closed by the facade.

Authentication status is metadata, never credential transport; secret-bearing
fields such as tokens, API keys, passwords, cookies, and authorization headers
are prohibited. Hosted Codex using OpenAI Responses and the planned
`codex-app-server` JSON-RPC integration are separate provider identities and will
be designed as separate adapters. Existing execution-plane consumers require no
migration.

Node-owned stdio and Unix-domain socket byte channels live behind the dedicated
`@cavi-ai/api-client/core/transport/node` subpath. The root and universal
transport graphs do not import this entry, and its public declarations use
structural process and socket shapes rather than Node library types.

The universal `@cavi-ai/api-client/core/transport` entry owns HTTP, SSE,
WebSocket, JSON-RPC, framing, lifecycle, and secret-safe error infrastructure.
Retries are finite and opt-in; mutation replay requires explicit idempotency.
SSE resumes from a cursor with bounded event-ID dedupe, while WebSocket and Unix
reconnects are bounded and do not replay pending writes. JSON-RPC composes over
WebSocket or framed stdio/Unix channels. These primitives are not a provider
adapter and do not imply that any provider implements a corresponding surface.

## Route Ownership

API route literals are centralized:

- Global gateway contracts: `src/contracts/paths.ts` and
  `src/contracts/surfaces.ts`.
- CAVI extension contracts: `src/extensions/cavi/contracts/paths.ts` and
  `src/extensions/cavi/contracts/surfaces.ts`.

Clients, adapters, React hooks, and provider modules should import path constants
or use resolver helpers instead of assembling paths inline. The hardening tests
enforce this for both bare paths and full URLs with embedded paths.

## Data And Failure Semantics

Gateway data loaders return typed `DataEnvelope<T>` values when graceful
degradation is expected. Known backend gaps can fall back through `withFallback`
or `withMutationResult`; auth failures and unknown errors still throw typed
errors.

Transport and parsing failures should preserve the package's error classes:
`HttpApiError`, `GatewayHttpError`, `GatewayRpcError`, or `ApiClientError`.
Callers branch with guards such as `isAuthError`, `isAbortError`, and
`getErrorStatus`.

## Runtime Boundaries

Filesystem integrations must receive an explicit `repoRoot` or resolve
`REPO_ROOT` through `src/core/env/repo-root.ts`. This package must not assume a
host checkout layout, mobile repo structure, or product gateway installation.

The package ships as ESM with generated TypeScript declarations, zero runtime
dependencies, and optional framework peers.
