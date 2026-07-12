# Runtime Control-Plane Compatibility Design

**Date:** 2026-07-12
**Status:** Approved design
**Package:** `@cavi-ai/api-client`

## Objective

Extend the provider-neutral runtime package with stable, capability-based control-plane modules that faithfully adapt OpenClaw/Caviclaw, Hermes, Codex app-server, and the package's other providers. The work must cover transport and event semantics, remain additive for current consumers, correct identified contract smells, and finish with full-package release proof.

This package remains a follower of upstream gateway and provider APIs. It does not define the canonical OpenClaw, Hermes, Codex, Claude, Gemini, or OpenAI contracts.

## Evidence Baseline

The design is based on direct source inspection of:

- Caviclaw/OpenClaw at `/Volumes/MIRZA/workspace/CAVI/harness/openclaw`, including the canonical gateway method registry and HTTP endpoint documentation.
- Hermes at `/Volumes/MIRZA/.hermes/hermes-agent`, including the API server, dashboard API, fleet-router plugin, session storage, and recent CAVI-specific changes.
- OpenAI Codex at `/Volumes/MIRZA/workspace/CAVI/harness/codex`, including the app-server protocol documentation and generated protocol schemas.
- The current package graph and public sources, including runtime contracts, provider modules, route manifests, hardening tests, documentation tests, and packaging configuration.

The observed control planes differ substantially:

- OpenClaw primarily exposes scoped WebSocket RPC plus selected HTTP endpoints.
- Hermes exposes bearer-authenticated HTTP, SSE, optional WebSocket event replay, dashboard APIs, and plugin-owned routes.
- Codex app-server exposes initialized JSON-RPC over stdio, Unix socket, and an experimental WebSocket transport, organized around threads, turns, and items.
- Hosted OpenAI/Codex APIs expose Responses streaming and Batch APIs and are not the same control plane as Codex app-server.

## Design Principles

1. Keep `RuntimeClient` focused on run execution.
2. Add small, independent capability modules rather than a monolithic optional-method interface.
3. Normalize only concepts whose semantics can be preserved.
4. Make transport, stability, provenance, and replay guarantees observable.
5. Keep provider-specific extensions available for richer behavior.
6. Expose stable, advertised upstream surfaces first.
7. Keep experimental and unadvertised surfaces out of provider-neutral public interfaces.
8. Add APIs without removing or behaviorally changing existing exports.
9. Never expose credentials or secret references through read-only auth status.
10. Require package-wide conformance and release verification, not isolated adapter tests.

## Architecture

### Runtime and control-plane separation

`RuntimeClient` remains the universal execution contract. A sibling control-plane object contains optional, independently testable modules:

```ts
interface RuntimeControlPlane {
  sessions?: SessionClient;
  models?: ModelCatalogClient;
  usage?: UsageClient;
  tasks?: TaskClient;
  workspace?: WorkspaceClient;
  authStatus?: AuthStatusClient;
  events?: RuntimeEventClient;
  transports: RuntimeTransportCapabilities;
}
```

Provider modules construct only the modules they can implement faithfully. Consumers inspect capability metadata and then use the advertised module. Absence is the normal representation of unsupported behavior.

### Transport capabilities

Transport support is first-class rather than implied by provider identity:

```ts
interface RuntimeTransportCapabilities {
  http?: HttpTransportCapability;
  websocket?: WebSocketTransportCapability;
  sse?: SseTransportCapability;
  jsonRpc?: JsonRpcTransportCapability;
  stdio?: StdioTransportCapability;
  unixSocket?: UnixSocketTransportCapability;
}
```

Each capability describes authentication mode, stability, request/notification behavior, reconnection support, replay support, cancellation behavior, and applicable limits. An experimental upstream transport may be represented in a provider extension but is not advertised as stable provider-neutral support.

### Event contract

`RuntimeEventClient` normalizes lifecycle events while preserving transport-specific guarantees:

- run, session, thread, task, or turn started;
- state updated;
- message delta and completion;
- reasoning delta when the provider exposes it;
- tool start, progress, and completion;
- approval requested and resolved;
- usage updated;
- completed, failed, cancelled, or interrupted terminal state;
- reconnect, replay, and stream-gap signals.

Every subscribed operation emits exactly one normalized terminal event. Adapters must not silently restart work. When replay is unavailable, an adapter may reconcile through a stable status endpoint. If continuity cannot be proved, it emits a typed stream-gap event.

## Normalized Data Contracts

### Shared metadata

Normalized records carry provider and source metadata:

```ts
interface RuntimeControlPlaneMetadata {
  provider: string;
  stability: "stable" | "experimental";
  source: {
    transport: "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix-socket";
    method: string;
  };
  providerData?: unknown;
}
```

`providerData` is optional and opaque. Consumers needing provider-specific behavior use typed provider extensions rather than treating this bag as a stable contract.

### Sessions

`RuntimeSessionSummary` includes canonical and provider IDs, display title, lifecycle state, timestamps, provider kind, optional model, optional workspace reference, and provider metadata.

