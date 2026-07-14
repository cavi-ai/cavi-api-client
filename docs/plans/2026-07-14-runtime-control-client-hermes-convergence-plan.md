# Runtime Control Client and Hermes Convergence Implementation Plan

> **Required sub-skill:** Use `superpowers:subagent-driven-development` (recommended)
> to execute this plan task by task, or `superpowers:executing-plans` when running
> it inline. Use `superpowers:test-driven-development` for every behavior change
> and `superpowers:verification-before-completion` before claiming completion.

**Goal:** Rename the unreleased runtime-control facade, establish enforceable
core/provider/CAVI ownership boundaries, and add a fixture-backed Hermes control
implementation that consumers access through the same `RuntimeControlClient`
contract used for every provider.

**Architecture:** Core owns the provider-neutral client contract, registry,
operation ports, transports, normalizers, and conformance. Provider modules own
native upstream protocol behavior. `extensions/cavi` owns CAVI plugin semantics
and composes Hermes dashboard control with existing CAVI operator and
project-board adapters. The UI selects neither protocols nor providers; registry
setup installs factories once.

**Tech stack:** TypeScript ESM, Vitest, Fetch, SSE, WebSocket,
`TransportMessageChannel`, standard JSON-RPC 2.0, pnpm, NodeNext consumer tests.

**Source design:**
`docs/specs/2026-07-14-runtime-control-client-hermes-convergence-design.md`

**Constraints:** Preserve every released export and the existing root capability
matrix; directly rename only the facade symbols proven unreleased after v0.11.0;
do not map Hermes cron jobs to tasks; do not duplicate OpenClaw RPC; do not write
private artifacts under `.superpowers/` or `docs/superpowers/`; never change the
package version.

## Task 1: Directly rename the unreleased facade and factory

**Files:**

- Rename: `src/core/runtime/control-plane/canonical.ts` to
  `src/core/runtime/control-plane/runtime-control-client.ts`
- Rename: `src/core/runtime/providers/control-plane-factory.ts` to
  `src/core/runtime/providers/runtime-control-client-factory.ts`
- Rename: `src/providers/control-plane-factory.ts` to
  `src/providers/runtime-control-client-factory.ts`
- Rename: `src/testing/canonical-control-plane-conformance.ts` to
  `src/testing/runtime-control-client-conformance.ts`
- Rename: `src/__tests__/core/runtime/control-plane/canonical.test.ts` to
  `src/__tests__/core/runtime/control-plane/runtime-control-client.test.ts`
- Rename: `src/__tests__/core/runtime/providers/control-plane-factory.test.ts` to
  `src/__tests__/core/runtime/providers/runtime-control-client-factory.test.ts`
- Rename: `src/__tests__/providers/control-plane-factory.test.ts` to
  `src/__tests__/providers/runtime-control-client-factory.test.ts`
- Rename: `src/__tests__/testing/canonical-control-plane-conformance.test.ts` to
  `src/__tests__/testing/runtime-control-client-conformance.test.ts`
- Modify: `src/core/runtime/providers/types.ts`
- Modify: `src/core/runtime/index.ts`
- Modify: `src/core/runtime/providers/index.ts`
- Modify: `src/providers/openclaw/control-plane/factory.ts`
- Modify: `src/providers/openclaw/provider-module.ts`
- Modify: `src/index.ts`
- Modify: `src/__tests__/public-surface.test.ts`
- Modify: `src/__tests__/package-hardening.test.ts`
- Modify: `src/__tests__/providers/openclaw/control-plane/conformance.test.ts`
- Modify: `README.md`, `API.md`, `ARCHITECTURE.md`, `CHANGELOG.md`

- [ ] **Step 1: Write failing root and subpath surface tests**

Add exact positive and negative assertions:

```ts
expect(root.createRuntimeControlClient).toBeTypeOf("function");
expect(root.createRuntimeControlPlane).toBeUndefined();
expect("RuntimeControlClient" in root).toBe(false); // interface: type-only
expect("CanonicalRuntimeControlPlane" in root).toBe(false);
```

Use `expectTypeOf` for type-only exports and add the renamed symbols to the
hardening allowlist:

```ts
type RuntimeControlFactoryKeys = keyof RuntimeControlClientOptions;
expectTypeOf<RuntimeControlFactoryKeys>().toEqualTypeOf<
  | "baseUrl"
  | "webSocketUrl"
  | "token"
  | "resolveAuth"
  | "signal"
  | "trace"
  | "transport"
  | "registry"
>();
```

Run:

```bash
pnpm vitest run src/__tests__/public-surface.test.ts \
  src/__tests__/package-hardening.test.ts
```

Expected: FAIL because the new exports do not exist and old names still exist.

