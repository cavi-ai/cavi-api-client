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
  changing the provider interface.
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

Provider declarations are stable-first and truthful: an absent or experimental
module is unsupported, and a factory may return only modules it declares. The
initial built-in provider declarations are empty because this release ships the
contract foundation and conformance machinery, not provider adapters. The frozen
root capability matrix remains supported and records that absence explicitly.

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