The interface supports only operations shared with preserved semantics, such as list, describe, create where stable, and cancel/abort where supported. Destructive operations such as delete, reset, archive, or compaction remain provider extensions until their semantics align across providers.

### Models

`RuntimeModelDescriptor` includes provider ID, model ID, display name, availability, stable capability flags, safe authentication status, and source metadata. It does not merge model entries whose provider routes differ.

### Usage and cost

`RuntimeUsageSummary` distinguishes:

- token usage from monetary cost;
- estimated cost from billed cost;
- currency;
- time window;
- aggregation level;
- provider, model, session, and agent breakdowns when available;
- provenance of the calculation.

Missing cost is represented as unavailable, never zero. Normalizers must not turn absent or malformed cost into a false `$0` result.

### Tasks

`RuntimeTaskSummary` includes task ID, state, timestamps, associated run/session/thread, cancellation capability, and provider metadata. A run, job, Kanban card, or Codex turn is exposed as a generic task only when its adapter preserves the task lifecycle contract. Otherwise it remains a provider extension.

### Workspace

`RuntimeWorkspaceDescriptor` includes provider-owned identity, display name, root reference when safe, access mode, and metadata. The provider-neutral module does not expose arbitrary filesystem reads. File access remains on explicit provider routes with existing path and workspace-whitelist guardrails.

### Authentication status

The first release is read-only. `RuntimeAuthStatus` includes provider/profile identity, status, expiry, credential source category, and safe reason codes. It never includes tokens, API keys, passwords, secret references, raw headers, or credential payloads.

Login, logout, credential rotation, auth ordering, and OAuth flows remain provider-specific and out of scope for the first release.

## Provider Mapping

### OpenClaw/Caviclaw

- Transport: WebSocket RPC for the control plane; HTTP for health, OpenAI compatibility, tools, and session-control routes.
- Sessions: stable advertised `sessions.*` methods only.
- Models/auth: `models.list` and `models.authStatus`; auth mutation remains outside the generic module.
- Usage/cost: advertised `usage.status` and `usage.cost`.
- Tasks: advertised `tasks.list`, `tasks.get`, and `tasks.cancel`.
- Workspace: stable agent files/workspace facilities only; no invented REST routes.
- Events: gateway notifications and session subscriptions with explicit scope requirements.
- Provider extensions retain approvals, cron, devices, nodes, tools, skills, config, and other OpenClaw-specific surfaces.

Unadvertised session-usage RPC methods and experimental surfaces are excluded from stable generic contracts.

### Hermes

- Transport: HTTP for creation and polling; SSE for run events; WebSocket only when the gateway advertises a stable replay surface.
- Sessions: dashboard/API sessions and Responses conversation state, without conflating the two identities.
- Models/auth: `/v1/models`, capabilities, and safe public profile/catalog data.
- Usage/cost: analytics and session-derived totals with explicit provenance.
- Tasks: runs, jobs, or Kanban tasks only through adapters that preserve lifecycle semantics.
- Workspace: canonical team and agent workspace routes with existing safe-relative-path and whitelist enforcement.
- Events: SSE run events, approval gates, terminal events, and optional replay.
- Provider extensions retain fleet-router, portal, media, wiki, plugin, and CAVI-owned surfaces.

### Codex app-server

- Provider identity: `codex-app-server`, separate from hosted Codex/OpenAI.
- Transport: initialized JSON-RPC over stdio or Unix socket. WebSocket remains experimental until upstream marks it supported.
- Sessions: threads.
- Execution: turns and items remain the run/event lifecycle.
- Models: stable model-list API.
- Auth: stable account/auth status endpoints only.
- Workspace: thread `cwd`, instruction sources, and stable workspace roots where available.
- Events: turn and item notifications, approvals, deltas, terminal state, and usage.
- Tasks and cost remain unsupported generically unless stable upstream sources are identified.

### Hosted OpenAI/Codex

Hosted Responses streaming and Batch APIs remain a separate runtime provider. They advertise HTTP/SSE and batch capabilities but do not claim Codex app-server sessions, workspace, or account-control behavior.

### Claude

Claude message and SDK streaming map to runtime events. Managed-agent lifecycle capabilities remain separate and are advertised only by the managed-agent provider. Claude must not claim gateway sessions, tasks, workspace, or cost unless the implemented surface supplies those contracts.

### Gemini

Gemini generation streaming and file capabilities remain provider-specific modules. Gemini advertises only the control-plane capabilities backed by current implemented and tested surfaces.

### Generic and custom providers

Third-party modules declare transports and capability modules through the public provider registry. The conformance kit verifies that declared support matches implemented methods and event behavior.

## Error Model

Adapters map provider errors into this taxonomy while retaining the original error as structured cause data:

- `AuthenticationRequired`
- `PermissionDenied`
- `CapabilityUnavailable`
- `EndpointNotFound`
- `InvalidRequest`
- `Conflict`
- `RateLimited`
- `TransportUnavailable`
- `TransportProtocolError`
- `ServerOverloaded`
- `Cancelled`
- `Timeout`