- [ ] **Step 2: Rename all unreleased symbols with no aliases**

Define and export:

```ts
export interface RuntimeControlClient {
  readonly authStatus: AuthStatusClient;
  readonly sessions: SessionClient;
  readonly models: ModelCatalogClient;
  readonly usage: UsageClient;
  readonly tasks: TaskClient;
  readonly workspace: WorkspaceClient;
  readonly events: RuntimeEventClient;
  dispose(): Promise<void>;
}

export function createUnavailableRuntimeControlClient(
  providerId: string,
  capabilities: ReadonlySet<string>,
): RuntimeControlClient;
```

Rename the provider hook and option types consistently:

```ts
export type RuntimeControlClientOptions = {
  baseUrl?: string;
  webSocketUrl?: string;
  token?: string;
  resolveAuth?: TransportAuthResolver;
  signal?: AbortSignal;
  trace?: (event: TransportLifecycleEvent) => void;
  transport?: GatewayTransport;
  registry?: RuntimeProviderRegistry;
};

export type RuntimeControlClientFactory = (
  options: RuntimeControlClientOptions,
) => Promise<RuntimeControlClient>;

export interface RuntimeProviderModule {
  // existing fields stay unchanged
  createRuntimeControlClient?: RuntimeControlClientFactory;
}
```

The package factory becomes:

```ts
export function createRuntimeControlClient(
  provider: string,
  options: RuntimeControlClientOptions = {},
): Promise<RuntimeControlClient>;
```

Rename the OpenClaw implementation to `createOpenClawRuntimeControlClient` and
the conformance exports to `RUNTIME_CONTROL_CLIENT_*` and
`runRuntimeControlClientConformance`. Do not retain deprecated aliases for any
of the direct-renamed symbols.

- [ ] **Step 3: Update docs and changelog in the same slice**

Replace the unreleased names in README, API, architecture, and `[Unreleased]`.
State explicitly that this is a pre-release direct rename, not a compatibility
removal. Keep the older released `RuntimeControlPlane` declaration API intact.

- [ ] **Step 4: Prove the old names are absent**

Run:

```bash
rg -n 'CanonicalRuntimeControlPlane|CanonicalControlPlaneFactory|createCanonicalControlPlane|createRuntimeControlPlane|createUnavailableCanonicalControlPlane' \
  src README.md API.md ARCHITECTURE.md CHANGELOG.md
pnpm vitest run src/__tests__/core/runtime src/__tests__/providers/openclaw/control-plane \
  src/__tests__/public-surface.test.ts src/__tests__/package-hardening.test.ts
```

Expected: `rg` returns no matches; tests PASS.

- [ ] **Step 5: Commit the rename**

```bash
git add src README.md API.md ARCHITECTURE.md CHANGELOG.md
git commit -m "refactor: rename runtime control client facade"
```

## Task 2: Record and enforce extension ownership

**Files:**

- Create: `docs/extension-ownership.md`
- Create: `src/__tests__/architecture/extension-ownership.test.ts`
- Modify: `ARCHITECTURE.md`
- Modify: `src/__tests__/package-hardening.test.ts`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Add a failing architecture test**

The test walks TypeScript imports and permits no provider-to-extension imports
except the four released compatibility forwarders:

```ts
const providerExtensionImportAllowlist = new Set([
  "src/providers/hermes/team-registry.ts",
  "src/providers/hermes/team-registry-config.ts",
  "src/providers/openclaw/team-registry.ts",
  "src/providers/openclaw/team-registry-config.ts",
]);

expect(unapprovedProviderExtensionImports).toEqual([]);
expect(coreExtensionImports).toEqual([]);
```

Also assert that no source file imports an implementation from both core and a
CAVI path for the same concern.

Run:

```bash
pnpm vitest run src/__tests__/architecture/extension-ownership.test.ts
```

Expected: FAIL until the rule and classification fixture are implemented.

- [ ] **Step 2: Publish the exact classification table**

`docs/extension-ownership.md` must list every public export from
`src/extensions/cavi/index.ts` and its re-export barrels with one of:

- `keep`: CAVI routes, domains, fallbacks, env/path wrappers, team configuration,
  current session-key helpers, operator/project-board/portal/library/discourse;
- `already-core`: gateway snapshots, session normalization, transport, runtime
  paths, and env primitives that CAVI composes without copying;
- `promote-now`: only the new session operation port introduced in Task 3;
- `compatibility-exception`: the four released provider forwarding modules;
- `retire-later`: obsolete released symbols, with replacement and major-version
  removal condition.

The table must include `symbol`, `current owner`, `classification`, `evidence`,
and `action`. A generic-looking name is not promotion evidence.

