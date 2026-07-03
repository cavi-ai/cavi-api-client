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

Consumers build one client and choose a provider through a registry.
`createGatewayProviderRegistry` holds gateway providers; the generic
`createRuntimeProviderRegistry` also accepts runtime-only modules. Built-in
modules live under `src/providers/{hermes,openclaw,claude,codex,gemini}`; host applications can
supply their own `RuntimeProviderModule` / `GatewayProviderModule`. A provider
authenticates through an `auth.resolveHeaders` credential scheme (bearer, cookie,
or api-key) instead of the core hardcoding a token.

OpenClaw/Hermes-specific behavior belongs in the matching provider module; Claude
(Anthropic) is runtime-only and maps `startRun` to the Messages API. Claude also
implements the batch surface (`supports.batch`) over Anthropic Message Batches
(`/v1/messages/batches`), with results mapped to `RuntimeRunStatus` by `customId`.
Codex also implements the batch surface (`supports.batch`) over the OpenAI Batch API
(JSONL upload → batch creation → poll → download), with results mapped to
`RuntimeRunStatus` by `customId`.
Claude also carries a `managed-agents/` subtree (beta `managed-agents-2026-04-01`):
`ClaudeManagedAgentClient` is a second, stateful `RuntimeClient` over Anthropic's
server-run agents (sessions, agents, environments) with SSE steering, outcomes,
threads, memory, vaults, webhook verification, and a `TeamManifest`→teams
mapper. It is additive and re-exported from the same `providers/claude` entry, so
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