Errors include provider, transport, operation, retryability, optional retry delay, safe status/code, and cause. Codex overload `-32001`, HTTP `429`, and eligible transient disconnects may be retryable. Authentication failures, invalid requests, permission failures, and unsupported capabilities are not retried automatically.

## Compatibility and Smell Remediation

### Generic route aliases

Current generic `GATEWAY_*` route names alias Hermes-owned HTTP routes even though OpenClaw exposes different protocols. New code uses provider-specific route names. Existing generic exports remain deprecated additive forwarders until a human-approved major-version plan removes them.

### Surface registry ownership

Split the current surface registry into:

- stable provider contract records;
- CAVI extension/deployment records;
- explicit gap records.

No gap is advertised as provider capability. CAVI routes remain extensions, not universal gateway contracts.

### OpenClaw manifest drift

The OpenClaw manifest is a high-centrality, hand-maintained drift surface. Add a source snapshot or deterministic validation fixture derived from the upstream descriptor and endpoint registry. A mismatch fails tests and requires an intentional manifest update. The package must not fetch upstream sources during normal consumer builds.

### Codex identity separation

Hosted Codex/OpenAI and Codex app-server receive distinct provider IDs, factories, capabilities, documentation, and tests. Compatibility aliases may remain only where existing consumers require them.

### RuntimeClient optional-method pressure

Do not add sessions, models, usage, tasks, workspace, auth, or transport lifecycle methods to `RuntimeClient`. Put them in independent modules.

### Terminology

Document the relationships and non-equivalence among run, session, conversation, thread, turn, task, job, and Kanban card. Adapters must state which provider concept they map and which semantics are unavailable.

## Testing and Verification

### Capability matrix

Check in a provider-by-capability-by-transport matrix for every shipped provider entry. Tests compare provider declarations, factories, and implemented methods against this matrix.

### Conformance tests

Extend the public testing subpath with runner-neutral checks for:

- truthful capability advertisement;
- construction of each advertised module;
- absence of unsupported modules;
- event ordering and exactly one terminal event;
- cancellation and interruption mapping;
- reconnection, replay, reconciliation, and stream-gap behavior;
- malformed HTTP, SSE, WebSocket, and JSON-RPC frames;
- authentication and permission error mapping;
- usage and cost provenance;
- stable provider identity and source metadata.

### Provider fixtures

Use source-backed fixtures or local protocol servers for each adapter:

- OpenClaw descriptor/method and notification fixtures;
- Hermes HTTP, SSE, approval, and optional replay fixtures;
- Codex generated JSON-RPC schema and lifecycle fixtures;
- Claude SDK/message stream fixtures;
- Gemini stream/file fixtures;
- hosted Responses SSE and Batch fixtures;
- generic-provider conformance fixtures.

Fixtures must record the upstream commit or schema version they represent.

### Package-wide gates

Completion requires:

1. targeted adapter tests during development;
2. all package tests, including hardening and docs integrity;
3. docs example typechecking;
4. TypeScript build;
5. Markdown lint;
6. `pnpm run verify` for the entire package;
7. `pnpm audit --audit-level moderate`;
8. packed-tarball import proof for every public entrypoint, including new control-plane and testing entries;
9. `git diff --check`;
10. source-fixture or live-protocol evidence for each gateway adapter.

Smoke tests alone are not completion proof.

## Delivery Slices

1. Add contract types, capability matrix, error taxonomy, transport metadata, event contract, and conformance scaffolding.
2. Audit every existing provider and make capability declarations truthful without adding new behavior.
3. Add OpenClaw stable control-plane adapters and descriptor drift validation.
4. Add Hermes stable HTTP/SSE adapters and WebSocket replay only when capability-advertised.
5. Add the distinct Codex app-server JSON-RPC provider.
6. Align Claude, Gemini, hosted Codex/OpenAI, and generic providers with the new declarations and conformance suite.
7. Split surface ownership, add deprecations and migration examples, update docs and changelog, and run full release proof.

Each slice is additive, independently testable, and independently releasable. No slice changes the package version, merges, publishes, or modifies upstream gateways.

## Out of Scope

- Mutating authentication or credentials through provider-neutral APIs.
- Experimental or unadvertised upstream surfaces in stable generic interfaces.
- Treating CAVI-specific routes as universal gateway contracts.
- Removing existing public exports.
- Changing upstream OpenClaw, Hermes, or Codex repositories.
- Publishing, merging, tagging, or version bumping.

## Success Criteria

- Consumers can discover and use stable sessions, models, usage, tasks, workspace, auth status, transports, and events without provider-name conditionals for genuinely shared behavior.
- Provider-specific behavior remains available through typed extensions.
- Every shipped provider has a truthful, tested capability declaration.
- SSE, WebSocket, HTTP, JSON-RPC, stdio, and Unix-socket behavior is represented where applicable.
- No existing consumer-facing symbol or behavior is removed or changed.
- Identified route, surface-registry, manifest-drift, provider-identity, and optional-method smells have bounded remediation paths.
- The full package passes release-grade verification and packed-artifact proof.