- [ ] **Step 3: Add hardening rules**

Add the exact allowlist above, ban new provider imports from
`extensions/cavi`, and ban new extension implementations that duplicate the
core transport or snapshot filenames. Link the architecture doc to the
classification.

- [ ] **Step 4: Run architecture and docs gates**

```bash
pnpm vitest run src/__tests__/architecture/extension-ownership.test.ts \
  src/__tests__/package-hardening.test.ts src/__tests__/docs-integrity.test.ts
pnpm exec markdownlint-cli2 docs/extension-ownership.md ARCHITECTURE.md CHANGELOG.md
```

Expected: PASS.

- [ ] **Step 5: Commit ownership policy**

```bash
git add docs/extension-ownership.md ARCHITECTURE.md CHANGELOG.md \
  src/__tests__/architecture/extension-ownership.test.ts \
  src/__tests__/package-hardening.test.ts
git commit -m "docs: enforce extension ownership boundaries"
```

## Task 3: Extract one provider-neutral session operation port

**Files:**

- Create: `src/core/gateway/snapshots/session-operations.ts`
- Create: `src/__tests__/core/gateway/snapshots/session-operations.test.ts`
- Modify: `src/core/gateway/snapshots/session-loaders.ts`
- Modify: `src/core/gateway/snapshots/index.ts`
- Modify: OpenClaw snapshot construction call sites found by graph impact analysis
- Modify: `docs/extension-ownership.md`, `API.md`, `CHANGELOG.md`

- [ ] **Step 1: Write failing port-injection tests**

Cover each operation and verify that injected operation names—not hardcoded
OpenClaw names or routes—are called:

```ts
const operations: GatewaySessionOperations = {
  list: vi.fn().mockResolvedValue(listPayload),
  usage: vi.fn().mockResolvedValue(usagePayload),
  preview: vi.fn().mockResolvedValue(previewPayload),
  detail: vi.fn().mockResolvedValue(detailPayload),
  patch: vi.fn().mockResolvedValue(undefined),
};

const loaders = createSessionLoaders({ operations });
await loaders.list({ limit: 20 });
expect(operations.list).toHaveBeenCalledWith({ limit: 20 }, expect.anything());
```

Run:

```bash
pnpm vitest run src/__tests__/core/gateway/snapshots/session-operations.test.ts
```

Expected: FAIL because the operation port does not exist.

- [ ] **Step 2: Define the port without changing public payloads**

```ts
export interface GatewaySessionOperations {
  list(input: SessionsListParams, options?: RequestOptions): Promise<SessionsListRpcPayload>;
  usage(input: SessionsUsageParams, options?: RequestOptions): Promise<SessionsUsagePayload>;
  preview(input: SessionsPreviewParams, options?: RequestOptions): Promise<SessionsPreviewPayload>;
  detail(input: SessionDetailParams, options?: RequestOptions): Promise<SessionDetailPayload>;
  patch(input: SessionPatchParams, options?: RequestOptions): Promise<void>;
}
```

Keep the existing loader public signature working by supplying an internal
OpenClaw adapter when `operations` is omitted. Do not move caches, normalizers,
or payload types.

- [ ] **Step 3: Add the OpenClaw adapter and regression tests**

The adapter alone owns the existing plural method and REST mappings:

```ts
export function createOpenClawSessionOperations(
  client: GatewayRpcClient,
  requestJson: RequestJson,
): GatewaySessionOperations;
```

Existing snapshot tests must pass unchanged, proving the released behavior is
preserved.

- [ ] **Step 4: Verify graph impact and tests**

Use the repository graph to check callers and tests, then run:

```bash
pnpm vitest run src/__tests__/core/gateway src/__tests__/extensions/cavi
pnpm run typecheck
```

Expected: PASS with no new CAVI implementation copy.

- [ ] **Step 5: Commit the port**

```bash
git add src/core/gateway src/__tests__/core/gateway docs/extension-ownership.md \
  API.md CHANGELOG.md
git commit -m "refactor: inject gateway session operations"
```

## Task 4: Add authoritative Hermes protocol fixtures

**Files:**

- Create: `src/__tests__/fixtures/hermes/dashboard/json-rpc/*.json`
- Create: `src/__tests__/fixtures/hermes/dashboard/rest/*.json`
- Create: `src/__tests__/fixtures/hermes/runtime/events/*.txt`
- Create: `src/__tests__/fixtures/hermes/README.md`
- Create: `src/__tests__/providers/hermes/upstream-fixtures.test.ts`

- [ ] **Step 1: Add a failing fixture inventory test**

Require fixtures for JSON-RPC request/result/error/event, sessions list/detail,
usage analytics, models, auth status, malformed payloads, and run SSE:

```ts
expect(fixtureNames).toEqual(expect.arrayContaining([
  "session-list-result.json",
  "session-usage-result.json",
  "session-interrupt-result.json",
  "event-notification.json",
  "sessions.json",
  "session-detail.json",
  "analytics-usage.json",
  "models.json",
  "provider-auth.json",
  "malformed.json",
  "run-events.txt",
]));
```

Expected: FAIL before fixtures exist.

- [ ] **Step 2: Add sanitized fixtures and provenance**

Record the upstream file and commit SHA for every fixture in the fixture README.
Replace tokens, user paths, prompts, and identifiers with deterministic values.
Do not copy private Hermes state or logs. Fixtures must reflect singular
`session.*` JSON-RPC and `{ method: "event", params: { type, payload } }`.

- [ ] **Step 3: Validate fixtures**

```bash
pnpm vitest run src/__tests__/providers/hermes/upstream-fixtures.test.ts
rg -n '/Users/|/Volumes/|Bearer |token=|api[_-]?key' src/__tests__/fixtures/hermes
```

Expected: tests PASS and secret/path scan has no matches.

- [ ] **Step 4: Commit fixtures**

```bash
git add src/__tests__/fixtures/hermes src/__tests__/providers/hermes/upstream-fixtures.test.ts
git commit -m "test: capture hermes control protocol fixtures"
```

## Task 5: Compose a Hermes standard JSON-RPC WebSocket driver

**Files:**

- Create: `src/extensions/cavi/providers/hermes/dashboard-json-rpc.ts`
- Create: `src/extensions/cavi/providers/hermes/types.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/dashboard-json-rpc.test.ts`
- Modify: `src/extensions/cavi/providers/index.ts`

- [ ] **Step 1: Write failing driver tests**

Cover result/error correlation, out-of-order results, notification fan-out,
abort, bounded pending calls, reconnect gap notification, redaction, ownership,
and idempotent disposal. The fixture transport must expose sent frames and close
counts.

```ts
const client = createHermesDashboardJsonRpcClient({ channel, ownsChannel: false });
const pending = client.request("session.list", { limit: 20 });
channel.receive({ jsonrpc: "2.0", id: channel.lastId, result: listFixture });
await expect(pending).resolves.toEqual(listFixture);
await client.dispose();
expect(channel.close).not.toHaveBeenCalled();
```

Expected: FAIL because the driver does not exist.

- [ ] **Step 2: Compose existing core transports**

```ts
export interface HermesDashboardJsonRpcClient {
  request<T>(method: string, params?: unknown, options?: RequestOptions): Promise<T>;
  subscribe(listener: (event: HermesDashboardEvent) => void): () => void;
  dispose(): Promise<void>;
}

export function createHermesDashboardJsonRpcClient(
  options: HermesDashboardJsonRpcOptions,
): HermesDashboardJsonRpcClient;
```

Use `createJsonRpcClient` from `src/core/transport/json-rpc.ts` and the existing
WebSocket message channel. Do not import or alter `GatewayRpcClient`; Hermes does
not use OpenClaw `req/res/event` frames or its connect/device handshake.

- [ ] **Step 3: Normalize notifications once**

Accept only standard notification envelopes whose method is `event` and whose
params contain validated `type` and `payload`. Subscriber exceptions are
isolated. When reconnect cannot prove replay continuity, emit one canonical gap
event; never claim replay.

- [ ] **Step 4: Verify focused behavior**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/dashboard-json-rpc.test.ts \
  src/__tests__/core/transport
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the driver**

```bash
git add src/extensions/cavi/providers/hermes src/extensions/cavi/providers/index.ts \
  src/__tests__/extensions/cavi/providers/hermes
git commit -m "feat: add hermes dashboard json rpc driver"
```

## Task 6: Add the Hermes dashboard REST driver

**Files:**

- Create: `src/extensions/cavi/providers/hermes/dashboard-paths.ts`
- Create: `src/extensions/cavi/providers/hermes/dashboard-rest.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/dashboard-rest.test.ts`

- [ ] **Step 1: Write failing route and parser tests**

Test exact methods and paths for sessions list/detail/delete, analytics usage,
models, provider auth, profile, and config. Test base URL joining, token
precedence, abort, non-2xx errors, malformed JSON, schema rejection, and bounded
redacted errors.

Expected: FAIL because the route table and driver do not exist.

- [ ] **Step 2: Centralize paths and strict request behavior**

```ts
export const HERMES_DASHBOARD_PATHS = {
  sessions: "/api/sessions",
  session: (id: string) => `/api/sessions/${encodeURIComponent(id)}`,
  usage: "/api/analytics/usage",
  models: "/api/models",
  providerAuth: "/api/provider-auth",
  profile: "/api/profile",
  config: "/api/config",
} as const;
```

