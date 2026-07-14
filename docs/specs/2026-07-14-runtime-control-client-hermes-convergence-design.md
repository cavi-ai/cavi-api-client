# Runtime Control Client and Hermes Convergence Design

Date: 2026-07-14

Status: Approved for implementation planning

## Purpose

Converge the package on one provider-neutral runtime-control interface, add a
current-upstream Hermes implementation through the correct extension boundary,
and reduce duplication between core and `extensions/cavi` without changing
consumer UI code.

This package remains a follower and mirror of upstream runtime protocols.
OpenClaw, Hermes, Codex, Gemini, and Claude remain the owners of their native
wire behavior.

## Decisions

1. The provider-neutral interface is named `RuntimeControlClient`.
2. Its primary factory is named `createRuntimeControlClient`.
3. `CanonicalRuntimeControlPlane` and `createRuntimeControlPlane` were introduced
   after the published `0.11.0` release. They will be renamed directly before
   the next release. No deprecated aliases will be retained for these unreleased
   names.
4. Current upstream Hermes behavior is authoritative. The client adapts to it;
   it does not invent a third Hermes protocol.
5. Hermes `/v1` runtime behavior remains in the Hermes provider. CAVI plugin,
   dashboard-control, operator, project-board, portal, library, and product
   behavior remains in or is composed through `extensions/cavi`.
6. Generic code has one canonical implementation in core. Existing released
   extension exports that are promoted remain as deprecated forwarding exports
   for the rest of the current major version.
7. Consumers call the same `RuntimeControlClient` contract for every provider.
   Provider and extension composition happens once during registry setup, not in
   UI components.

## Scope

The implementation plan will cover three dependency-ordered workstreams:

1. Audit and classify all public `extensions/cavi` surfaces.
2. Promote proven provider-neutral code to core with compatibility forwarding.
3. Add Hermes native drivers and a CAVI registry enhancer that returns a complete
   `RuntimeControlClient` where upstream capabilities exist.

The work does not change package version, publish the package, modify upstream
Hermes, or broaden CAVI product contracts.

## Architecture

### Core

Core owns:

- `RuntimeControlClient` and its focused module contracts;
- provider-neutral normalization and capability errors;
- shared HTTP, SSE, WebSocket, and JSON-RPC transport primitives;
- generic registry mechanics;
- generic team and session identity helpers;
- provider-neutral snapshot orchestration;
- lifecycle, cancellation, ownership, redaction, and conformance behavior.

Core must not import `extensions/cavi` or a concrete provider.

### Providers

Provider modules own native upstream runtime protocols and provider-specific
translation:

- Hermes `/v1` models, capabilities, responses, runs, cancellation, and run SSE;
- OpenClaw gateway RPC;
- Codex Responses and future app-server transport;
- Gemini and Claude runtime APIs.

Provider modules may depend on core but must not depend on `extensions/cavi`.

### CAVI extension

`extensions/cavi` owns:

- CAVI operator registry semantics;
- CAVI team configuration and identities;
- portals and portal memory;
- fleet library and clip contracts;
- project-board product models and mutations;
- task discourse;
- CAVI scoring and product fallbacks;
- `/cavi-control` and `/api/plugins/cavi-control` contracts and aliases;
- extension composition for plugin-gated Hermes and OpenClaw features.

Extensions may compose core and provider modules.

## Extension Classification Rules

Each public extension symbol receives one classification:

- **Keep:** requires CAVI identity, routes, data, configuration, or product
  semantics.
- **Promote:** works unchanged without CAVI-specific assumptions and has at least
  two provider or non-CAVI consumers.
- **Forward:** a released public extension symbol whose implementation moved to
  core; it remains a deprecated re-export of the core implementation.
- **Retire later:** obsolete behavior that cannot be removed in the current major
  version; document it without expanding it.

Promotion never copies an implementation. Core becomes the only implementation,
and extension exports forward to it.

### Initial promote candidates

- generic team-registry mechanics;
- generic session-key parsing and comparison;
- generic runtime/base-URL helpers already duplicated by core runtime paths;
- provider-neutral snapshot and session orchestration;
- adapters from existing shared snapshots into focused runtime-control modules;
- registry enhancement mechanics that do not encode CAVI products.

### Initial keep candidates

- CAVI operator, project-board, discourse, library, portal, and observability
  domain models;
