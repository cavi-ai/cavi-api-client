# @cavi/api-client

**One gateway-agnostic TypeScript client for agent runtimes.** HTTP + WebSocket access to runs, capabilities, media, wikis, team registries, and fleet snapshots — with structured graceful degradation built in.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Types](https://img.shields.io/badge/types-included-blue)
![ESM](https://img.shields.io/badge/module-ESM-blueviolet)

```sh
npm install @cavi/api-client
```

---

## Why this exists

If you build frontends against agent runtimes, you have probably lived this:

You start with one gateway. You write a `fetch` wrapper for it — bearer auth, a base URL, JSON parsing, error handling. Then you need streaming, so you write an SSE parser. Then a WebSocket RPC client for live data. You hardcode some route strings. You add a mock so the dashboard does not explode when the backend hiccups.

Then a **second** harness shows up — a different gateway, slightly different routes, a different run-stream shape. So you copy the whole thing and fork it. Now you have two auth wrappers, two run-stream parsers, two sets of path constants, two mock strategies, drifting in two repos. A third runtime makes it three. Mobile makes it six.

Every surface re-solves the same plumbing, slightly differently, and the differences are exactly the bugs.

**`@cavi/api-client` is the shared contract that ends that.** It is the bridge layer between many disconnected harnesses and the workspaces, UIs, and gateways that consume them:

- **One client interface**, gateway-agnostic at the core. HTTP REST and WebSocket RPC live behind the same shapes.
- **Thin provider adapters** (Hermes, OpenClaw, or your own) that override only what is actually different — headers, endpoint maps, default surfaces. The transport, the RPC protocol, the retry semantics, and the trace behavior are written once.
- **Path contracts** so route strings live in exactly one place, never scattered through clients and components.
- **A declarative team manifest** so team / member / workspace / action routing is data your app supplies at runtime, not constants baked into the package.
- **Graceful degradation as a contract** — when a backend fails, loaders return a typed `DataEnvelope` with mock data and a structured `contractGap` instead of throwing, so a flaky gateway degrades a panel instead of taking down the page.

The goal is simple: **you spend your time on the workflows you want, not the plumbing you don't.** Adding a new provider or a new feature should be additive — a small module, not a fork.

---

## What you get

| You need… | Use… |
| --- | --- |
| Authenticated JSON HTTP with timeouts, tracing, typed errors | `BaseHttpApiClient`, `JsonHttpApiClient`, `HttpApiError` |
| Agent runs + capabilities, gateway-agnostic | `GatewayApiClient`, `createGatewayApiClient` |
| Live data over WebSocket RPC | `GatewayRpcClient`, `createGatewayWebSocketClient` |
| Streaming run events (SSE) | `GatewaySseRunEventProvider`, `createGatewaySseRunEventProvider` |
| Generated audio / video / music | `GatewayMediaApiClient`, `createGatewayMediaClient` |
| Obsidian/QMD wiki vault ops | `GatewayWikiApiClient`, `createGatewayWikiClient` |
| Slash-command / mention UI from `/v1/capabilities` | `extractGatewayCommandCatalog`, `buildAgentSlashShortcuts` |
| React context + hooks for a live gateway client | `GatewayClientProvider`, `useGatewayClient`, `useGatewayEvents` |
| Dashboard loaders with HTTP + WS + mock fallback | `createCaviControlAdapters` |
| Route strings in one owned place | `CAVI_CONTROL_API_ENDPOINTS`, `GATEWAY_API_ENDPOINTS`, `resolvePath` |
| Runtime-supplied team / workspace / action routing | `normalizeTeamManifest`, `resolvePath`, `resolveTeamWorkspaceApiPath` |
| Register a new gateway provider without forking | `createGatewayProviderRegistry`, `GatewayProviderModule` |

Full export catalog is in [Reference](#reference) below.

---

## Runtime

- Pure **ESM** package, ships compiled `dist/` with type declarations.
- Requires **Node.js `>=20`** (or any modern runtime with `fetch`, `WebSocket`).
- **Zero runtime dependencies.** React is an *optional* peer dependency — only the `@cavi/api-client/react` entry needs it.
- Uses the platform `fetch` by default. Pass `fetchImpl` when a runtime needs an explicit implementation.

The package exposes **subpath exports** so you import only the slice you need:
`@cavi/api-client` (root), `./core/http`, `./core/data`, `./core/runtime`, `./core/sse`, `./core/ws`, `./core/gateway`, `./core/env`, `./contracts`, `./cavi`, `./providers/gateway`, `./providers/hermes`, `./providers/openclaw`, `./react`.

---

## 30-second quickstart

```ts
import {
  createGatewayApiClient,
  CaviControlApiClient,
  HttpApiError,
} from "@cavi/api-client";

const auth = {
  bearerToken: process.env.GATEWAY_API_AUTH_TOKEN,
  clientId: "my-dashboard",
};

// Pick a provider; the returned client is the same gateway-agnostic shape.
const gateway = createGatewayApiClient(
  { baseUrl: "https://gateway.example.com", auth },
  { provider: "openclaw" }, // or "hermes", "gateway", or your own
);

const run = await gateway.startRun({
  input: "Summarize the latest operator state.",
  session_id: "operator-dashboard",
});

// Domain-shaped HTTP for CAVI Control surfaces.
const cavi = new CaviControlApiClient({
  baseUrl: "https://control.example.com",
  auth,
});

try {
  const snapshot = await cavi.getOperatorSnapshot();
  console.log(snapshot);
} catch (error) {
  if (error instanceof HttpApiError) {
    console.error(error.status, error.path, error.body);
  }
}
```

That is the whole mental model: **pick a provider, get a client, call methods.** Everything below is detail you reach for when you need it.

---

## Core concepts

### One model, provider overrides

HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) are the only two things that touch the network. Both stay **gateway-agnostic** in `core/`. `createGatewayApiClient(opts, { provider | env })` returns the right implementation:

- Provider kinds `gateway` | `hermes` | `openclaw` map to surfaces `gateway-api` / `hermes-api-server` / `openclaw-api`.
- Resolution order: explicit `provider` → `CAVI_GATEWAY_PROVIDER` → `GATEWAY_PROVIDER` → default `gateway`.
- `Gateway*` names are canonical. `Hermes*` / `OpenClaw*` names are provider-specific compatibility exports — prefer the gateway-agnostic name in new code.

Universal concepts (agent runs, run-stream events) live in `core`; product code re-exports them and adds only its own aggregates. Nothing duplicates a core type.

### Graceful degradation is a contract

`withFallback()` (in `core/gateway/envelope/index.ts`) wraps adapter loads. On transport/backend failure it returns a `DataEnvelope` with `source: "mock"` and a structured `contractGap` instead of throwing — so a flaky gateway degrades one panel rather than crashing the page. **401/403 and `unknown`-classified errors still throw.** New loaders route through `withFallback` / `withMutationResult` with a mock and an expected-contract summary.

### Paths are owned, never scattered

Every API route literal lives in a `*paths.ts` file — chiefly `src/contracts/paths.ts` (endpoint tables and dynamic route helpers) and `src/cavi/paths.ts` (CAVI-facing aliases such as `DEB_API`, `OPERATOR_API`). `src/contracts/surfaces.ts` holds the surface contract map; `resolvePath(key, mode)` picks the path for a `GatewayMode`. A hardening test fails the build if a route string leaks anywhere else.

### Layered architecture

Strict, one-directional dependency flow — lower layers never import upward:

```
core → contracts → cavi → providers / react
```

- **`core/`** — gateway-agnostic foundation (`http`, `data`, `env`, `runtime`, `sse`, `ws`, `gateway`). No product knowledge.
- **`contracts/`** — path & surface contracts, the agnostic team manifest.
- **`cavi/`** — CAVI-specific clients, adapters, domain DTOs, registry wrappers.
- **`providers/`** — `gateway` (the plugin boundary), `hermes`, `openclaw`.
- **`react/`** — context/hooks over the gateway client.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the full layout and dependency rules.

Gateway internals are organized by owner folder (`client/`, `agent/`, `run/`,
`rpc/`, `snapshots/`, `resources/`, `envelope/`, `portal/`). The published
`./core/gateway` subpath is backed by one canonical `src/core/gateway/index.ts`
that exports those owner folders. Old flat `src/core/gateway/*.ts` shim files
are quarantined; package source and new contributions should import from the
owner folder directly or from the canonical aggregate.

---

## Adding a gateway provider

This is the part the package is built for. A new gateway is a **module you register at the factory boundary** — you do not edit this package or fork it. The provider plugin surface lives at `@cavi/api-client/providers/gateway`.

```ts
import {
  GatewayApiClient,
  createGatewayApiClient,
  createGatewayProviderRegistry,
} from "@cavi/api-client";
import { type GatewayProviderModule } from "@cavi/api-client/providers/gateway";

const acmeProvider: GatewayProviderModule = {
  kind: "acme",
  aliases: ["acme-gateway"],
  createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
};

const registry = createGatewayProviderRegistry({
  modules: [acmeProvider],
});

const gateway = createGatewayApiClient(
  { baseUrl: "https://acme.example.com", auth },
  { provider: "acme-gateway", registry },
);
```

Provider keys are normalized (trimmed, lowercased); `generic` is an alias for `gateway`. Duplicate keys throw by default so a plugin cannot silently replace a built-in — pass `{ includeBuiltIns: false }` for a standalone registry or `{ allowOverrides: true }` for an intentional override.

A provider module may customize headers, endpoint maps, factories, or defaults. It should **not** fork the parser, the RPC protocol, retry semantics, or trace behavior — those are written once in `core`. The same module shape carries the media, wiki, agent-config, SSE, and WebSocket factories — implement only the `create*` factories your app actually uses; calling a factory the module does not provide (e.g. `createGatewayMediaClient` for a provider with no `createMediaClient`) throws at construction time. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full provider-author checklist.

---

## Reference

### Environment configuration

`resolveHttpApiConfigFromEnv` gives consistent defaults and compatibility aliases:

```ts
import {
  CaviControlApiClient,
  LibraryApiClient,
  resolveHttpApiConfigFromEnv,
} from "@cavi/api-client";

const config = resolveHttpApiConfigFromEnv(process.env);

const cavi = new CaviControlApiClient({
  baseUrl: config.cavi.baseUrl,
  auth: { bearerToken: config.cavi.authToken, clientId: config.cavi.clientId },
});
```

Canonical environment keys:

- `CAVI_API_BASE_URL`, `CAVI_API_AUTH_TOKEN`, `CAVI_API_CLIENT_ID`
- `GATEWAY_API_BASE_URL`, `GATEWAY_API_AUTH_TOKEN`, `GATEWAY_API_CLIENT_ID`
- `LIBRARY_API_BASE_URL`, `LIBRARY_API_AUTH_TOKEN`, `LIBRARY_API_CLIENT_ID`

Alias keys for Expo and Vite clients are supported by default; pass `{ includeAliases: false }` to disable. Hermes-specific keys are available through `resolveHermesHttpApiConfigFromEnv` from the Hermes provider exports.

### Requests, headers, and errors

All HTTP clients share the same request behavior:

- `Accept: application/json` is always sent.
- `Authorization: Bearer <token>` is sent when `auth.bearerToken` is present.
- `X-Portal-Client-Id` defaults to `cavi-api-client` unless `auth.clientId` is provided.
- `Idempotency-Key` is sent when a request receives an `idempotencyKey`.
- Request bodies are JSON-encoded with `Content-Type: application/json`.
- Non-2xx responses throw `HttpApiError` with `path`, `url`, `method`, `status`, and the raw response `body`.
- Network failures, aborts, and invalid JSON are also surfaced as `HttpApiError`.

```ts
import { CAVI_CONTROL_API_ENDPOINTS, HttpApiError } from "@cavi/api-client";

try {
  await cavi.postJson(
    CAVI_CONTROL_API_ENDPOINTS.operator.tasks,
    { title: "Review" },
    "task-1",
  );
} catch (error) {
  if (error instanceof HttpApiError) {
    console.error(error.status, error.path, error.body);
  }
}
```

Pass `onTrace` to observe request timing without changing behavior:

```ts
const client = new CaviControlApiClient({
  baseUrl: "https://control.example.com",
  onTrace: (t) => console.debug(t.method, t.path, t.status, t.durationMs),
});
```

### Gateway providers

```ts
import {
  createGatewayApiClient,
  resolveGatewayProviderKind,
} from "@cavi/api-client";

const provider = resolveGatewayProviderKind({
  provider: settings.gatewayProvider,
  env: process.env,
});

const gateway = createGatewayApiClient(config.gateway, { provider });
```

Gateway slash commands are part of the `/v1/capabilities` contract (which may expose `commands`, `slashCommands`, or `slash_commands`). Normalize the catalog instead of hardcoding command lists:

```ts
import {
  buildAgentSlashShortcuts,
  extractGatewayCommandCatalog,
} from "@cavi/api-client";

const capabilities = await gateway.getCapabilities();
const coreCommands = extractGatewayCommandCatalog(capabilities);
const shortcuts = buildAgentSlashShortcuts(activeAgent, { coreCommands });
```

### Gateway transports

HTTP, run-event SSE, and WebSocket/RPC share one shape: `core` owns the base transport and gateway contracts; providers add thin adapters for headers, endpoint maps, or default surfaces.

```ts
import {
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
} from "@cavi/api-client";

const sse = createGatewaySseRunEventProvider(
  {
    httpBase: config.gateway.baseUrl,
    authToken: config.gateway.authToken,
    clientId: config.gateway.clientId,
    sessionKey: session.id, // required by the Hermes adapter
  },
  { provider },
);

const ws = createGatewayWebSocketClient(
  target.wsUrl,
  config.gateway.authToken,
  { clientId: config.gateway.clientId },
  { provider },
);
```

### Gateway media

```ts
import { createGatewayMediaClient } from "@cavi/api-client";

const media = createGatewayMediaClient(
  { baseUrl: config.gateway.baseUrl, auth },
  { provider },
);

const providers = await media.listMediaProviders("audio");
const music = await media.generateMusic({
  input: "lofi loop for a research dashboard",
  format: "mp3",
  options: { bpm: 90 },
});
```

Implemented by the generic gateway client plus `HermesMediaApiClient` and `OpenClawMediaApiClient`; routing stays behind `createGatewayMediaClient`.

### Gateway wiki

```ts
import { createGatewayWikiClient } from "@cavi/api-client";

const wiki = createGatewayWikiClient(
  { baseUrl: config.gateway.baseUrl, auth },
  { provider },
);

const vaults = await wiki.listWikiVaults();
const tree = await wiki.getWikiTree("research");
const page = await wiki.readWikiPage("research", "index.qmd");

await wiki.ingestWiki("research", {
  path: "drafts/market-note.qmd",
  content: "# Market note",
  format: "qmd",
});
```

Legacy `/api/obsidian/*` routes remain compatibility shims; new code should prefer `GatewayWikiApiClient`.

### Gateway RPC and React

```tsx
import {
  GatewayClientProvider,
  useGatewayClientContext,
} from "@cavi/api-client";

export function AppShell() {
  return (
    <GatewayClientProvider
      gatewayBaseUrl="https://gateway.example.com"
      authToken={token}
      clientId="portal-client"
      requestedScopes={["operator.read"]}
      autoReconnect
    >
      <OperatorPanel />
    </GatewayClientProvider>
  );
}

function OperatorPanel() {
  const { client, state, connect } = useGatewayClientContext();

  async function refresh() {
    await connect();
    const payload = await client?.request("sessions.list", { limit: 20 });
    console.log(payload, state);
  }

  return <button onClick={refresh}>Refresh</button>;
}
```

Also exported: `useGatewayClient`, `useGatewayRpc`, `useGatewayEvents`, `useGatewayConnectionState`, `useGatewayEventStream`. React must be available in the application runtime.

### UI data adapters

`createCaviControlAdapters` builds dashboard loaders that combine gateway WebSocket RPC with HTTP fallbacks:

```ts
import { createCaviControlAdapters } from "@cavi/api-client";

const adapters = createCaviControlAdapters({
  gatewayBaseUrl: "https://gateway.example.com",
  apiBaseUrl: "https://control.example.com",
  authToken: token,
  client: gatewayRpcClient,
  fallbackMode: "empty",
});

const overview = await adapters.loadOverview();
const operator = await adapters.loadOperatorControl();
```

Pass `client: null` when only HTTP loaders are available. `fallbackMode` defaults to `"compat"`; use `"empty"` or custom `snapshotFallbacks` for product-neutral demos, or `"none"` to let snapshot failures propagate.

### Team registry and manifest

Team and portal registry data is **runtime configuration** — the package ships the interface and normalizers, but `TEAM_REGISTRY_CONFIG` starts empty. Apps populate it after loading their gateway/plugin config; registry-dependent APIs fail loudly when config is missing.

```ts
import {
  configureTeamRegistryConfig,
  createOpenClawTeamRegistry,
  type TeamRegistryConfig,
} from "@cavi/api-client";

const registryConfig: TeamRegistryConfig = await loadRegistryConfigOnAppStart();
configureTeamRegistryConfig(registryConfig);

const registry = createOpenClawTeamRegistry(registryConfig);
const team = registry.getPortalTeam("research");
```

For dynamic frontends, prefer the **team manifest** — you own team/member entries; the package owns the contract, normalization, generated route grammar, workspace-path whitelisting, and action override resolution:

```ts
import {
  configureTeamRegistryConfig,
  normalizeTeamManifest,
  resolvePath,
  resolveTeamWorkspaceApiPath,
  findTeamManifestTeam,
  type TeamManifest,
} from "@cavi/api-client";

const manifest = normalizeTeamManifest({
  version: 1,
  teams: [
    {
      id: "research",
      identity: { displayName: "Research", slug: "research", code: "RND" },
      workspace: {
        rootPath: "/teams/research/workspace-research",
        paths: ["research/complete", { key: "media.images", path: "media/images" }],
      },
      actions: [
        {
          id: "summarize",
          input: { mode: "json", params: [{ key: "documentId", type: "string", required: true }] },
          output: { mode: "json", contentType: "application/json" },
        },
      ],
      members: [{ id: "scout", capabilities: ["research.complete"] }],
    },
  ],
} satisfies TeamManifest);

configureTeamRegistryConfig({ provider: "gateway", manifest });

resolvePath("team.kanban", "canonical", { teamId: "research" });
// /api/teams/research/kanban

const team = findTeamManifestTeam(manifest, "research");
resolveTeamWorkspaceApiPath(team!, "media.images", { memberId: "scout" });
// /api/teams/research/agents/scout/workspace/media/images
```

The workspace resolver accepts only paths declared in `workspace.paths`, so custom folders need no new endpoint constants. Gateway route bindings are declarative manifest entries resolved through `resolveGatewayRouteBinding`. See [`docs/team-manifest.md`](docs/team-manifest.md) and [`docs/team-manifest.consumer.template.ts`](docs/team-manifest.consumer.template.ts) for the add/remove-agent template.

### Path contracts

Route literals belong in path-owner files (`src/contracts/paths.ts`, `src/cavi/paths.ts`) and `src/contracts/surfaces.ts`. Use exported constants, `resolvePath`, or helpers — never recreate route strings.

```ts
import {
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_API_ENDPOINTS,
  resolvePath,
} from "@cavi/api-client";

const taskPath = CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b");
const runPath = GATEWAY_API_ENDPOINTS.run("run/1");
const dashboardPath = resolvePath("portal.dashboard", "canonical", { portal: "research" });
```

Canonical surface routes are api-first (`/api/plugins/<surface>/...`). Legacy compatibility routes keep the older `/<surface>/api/...` shape only where existing clients still need them.

### Repo root resolution

Filesystem integrations never assume a checkout layout — pass an explicit `repoRoot` or resolve `REPO_ROOT`:

```ts
import { requireRepoRoot } from "@cavi/api-client";

const repoRoot = requireRepoRoot({ repoRoot: options.repoRoot, env: process.env });
```

Resolution order: explicit `repoRoot` → `env.REPO_ROOT` → explicit `globalRepoRoot` → `globalThis.__CAVI_REPO_ROOT__` → `process.env.REPO_ROOT`.

---

## Development

```sh
npm install      # install dev dependencies
npm test         # vitest run — guardrails + behavior (the only test command)
npm run coverage # vitest run --coverage — coverage report
npm run build    # tsc → dist/ (run before publishing or linking)
npm run clean    # rm -rf dist
npx tsc --noEmit # typecheck only (strict mode is the lint gate)
```

There is no separate linter — `tsc` under `strict` is the type gate. ESM throughout: relative imports use the `.js` extension on `.ts` sources (`moduleResolution: "Bundler"`).

The **hardening tests** in [`src/package-hardening.test.ts`](src/package-hardening.test.ts) are the enforced package-boundary contract — they fail the build on forbidden imports, stray route literals, layout drift, and baked-in registry data. Treat them as the source of truth over prose, and update them only when the boundary intentionally changes.

## Contributing

Contributions — especially new gateway providers and features — are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the dev workflow, the provider-author checklist, and the boundary rules. Architecture and dependency direction are in [`ARCHITECTURE.md`](ARCHITECTURE.md); the package-boundary intent is in [`AGENTS.md`](AGENTS.md).

## Security

To report a vulnerability, see [`SECURITY.md`](SECURITY.md). Please do not open public issues for security reports.

## License

[MIT](LICENSE) © sasan1200