All literals remain in `dashboard-paths.ts`. The driver returns validated
upstream DTOs; translators own canonical conversion. Use existing core HTTP,
auth, URL, error, and redaction utilities.

- [ ] **Step 3: Test REST fallback policy**

Fallback is allowed only for operations declared semantically equivalent in an
explicit table. A missing plugin, 401, malformed response, or different mutation
must not become an empty success.

- [ ] **Step 4: Verify focused behavior**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/dashboard-rest.test.ts \
  src/__tests__/package-hardening.test.ts
pnpm run typecheck
```

Expected: PASS and no route-literal hardening failures.

- [ ] **Step 5: Commit the REST driver**

```bash
git add src/extensions/cavi/providers/hermes/dashboard-paths.ts \
  src/extensions/cavi/providers/hermes/dashboard-rest.ts \
  src/__tests__/extensions/cavi/providers/hermes/dashboard-rest.test.ts
git commit -m "feat: add hermes dashboard rest driver"
```

## Task 7: Implement Hermes session operations and canonical sessions

**Files:**

- Create: `src/extensions/cavi/providers/hermes/session-operations.ts`
- Create: `src/extensions/cavi/providers/hermes/sessions.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/session-operations.test.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/sessions.test.ts`

- [ ] **Step 1: Write failing translation tests**

Use fixtures to prove singular methods, stable ID/timestamp/status conversion,
pagination, detail lookup, cancellation semantics, REST fallback equivalence,
malformed payload rejection, and no invented fields.

```ts
await operations.list({ limit: 20 });
expect(rpc.request).toHaveBeenCalledWith("session.list", { limit: 20 }, expect.anything());

await client.cancelSession?.("session-1");
expect(rpc.request).toHaveBeenCalledWith(
  "session.interrupt",
  { session_id: "session-1" },
  expect.anything(),
);
```

Expected: FAIL because the adapters do not exist.

- [ ] **Step 2: Implement the shared port**

```ts
export function createHermesSessionOperations(options: {
  rpc: HermesDashboardJsonRpcClient;
  rest: HermesDashboardRestClient;
}): GatewaySessionOperations;
```

Only this adapter knows Hermes method names. Reuse the Task 3 loaders and core
session normalizers. Do not copy snapshot caches or OpenClaw payload logic.

- [ ] **Step 3: Expose the focused module**

```ts
export function createHermesSessionClient(
  operations: GatewaySessionOperations,
): SessionClient;
```

Map interrupt to `cancelSession` only after tests prove semantic equivalence.
Unsupported preview/patch behavior must reject `CapabilityUnavailable` rather
than fabricating data.

- [ ] **Step 4: Verify tests**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/session-operations.test.ts \
  src/__tests__/extensions/cavi/providers/hermes/sessions.test.ts \
  src/__tests__/core/gateway/snapshots
```

Expected: PASS.

- [ ] **Step 5: Commit sessions**

```bash
git add src/extensions/cavi/providers/hermes/session-operations.ts \
  src/extensions/cavi/providers/hermes/sessions.ts \
  src/__tests__/extensions/cavi/providers/hermes
git commit -m "feat: adapt hermes dashboard sessions"
```

## Task 8: Implement Hermes auth, models, usage, and events modules

**Files:**

- Create: `src/extensions/cavi/providers/hermes/auth-status.ts`
- Create: `src/extensions/cavi/providers/hermes/models.ts`
- Create: `src/extensions/cavi/providers/hermes/usage.ts`
- Create: `src/extensions/cavi/providers/hermes/events.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/auth-status.test.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/models.test.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/usage.test.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/events.test.ts`

- [ ] **Step 1: Write fixture-backed failing tests**

Cover auth states without exposing credentials; stable model identity and
capabilities; token/request totals; unknown currency/cost remaining unknown;
notification-to-event conversion; subscriber isolation; reconnect gap metadata;
and unsubscribe/dispose behavior.

Expected: FAIL because modules do not exist.

- [ ] **Step 2: Implement thin translators**

```ts
export function createHermesAuthStatusClient(rest: HermesDashboardRestClient): AuthStatusClient;
export function createHermesModelCatalogClient(rest: HermesDashboardRestClient): ModelCatalogClient;
export function createHermesUsageClient(options: HermesUsageClientOptions): UsageClient;
export function createHermesRuntimeEventClient(rpc: HermesDashboardJsonRpcClient): RuntimeEventClient;
```