- CAVI route maps, plugin aliases, and expected-contract diagnostics;
- CAVI team configuration, portal identities, and product fallbacks;
- CAVI-specific mutations and media/library workflows.

The implementation plan must produce an exact symbol-by-symbol classification
before moving files.

## Public API

The primary interface is:

```ts
interface RuntimeControlClient {
  readonly authStatus: AuthStatusClient;
  readonly sessions: SessionClient;
  readonly models: ModelCatalogClient;
  readonly usage: UsageClient;
  readonly tasks: TaskClient;
  readonly workspace: WorkspaceClient;
  readonly events: RuntimeEventClient;
  dispose(): Promise<void>;
}
```

The primary factory is:

```ts
createRuntimeControlClient(
  provider: string,
  options?: RuntimeControlClientOptions,
): Promise<RuntimeControlClient>
```

The two unreleased names are removed through a direct rename:

```text
CanonicalRuntimeControlPlane -> RuntimeControlClient
createRuntimeControlPlane    -> createRuntimeControlClient
```

Released public APIs are otherwise additive-only.

## Registry Composition

Core provides provider-neutral registry contracts. `extensions/cavi` exports an
enhancer that installs plugin-gated runtime-control factories once during
application setup.

Conceptually:

```ts
const registry = withCaviRuntimeControlProviders(baseRegistry);

const control = await createRuntimeControlClient("hermes", {
  registry,
  baseUrl,
  extension: {
    dashboardUrl,
    token,
  },
});
```

UI code receives only `RuntimeControlClient` and contains no provider switch.
Applications that do not install the CAVI enhancer retain the same interface and
receive exact typed-unavailable behavior for unsupported modules.

## Current Hermes Authority

The upstream Hermes checkout currently exposes two relevant protocol families.

### Stable API server

- `GET /v1/models`
- `GET /v1/capabilities`
- Responses and chat-completions APIs
- run start, status, approval, stop, and SSE events
- `/api/jobs` for scheduled cron jobs

These remain provider-core runtime APIs. Cron jobs must not be represented as
canonical operator tasks.

### Dashboard and TUI gateway

- standard JSON-RPC 2.0 over `/api/ws`;
- singular methods such as `session.list`, `session.usage`, and
  `session.interrupt`;
- JSON-RPC event notifications containing `{ type, payload }`;
- REST sessions at `/api/sessions` and `/api/sessions/{id}`;
- analytics at `/api/analytics/usage`;
- model, provider-auth, profile, and configuration routes.

These wire contracts differ from the existing OpenClaw-oriented generic gateway
client, which uses `req`, `res`, and `event` frames, a connect/device handshake,
plural `sessions.*` methods, and different REST paths. Hermes therefore requires
a native driver, not a relabeled OpenClaw client.

## Hermes Extension Components

### Hermes JSON-RPC driver

The driver implements standard JSON-RPC 2.0 request, response, error, and
notification framing for `/api/ws`. It owns correlation, bounded pending calls,
cancellation, reconnect policy, secret-safe tracing, and disposal. It exposes a
narrow internal request/subscribe/dispose interface that existing adapters can
consume.

It does not implement OpenClaw connect/device authentication or translate Hermes
into OpenClaw frames.

### Hermes dashboard REST driver

The driver owns current Hermes dashboard routes and authentication. It strictly
parses sessions, session detail/deletion, analytics, models, provider auth, and
profile/config responses. It provides documented REST fallback only where the
operation is semantically equivalent to its JSON-RPC counterpart.

### Translators

Thin translators map upstream Hermes data into existing shared contracts:

- `session.list` and dashboard sessions into `SessionClient`;
- `session.interrupt` into canonical session cancellation only when upstream
  semantics match;
- `session.usage` and dashboard analytics into shared usage types;
- dashboard model and auth data into model and auth-status clients;
- JSON-RPC notifications into shared runtime events;
- existing CAVI operator tasks into `TaskClient`;
- existing project-board/operator descriptors into `WorkspaceClient`.

No translator owns transport, caching, or a second domain model.

### Existing adapter reuse

The design reuses:

- `createCaviControlAdapters` orchestration;
- shared session and snapshot loaders;
- operator-control WS-first and HTTP-fallback behavior;
- project-board live helpers and mutations;
- fallback envelopes and contract-gap reporting;
- cost-history, task-discourse, routing, incidents, and library adapters.

