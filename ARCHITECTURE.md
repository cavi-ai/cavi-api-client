# Architecture

`@cavi-ai/api-client` is one gateway-agnostic TypeScript client package. The
public API should stay unified even when a provider, product extension, or UI
framework needs custom behavior behind the boundary.

## Layers

```text
src/index.ts
  -> core/
  -> contracts/
  -> providers/hermes | providers/openclaw
  -> extensions/cavi
  -> frameworks/react
```

- `core/` owns shared HTTP, WebSocket, JSON-RPC, SSE, data-envelope, runtime,
  error, and gateway-client primitives. It must not import provider,
  extension, or framework modules.
- `contracts/` owns gateway-agnostic path tables, surface maps, path resolvers,
  and the runtime-supplied team manifest schema.
- `providers/*` adapt a concrete gateway to the shared client interfaces. They
  may customize endpoint maps, headers, default surfaces, and transport method
  mapping, but they should reuse the core transports and error handling.
- `extensions/cavi/` owns CAVI-specific product adapters, plugin contracts,
  fallback snapshots, and DTO shaping. It composes the generic core instead of
  changing the provider interface.
- `frameworks/react/` contains optional React bindings. React is an optional peer
  dependency and is never imported by the root entry.

## Provider Model

Consumers create one `GatewayApiClient` shape and choose a provider through the
registry. Built-in provider modules live under `src/providers/hermes` and
`src/providers/openclaw`; host applications can provide their own
`GatewayProviderModule` implementations.

OpenClaw-specific behavior belongs in the OpenClaw provider module. CAVI Control
and plugin/operator behavior belongs in `extensions/cavi`. Keeping those two
planes separate lets OpenClaw track the current WebSocket/JSON-RPC API without
turning the core package into an OpenClaw-only client.

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