Use dashboard analytics for runtime totals. Keep CAVI cost history as a distinct
extension source and combine it only when currency and accounting authority are
explicit. Do not infer dollar cost from tokens.

- [ ] **Step 3: Verify focused modules and redaction**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/auth-status.test.ts \
  src/__tests__/extensions/cavi/providers/hermes/models.test.ts \
  src/__tests__/extensions/cavi/providers/hermes/usage.test.ts \
  src/__tests__/extensions/cavi/providers/hermes/events.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit focused modules**

```bash
git add src/extensions/cavi/providers/hermes src/__tests__/extensions/cavi/providers/hermes
git commit -m "feat: adapt hermes control modules"
```

## Task 9: Normalize CAVI cost route aliases without a second client

**Files:**

- Modify: `src/extensions/cavi/runtime/paths.ts`
- Modify: the existing CAVI cost-history adapter identified by graph search
- Modify: its existing focused tests
- Modify: `API.md`, `CHANGELOG.md`

- [ ] **Step 1: Add failing alias-order tests**

Assert the existing plugin route is attempted first and the current upstream
Hermes alias `/cavi-control/api/cost/history` is used only for documented
not-found/unavailable responses. Authentication, schema, and server errors do
not silently fall through.

- [ ] **Step 2: Add the alias to the existing path table**

Expose one ordered path list from `runtime/paths.ts`; update the existing adapter
to use the package's alias request helper. Do not create a Hermes-specific cost
client or duplicate its normalizer/cache.

- [ ] **Step 3: Run cost and hardening tests**

```bash
pnpm vitest run src/__tests__/extensions/cavi src/__tests__/package-hardening.test.ts
```

Expected: PASS, including route-literal enforcement.

- [ ] **Step 4: Commit alias support**

```bash
git add src/extensions/cavi/runtime/paths.ts src/extensions/cavi API.md CHANGELOG.md
git commit -m "fix: support current cavi cost route alias"
```

## Task 10: Adapt CAVI tasks and workspaces without mapping cron jobs

**Files:**

- Create: `src/extensions/cavi/providers/hermes/tasks.ts`
- Create: `src/extensions/cavi/providers/hermes/workspace.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/tasks.test.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/workspace.test.ts`
- Modify: existing CAVI adapter barrels only as needed

- [ ] **Step 1: Write failing task tests**

Prove `TaskClient` delegates to existing operator-control task adapters and that
`/api/jobs` never appears in task paths, fixtures, or calls. List/get/cancel use
the same canonical shapes as OpenClaw/unavailable clients.

- [ ] **Step 2: Write failing workspace tests**

Prove project-board/operator descriptors become workspaces only with explicit
workspace identity. Arbitrary config, repo paths, portal IDs, and team IDs alone
must not become workspaces.

- [ ] **Step 3: Implement composition adapters**

```ts
export function createHermesCaviTaskClient(adapters: CaviControlAdapters): TaskClient;
export function createHermesCaviWorkspaceClient(adapters: CaviControlAdapters): WorkspaceClient;
```

Delegate to `createCaviControlAdapters` and existing live helpers/mutations. Do
not copy CAVI DTOs, route maps, caches, or fallback envelopes.

- [ ] **Step 4: Verify focused and regression tests**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/tasks.test.ts \
  src/__tests__/extensions/cavi/providers/hermes/workspace.test.ts \
  src/__tests__/extensions/cavi
```

Expected: PASS and no `/api/jobs` mapping.

- [ ] **Step 5: Commit CAVI composition**

```bash
git add src/extensions/cavi/providers/hermes src/__tests__/extensions/cavi/providers/hermes
git commit -m "feat: compose hermes cavi tasks and workspaces"
```

## Task 11: Assemble the Hermes `RuntimeControlClient`

**Files:**

- Create: `src/extensions/cavi/providers/hermes/runtime-control-client.ts`
- Create: `src/extensions/cavi/providers/hermes/index.ts`
- Create: `src/__tests__/extensions/cavi/providers/hermes/runtime-control-client.test.ts`
- Modify: `src/extensions/cavi/providers/index.ts`
- Modify: `src/extensions/cavi/index.ts`

- [ ] **Step 1: Write failing full-shape and lifecycle tests**

Assert all seven modules exist for configured, partially configured, and
unavailable clients. Test auth precedence, construction abort cleanup, injected
transport ownership, internal resource ownership, exact capability errors, and
idempotent disposal.

```ts
const client = await createHermesRuntimeControlClient(options);
expect(Object.keys(client).sort()).toEqual([
  "authStatus", "dispose", "events", "models", "sessions", "tasks", "usage", "workspace",
]);
await client.dispose();
await client.dispose();
expect(internalChannel.close).toHaveBeenCalledTimes(1);
```

Expected: FAIL because the composite factory does not exist.

- [ ] **Step 2: Define extension configuration separately from core options**

```ts
export interface HermesCaviRuntimeControlOptions {
  dashboardBaseUrl: string;
  dashboardWebSocketUrl?: string;
  dashboardToken?: string;
  fetch?: typeof globalThis.fetch;
  channel?: TransportMessageChannel<unknown>;
  ownsChannel?: boolean;
  signal?: AbortSignal;
  cavi?: CaviControlAdapterOptions;
}