Where existing session loaders hardcode plural OpenClaw method names or obsolete
REST paths, they receive injected provider-neutral operation ports. Hermes and
OpenClaw drivers implement those ports; the shared normalization and caches stay
single-source.

## Usage, Tasks, Workspace, and Events

Hermes dashboard analytics and CAVI cost history are related but distinct. The
canonical usage translator may aggregate validated upstream totals, while the
CAVI cost-history snapshot remains a CAVI extension view. Missing currency or
cost authority remains unavailable rather than being fabricated.

Hermes `/api/jobs` contains scheduled cron jobs and is not mapped to canonical
operator tasks. CAVI operator-task routes and methods implement `TaskClient`.

Project-board and operator registry data implement workspace descriptors only
when they contain explicit workspace identity. Arbitrary config or filesystem
paths do not become workspaces.

Hermes JSON-RPC notifications normalize once before subscribers receive them.
Reconnect emits continuity metadata and a gap whenever replay cannot be proven.
No synthetic replay is claimed.

## Error Handling and Security

- Unsupported or unconfigured operations reject with `CapabilityUnavailable`
  containing the exact provider and operation.
- Malformed upstream payloads fail closed as canonical transport/protocol errors.
- Error metadata is bounded and secret-safe.
- Tokens, cookies, auth query parameters, and upstream bodies are never exposed.
- Authentication resolver failures normalize without leaking the original secret.
- Missing CAVI plugins do not produce empty successful snapshots.
- Fallback is allowed only between documented equivalent operations.
- A provider or extension may not declare a module supported unless its complete
  required behavior passes conformance.

## Ownership and Lifecycle

- Injected transports are caller-owned by default.
- Internally created Hermes HTTP and WebSocket resources are client-owned.
- Explicit ownership overrides remain opt-in.
- `dispose()` is idempotent and closes only owned resources.
- Aborted construction does not leak a partially created socket or pending call.
- Subscriber failure does not terminate other subscribers.
- Reconnect and cancellation are bounded and observable through canonical errors
  and events.

## Capability Declaration

The root capability matrix is preserved and updated only with proven facts.
Hermes declares only modules backed by current upstream fixtures and complete
conformance. Plugin-gated modules are declared by the enhanced registry result,
not unconditionally by the base Hermes provider row.

Unavailable providers and partially configured extensions still return the full
`RuntimeControlClient` shape, with individual operations rejecting exact
`CapabilityUnavailable` errors.

## Testing and Verification

The implementation must include:

- fixture-backed Hermes JSON-RPC request, response, error, and event tests;
- fixture-backed dashboard REST route and payload tests;
- conformance tests for Hermes, OpenClaw, and unavailable providers;
- cross-provider tests proving identical module and method names;
- extension classification and compatibility-forwarder tests;
- guards against provider-to-extension imports and duplicate implementations;
- tests for auth precedence, cancellation, ownership, reconnect, redaction,
  malformed payloads, and idempotent disposal;
- capability-matrix and provider-manifest tests;
- root and subpath public-surface tests;
- package-hardening and docs-integrity tests;
- packed ESM and TypeScript NodeNext consumer tests.

Completion requires a clean-worktree `pnpm run verify`, coverage review, package
audit, pack inspection, and confirmation that no private agent artifacts are
tracked or packed.

## Documentation

Public API changes update `README.md`, `API.md`, `ARCHITECTURE.md`, and the
`[Unreleased]` changelog in the same implementation slice. Documentation must
describe upstream runtimes as canonical protocol owners and this package as a
follower/mirror.

No design or task report is written to `.superpowers/` or `docs/superpowers/`.

## Implementation Order

1. Add failing tests for the direct public rename.
2. Rename the unreleased interface and factory throughout source, tests, and docs.
3. Produce the exact extension symbol classification.
4. Promote the smallest generic primitives and install forwarding exports.
5. Introduce provider-neutral session/snapshot operation ports.
6. Add Hermes JSON-RPC fixtures and driver.
7. Add Hermes dashboard REST fixtures and driver.
8. Add Hermes translators for sessions, auth/models, usage, and events.
9. Reuse CAVI operator and project-board adapters for tasks and workspace.
10. Add the CAVI registry enhancer and package-level factory integration.
11. Run full cross-provider conformance and hardening review.
12. Synchronize documentation and complete release-grade verification.

Each step must be independently testable and preserve existing root exports,
subpath exports, route behavior, and capability rows except for explicitly
approved additive facts and the direct rename of the unreleased facade.