export async function createHermesRuntimeControlClient(
  options: RuntimeControlClientOptions & HermesCaviRuntimeControlOptions,
): Promise<RuntimeControlClient>;
```

Keep dashboard/plugin configuration in the extension. Do not add Hermes or CAVI
fields to the core factory options.

- [ ] **Step 3: Compose complete modules with exact unavailable fallbacks**

Build the unavailable facade first, then replace only fully configured and
conformant modules. Track every internally created disposable, unwind in reverse
order on failure, and never close injected resources unless `ownsChannel` is
explicitly true.

- [ ] **Step 4: Verify composite behavior**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/hermes/runtime-control-client.test.ts \
  src/__tests__/testing/runtime-control-client-conformance.test.ts
pnpm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the composite client**

```bash
git add src/extensions/cavi src/__tests__/extensions/cavi/providers/hermes
git commit -m "feat: compose hermes runtime control client"
```

## Task 12: Install provider factories through a CAVI registry enhancer

**Files:**

- Create: `src/extensions/cavi/providers/runtime-control-registry.ts`
- Create: `src/__tests__/extensions/cavi/providers/runtime-control-registry.test.ts`
- Modify: `src/extensions/cavi/providers/index.ts`
- Modify: `src/extensions/cavi/index.ts`
- Modify: package-level factory tests

- [ ] **Step 1: Write failing no-UI-branch tests**

Build one base registry, enhance it once, then call the same package factory for
Hermes, OpenClaw, Codex, Claude, Gemini, aliases, unknown providers, and partial
configuration. Assert identical module/method names and exact unavailable
errors. No test consumer may switch on provider.

```ts
const registry = withCaviRuntimeControlProviders(baseRegistry, {
  hermes: hermesExtensionOptions,
});

const control = await createRuntimeControlClient(providerId, {
  registry,
  baseUrl,
  token,
});

return control.sessions.listSessions();
```

Expected: FAIL because the enhancer does not exist.

- [ ] **Step 2: Implement immutable registry enhancement**

```ts
export interface CaviRuntimeControlProviderOptions {
  hermes?: HermesCaviRuntimeControlOptions;
}

export function withCaviRuntimeControlProviders(
  base: RuntimeProviderRegistry,
  options: CaviRuntimeControlProviderOptions = {},
): RuntimeProviderRegistry;
```

Clone the base module list, replace only the resolved Hermes module with an
object that preserves all existing fields and supplies `createRuntimeControlClient`,
then build a new registry. Do not mutate the input registry or alter provider
aliases/capability rows. Call-time core options override overlapping setup
options; extension-only dashboard options remain closed over by the enhancer.

- [ ] **Step 3: Prove registry isolation and error behavior**

Test two enhanced registries with different URLs/tokens concurrently. Test the
base registry remains unchanged. Missing extension configuration returns the
complete unavailable shape rather than throwing during registry setup.

- [ ] **Step 4: Run cross-provider tests**

```bash
pnpm vitest run src/__tests__/extensions/cavi/providers/runtime-control-registry.test.ts \
  src/__tests__/providers/runtime-control-client-factory.test.ts \
  src/__tests__/testing/runtime-control-client-conformance.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit registry composition**

```bash
git add src/extensions/cavi src/__tests__/extensions/cavi/providers \
  src/__tests__/providers/runtime-control-client-factory.test.ts
git commit -m "feat: install cavi runtime control providers"
```

## Task 13: Extend conformance, capability, transport, and consumer coverage

**Files:**

- Modify: `src/testing/runtime-control-client-conformance.ts`
- Modify: `src/__tests__/testing/runtime-control-client-conformance.test.ts`
- Modify: `src/__tests__/providers/hermes/provider-manifest.test.ts` or its current equivalent
- Modify: root capability-matrix tests
- Modify: packed ESM and TypeScript NodeNext consumer tests
- Modify: `src/__tests__/public-surface.test.ts`
- Modify: `src/__tests__/package-hardening.test.ts`

- [ ] **Step 1: Add failing conformance cases**

The reusable kit must verify required shape, successful result schemas,
unsupported exact errors, cancellation, abort, event subscribe/unsubscribe,
resource ownership, idempotent disposal, and secret-safe errors. Run it against:

- configured OpenClaw;
- configured Hermes plus CAVI enhancer;
- Codex, Claude, and Gemini unavailable control modules;
- unknown providers;
- partially configured Hermes.

- [ ] **Step 2: Preserve the root capability matrix**

Keep base provider declarations unchanged unless a capability is backed by
fixtures and complete conformance. Plugin-gated task/workspace facts belong to
the enhanced module, not the base Hermes row. Add assertions comparing the
pre-enhancement and post-enhancement registries.

- [ ] **Step 3: Add WS, SSE, REST, and packed-consumer matrices**

Ensure the suite explicitly exercises:

- OpenClaw custom gateway WebSocket RPC;
- Hermes standard JSON-RPC WebSocket;
- provider runtime SSE parsing and cancellation;
- Hermes dashboard REST and documented fallback;
- packed ESM root import;
- packed `./core/runtime`, `./core/runtime/providers`, `./providers/hermes`, and
  `./extensions/cavi` imports;
- TypeScript NodeNext compilation of the consumer snippet.

- [ ] **Step 4: Run coverage and inspect uncovered branches**

```bash
pnpm run coverage
pnpm run typecheck
```

Expected: PASS. Inspect the report specifically for new Hermes drivers,
translators, enhancer, abort/error paths, reconnect, and disposal. Add focused
tests for any uncovered error or ownership branch; do not lower thresholds.

- [ ] **Step 5: Commit conformance coverage**

```bash
git add src/testing src/__tests__
git commit -m "test: cover runtime control providers end to end"
```

## Task 14: Synchronize public documentation and verify the package

**Files:**

- Modify: `README.md`
- Modify: `API.md`
- Modify: `ARCHITECTURE.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/extension-ownership.md`
- Modify: stable consumer docs only if their versioning policy permits unreleased APIs

- [ ] **Step 1: Update all public examples**

Document `RuntimeControlClient`, `createRuntimeControlClient`, and
`withCaviRuntimeControlProviders`. Show one provider-independent consumer
function and setup-only extension composition. Document Hermes JSON-RPC vs
OpenClaw gateway RPC, REST fallback, SSE, capability errors, lifecycle,
ownership, auth precedence, tasks-not-cron, workspace identity requirements,
and cost uncertainty.

- [ ] **Step 2: Prove docs do not conflict**

```bash
rg -n 'CanonicalRuntimeControlPlane|CanonicalControlPlaneFactory|createCanonicalControlPlane|createRuntimeControlPlane' \
  README.md API.md ARCHITECTURE.md CHANGELOG.md docs src
pnpm vitest run src/__tests__/docs-integrity.test.ts
pnpm run docs:check
pnpm exec markdownlint-cli2 '**/*.md' '#node_modules' '#dist'
```

Expected: old-name scan has no matches outside historical references that are
explicitly allowlisted; all docs gates PASS.

- [ ] **Step 3: Commit final documentation**

```bash
git add README.md API.md ARCHITECTURE.md CHANGELOG.md docs/extension-ownership.md
git commit -m "docs: document hermes runtime control integration"
```

- [ ] **Step 4: Run the release-grade verification gate**

From a clean worktree:

```bash
pnpm run verify
pnpm audit --prod
git status --short
```

Expected: verification and audit PASS; status is clean. If audit reports an
upstream advisory, record the exact package, severity, reachability, and why it
cannot be fixed without unrelated scope.

- [ ] **Step 5: Inspect the packed artifact and private-file exclusions**

```bash
pnpm pack --dry-run
git ls-files '.superpowers/**' 'docs/superpowers/**' '.agents/**' '.codex/**'
git check-ignore -v .superpowers docs/superpowers .agents .codex
```

Expected: the tarball contains the documented public source/dist surfaces and
no tests, secrets, private agent files, `.superpowers`, `docs/superpowers`,
`.agents`, or `.codex`; tracked-private scan is empty; ignore checks identify the
repo rules.

- [ ] **Step 6: Review the complete diff and graph impact**

Use graph change detection, affected flows, and tests-for queries. Then run:

```bash
git diff --check
git diff --stat main...HEAD
git status --short
```

Confirm the diff contains no version bump, no upstream Hermes edits, no UI
changes, no new provider-to-extension imports beyond the exact compatibility
allowlist, and no duplicate transport/snapshot implementation.

- [ ] **Step 7: Stop at the PR-ready checkpoint**

Report the branch, commits, exact verification commands/results, coverage,
packed-artifact inspection, audit result, and any residual risks. Do not push,
open a pull request, merge, publish, tag, or bump the version until the
maintainer explicitly authorizes that action.
