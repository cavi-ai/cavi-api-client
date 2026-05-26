# @cavi-ai/api-client

**One gateway-agnostic TypeScript client for agent runtimes.** HTTP, WebSocket RPC, SSE, media, wiki, team routing, React hooks, and CAVI control adapters behind one clean package boundary.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Types](https://img.shields.io/badge/types-included-blue)
![ESM](https://img.shields.io/badge/module-ESM-blueviolet)

<p align="center">
  <img src="docs/assets/api-client-hero.svg" alt="@cavi-ai/api-client gateway-agnostic architecture diagram" width="100%">
</p>

```sh
npm install @cavi-ai/api-client
```

> Prefer to import it as `@cavi/api-client`? Alias it on install — the import path is then yours, no code changes needed:
>
> ```sh
> npm install @cavi/api-client@npm:@cavi-ai/api-client
> # or: pnpm add @cavi/api-client@npm:@cavi-ai/api-client
> ```

---

## The Shape

If you build frontends against agent runtimes, you have probably lived this:

You start with one gateway. You write a `fetch` wrapper for it: bearer auth, a base URL, JSON parsing, error handling. Then you need streaming, so you write an SSE parser. Then a WebSocket RPC client for live data. You define route strings. You add fallback data so the dashboard does not explode when the backend hiccups.

Then another harness shows up: a different gateway, slightly different routes, a different run-stream shape. Copying the whole thing creates two auth wrappers, two run-stream parsers, two sets of path constants, two fallback strategies, drifting in two repos. A third runtime makes it three. Mobile makes it six.

Every surface re-solves the same plumbing, slightly differently, and the differences are exactly the bugs.

**`@cavi-ai/api-client` is the shared contract for that boundary.** It is the bridge layer between agent harnesses and the workspaces, UIs, and gateways that consume them:

- **One client interface**, gateway-agnostic at the core. HTTP REST and WebSocket RPC live behind the same shapes.
- **Thin provider adapters** (Hermes, OpenClaw, or your own) that override only what is actually different: headers, endpoint maps, default surfaces. The transport, RPC protocol, retry semantics, and trace behavior are written once.
- **Path contracts** so route strings live in exactly one place, never scattered through clients and components.
- **A declarative team manifest** so team / member / workspace / action routing is data your app supplies at runtime, not constants baked into the package.
- **Graceful degradation as a contract** — when a backend fails, loaders return a typed `DataEnvelope` with fallback data and a structured `contractGap` instead of throwing, so a flaky gateway degrades a panel instead of taking down the page.

The goal is simple: **you spend your time on the workflows you want, not the plumbing you don't.** Adding a new provider or a new feature should be additive — a small module, not a fork.

---

## What you get

| You need… | Use… |
| --- | --- |
| Authenticated JSON HTTP with timeouts, tracing, typed errors | `BaseHttpApiClient`, `JsonHttpApiClient`, `HttpApiError` |
| Agent runs + capabilities, gateway-agnostic | `GatewayApiClient`, `createGatewayApiClient` |
| Live data over WebSocket RPC | `GatewayRpcClient`, `createGatewayWebSocketClient` |
| Streaming run events (SSE) | `GatewaySseRunEventProvider`, `createGatewaySseRunEventProvider` |
| Generated audio / images / video / music / TTS | `GatewayMediaApiClient`, `createGatewayMediaClient` |
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
- **Zero runtime dependencies.** React is an *optional* peer dependency — only the `@cavi-ai/api-client/react` entry needs it.
- Uses the platform `fetch` by default. Pass `fetchImpl` when a runtime needs an explicit implementation.

The package exposes **subpath exports** so you import only the slice you need:
`@cavi-ai/api-client` (root), `./core/http`, `./core/data`, `./core/runtime`, `./core/sse`, `./core/ws`, `./core/gateway`, `./core/env`, `./contracts`, `./extensions/cavi`, `./providers/hermes`, `./providers/openclaw`, `./react`.

---

## 30-second quickstart

```ts
import {
  createGatewayApiClient,
  CaviControlApiClient,
  HttpApiError,
  OPENCLAW_PROVIDER_MODULE,
} from "@cavi-ai/api-client";

const auth = {
  bearerToken: process.env.GATEWAY_API_AUTH_TOKEN,
  clientId: "my-dashboard",
};

// Pick a provider; the returned client is the same gateway-agnostic shape.
const gateway = createGatewayApiClient(
  { baseUrl: "https://gateway.example.com", auth },
  { provider: "openclaw", providerModules: [OPENCLAW_PROVIDER_MODULE] },
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

HTTP REST (`BaseHttpApiClient`) and WebSocket RPC (`GatewayRpcClient`) are the only two things that touch the network. Both stay **gateway-agnostic** in `core/`. `createGatewayApiClient(opts, { provider | env | providerModules })` returns the right implementation:

- Provider kind `gateway` is the core fallback. Hermes/OpenClaw are provider modules exported from `./providers/hermes` and `./providers/openclaw`.
- Resolution order: explicit `provider` → `CAVI_GATEWAY_PROVIDER` → `GATEWAY_PROVIDER` → default `gateway`.
- `Gateway*` names are canonical. `Hermes*` / `OpenClaw*` names are provider-specific exports for consumers that want an implementation directly.

Universal concepts (agent runs, run-stream events) live in `core`; product code re-exports them and adds only its own aggregates. Nothing duplicates a core type.

### Graceful degradation is a contract

`withFallback()` (in `core/gateway/envelope/index.ts`) wraps adapter loads. On transport/backend failure it returns a `DataEnvelope` with `source: "mock"` and a structured `contractGap` instead of throwing — so a flaky gateway degrades one panel rather than crashing the page. **401/403 and `unknown`-classified errors still throw.** New loaders route through `withFallback` / `withMutationResult` with a mock and an expected-contract summary.

### Paths are owned, never scattered

Every API route literal lives in a `*paths.ts` file. Global gateway/team/kanban routes live in `src/contracts/paths.ts`; CAVI extension routes live in `src/extensions/cavi/contracts/paths.ts`. Global surface keys live in `src/contracts/surfaces.ts`; CAVI extension surface keys live in `src/extensions/cavi/contracts/surfaces.ts`. A hardening test fails the build if a route string leaks anywhere else.

### Layered architecture

Strict, one-directional dependency flow — lower layers never import upward:

```text
core → contracts
core/contracts → extensions/cavi
core/contracts → providers/hermes | providers/openclaw | react
```

- **`core/`** — gateway-agnostic foundation (`http`, `data`, `env`, `runtime`, `sse`, `ws`, `gateway`). No product knowledge.
- **`contracts/`** — global path & surface contracts, the agnostic team manifest.
- **`extensions/cavi/`** — CAVI-specific clients, extension contracts, adapters, domain DTOs, registry wrappers.
- **`core/gateway/providers/`** — provider plugin interface, registry, normalization, and generic factories.
- **`providers/hermes` / `providers/openclaw`** — built-in provider implementations and modules.
- **`react/`** — context/hooks over the gateway client.

Gateway internals are organized by owner folder (`client/`, `agent/`, `run/`,
`rpc/`, `snapshots/`, `resources/`, `envelope/`, `portal/`). The published
`./core/gateway` subpath is backed by one canonical `src/core/gateway/index.ts`
that exports those owner folders. Package source and new contributions should
import from the owner folder directly or from the canonical aggregate.

The boundary rules are intentionally boring:

- `core/**` contains shared data, env, gateway, HTTP, runtime, SSE, and WebSocket behavior. It must not import from `extensions/cavi/**`, concrete `providers/**`, `react/**`, or app-specific modules.
- `contracts/**` contains global route, surface, and agnostic team-manifest contracts. It must not import from extensions or providers.
- `extensions/cavi/**` may import from core and contracts. It owns CAVI clients, extension contracts, adapters, domain DTOs, registry wrappers, and production fallback snapshots.
- `providers/hermes/**` and `providers/openclaw/**` may import from core and contracts. Provider-specific cookies, source paths, endpoint maps, and WebUI payload adapters stay there.
- `core/gateway/providers/**` owns provider module types, provider normalization, the registry, and generic factories. Built-in providers are ordinary modules passed through that boundary.
- `react/**` may import from `core/gateway/**` and React only. The root package does not re-export React hooks so non-React consumers do not pull React into their graph.
- Test fixtures live under `src/__tests__/fixtures/**`; production modules must not depend on them.

Shared implementation belongs in core before an extension uses it. CAVI may wrap core behavior for product fallbacks, but it should not duplicate HTTP clients, JSON request helpers, query builders, gateway errors, data guards, envelope contracts, runtime base-path helpers, RPC protocol code, SSE parsing, WebSocket target handling, run-event parsing, media interfaces, wiki interfaces, resolver composition, or static team registry defaults.

Extension code should stay product-shaped: Project Board in `extensions/cavi/project-board/**`, operator control in `extensions/cavi/operator-control/**`, portals in `extensions/cavi/portal/**`, library code in `extensions/cavi/library/**`, registry adapters in `extensions/cavi/registry/**`, and extension contracts in `extensions/cavi/contracts/**`.

---

## Adding a gateway provider

This is the part the package is built for. A new gateway is a **module you register at the factory boundary** — you do not edit this package or fork it. The provider plugin surface lives at `@cavi-ai/api-client/core/gateway`.

```ts
import {
  GatewayApiClient,
  createGatewayApiClient,
  createGatewayProviderRegistry,
} from "@cavi-ai/api-client";
import { type GatewayProviderModule } from "@cavi-ai/api-client/core/gateway";

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

Provider keys are normalized (trimmed, lowercased); `generic` is an alias for `gateway`. Duplicate keys throw by default; pass `{ allowOverrides: true }` only for an intentional override. Built-in providers are explicit modules, not hidden registry state.

A provider module may customize headers, endpoint maps, factories, or defaults. It should **not** fork the parser, the RPC protocol, retry semantics, or trace behavior — those are written once in `core`. The same module shape carries the media, wiki, agent-config, SSE, and WebSocket factories; implement only the `create*` factories your gateway actually needs, and missing factories fall back to the generic gateway implementation. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full provider-author checklist.

---

## Reference

### Environment configuration

`resolveHttpApiConfigFromEnv` gives consistent defaults and app-client aliases:

```ts
import {
  CaviControlApiClient,
  LibraryApiClient,
  resolveHttpApiConfigFromEnv,
} from "@cavi-ai/api-client";

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
import { CAVI_CONTROL_API_ENDPOINTS, HttpApiError } from "@cavi-ai/api-client";

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
} from "@cavi-ai/api-client";

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
} from "@cavi-ai/api-client";

const capabilities = await gateway.getCapabilities();
const coreCommands = extractGatewayCommandCatalog(capabilities);
const shortcuts = buildAgentSlashShortcuts(activeAgent, { coreCommands });
```

### Gateway transports

HTTP, run-event SSE, and WebSocket/RPC share one shape: `core` owns the base transport and gateway contracts; providers add thin adapters for headers, endpoint maps, or default surfaces.

Core ownership is split by protocol: `core/http/**` owns base HTTP clients and errors, `core/gateway/client/**` owns gateway HTTP resources, `core/sse/**` owns generic SSE parsing, `core/gateway/run/**` owns run-event contracts and polling fallback, `core/gateway/rpc/**` owns JSON-RPC auth and request flow, `core/ws/**` owns generic WebSocket target/close handling, and `core/gateway/agent/**` owns provider-neutral agent config parsing. Provider modules add only required routing/session headers, endpoint maps, and payload adapters.

```ts
import {
  createGatewaySseRunEventProvider,
  createGatewayWebSocketClient,
} from "@cavi-ai/api-client";

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
import { createGatewayApiClient, createGatewayMediaClient } from "@cavi-ai/api-client";

const gateway = createGatewayApiClient(
  { baseUrl: config.gateway.baseUrl, auth },
  { provider },
);
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
const image = await media.generateImage({
  input: "cover art for a research dashboard",
  format: "png",
});
const voice = await media.generateTextToSpeech({
  text: "The dashboard summary is ready.",
  voiceId: "host-voice",
  format: "mp3",
});

const finished = await media.waitForMediaJob("music", music.jobId ?? music.id!);
const assets = await media.listMediaAssets({ kind: "image" });
const imageBytes = await media.getImageAsset(assets.assets[0]!.id!);
const imageMetadata = await media.getMediaAssetMetadata(assets.assets[0]!.id!);
```

Implemented by the generic gateway client plus `HermesMediaApiClient` and `OpenClawMediaApiClient`; routing stays behind `createGatewayMediaClient`. For provider-aware UI, normalize `/v1/capabilities` and optional media provider inventories:

```ts
import {
  gatewaySupportsMediaKind,
  gatewaySupportsTextToSpeech,
  normalizeGatewayFeatureCapabilities,
} from "@cavi-ai/api-client";

const features = normalizeGatewayFeatureCapabilities({
  capabilities: await gateway.getCapabilities(),
  mediaProviders: await media.listMediaProviders(),
});

if (gatewaySupportsMediaKind(features, "image")) {
  // show image controls
}
if (gatewaySupportsTextToSpeech(features)) {
  // show voice controls
}
```

### Gateway wiki

```ts
import { createGatewayWikiClient } from "@cavi-ai/api-client";

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

Use `GatewayWikiApiClient` or `createGatewayWikiClient` for wiki work so vault routing stays behind the gateway contract.

### Gateway RPC and React

```tsx
import {
  GatewayClientProvider,
  useGatewayClientContext,
} from "@cavi-ai/api-client/react";

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
Use `gatewayClientOverrides` on the React hooks/provider for lower-level RPC knobs such as protocol range, default scopes, pre-auth env keys, request timeout, and concurrency.

### UI data adapters

`createCaviControlAdapters` builds dashboard loaders that combine gateway WebSocket RPC with HTTP fallbacks:

```ts
import { createCaviControlAdapters } from "@cavi-ai/api-client";

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

Pass `client: null` when only HTTP loaders are available. `fallbackMode` defaults to `"empty"` so public consumers get neutral fallback data. Use `"demo"` for generic demo snapshots, `createCaviControlAdapterFallbackProvider()` for CAVI-specific overrides, custom `snapshotFallbacks` / `caviFallbacks` for your app, or `"none"` to let snapshot failures propagate.

CAVI adapters are composition layers over core gateway contracts. Gateway WebSocket-backed control surfaces use the shared session loader and snapshot assembly helpers, then inject CAVI-specific fallbacks for operator control, Project Board, Discourse, cost history, and library loading.

### Team registry and manifest

Team and portal registry data is **runtime configuration** — the package ships the interface and normalizers, but `TEAM_REGISTRY_CONFIG` starts empty. Apps populate it after loading their gateway/plugin config; registry-dependent APIs fail loudly when config is missing.

```ts
import {
  configureTeamRegistryConfig,
  createOpenClawTeamRegistry,
  type TeamRegistryConfig,
} from "@cavi-ai/api-client";

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
} from "@cavi-ai/api-client";

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

The workspace resolver accepts only paths declared in `workspace.paths`, so custom folders need no new endpoint constants. Team/member/action IDs are validated as single path segments, workspace entries reject traversal, and ambiguous registry lookup keys fail during registry creation. Gateway route bindings are declarative manifest entries resolved through `resolveGatewayRouteBinding`. New team-shaped CAVI paths should use the `team.*` contracts first; Project Board, Martina, Machine, Front Door, and portal-memory routes stay in the CAVI extension. See [`docs/team-manifest.md`](docs/team-manifest.md), [`docs/team-manifest.consumer.template.ts`](docs/team-manifest.consumer.template.ts), and [`docs/cavi-team-manifest.example.ts`](docs/cavi-team-manifest.example.ts) for the CAVI plugin-owned example.

### Path contracts

Route literals belong in path-owner files (`src/contracts/paths.ts`, `src/extensions/cavi/contracts/paths.ts`) and surface-owner files (`src/contracts/surfaces.ts`, `src/extensions/cavi/contracts/surfaces.ts`). Core contracts own global gateway/team routes only; extension routes stay in the extension. Extensions append their surface map over the core resolver with `createSurfacePathResolver`, so `resolvePath` remains core-only and `resolveCaviPath` can resolve both core and CAVI extension keys. Use exported constants, resolvers, or helpers — never recreate route strings.

```ts
import {
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_API_ENDPOINTS,
  appendCaviApiPath,
  resolveCaviPath,
  resolvePath,
} from "@cavi-ai/api-client";

const taskPath = CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b");
const runPath = GATEWAY_API_ENDPOINTS.run("run/1");
const healthPath = resolvePath("gateway.health", "canonical");
const dashboardPath = resolveCaviPath("portal.dashboard", "canonical", { portal: "research" });
const portalAssetPath = appendCaviApiPath("/api/plugins/portal/research", "assets/logo.png");
```

Dynamic extension paths append validated relative suffixes to extension-owned base paths. Use `appendHttpQuery` for query strings instead of passing queries through path append helpers.

Canonical surface routes are API-first (`/api/plugins/<surface>/...`). Consumers should use exported constants, `resolvePath`, `resolveCaviPath`, and path helpers instead of assembling route strings.

### Repo root resolution

Filesystem integrations never assume a checkout layout — pass an explicit `repoRoot` or resolve `REPO_ROOT`:

```ts
import { requireRepoRoot } from "@cavi-ai/api-client";

const repoRoot = requireRepoRoot({ repoRoot: options.repoRoot, env: process.env });
```

Resolution order: explicit `repoRoot` → `env.REPO_ROOT` → explicit `globalRepoRoot` → `globalThis.__CAVI_REPO_ROOT__` → `process.env.REPO_ROOT`.

---

## Development

```sh
pnpm install        # install dev dependencies and wire Husky hooks
pnpm test           # vitest run — guardrails + behavior (the only test command)
pnpm run coverage   # vitest run --coverage — coverage report
pnpm run build      # tsc → dist/ (run before publishing or linking)
pnpm pack --dry-run # validates the published tarball; prepack runs the build
pnpm run verify     # tests + build + markdown lint + pack dry-run
pnpm run clean      # rm -rf dist
pnpm exec tsc --noEmit # typecheck only (strict mode is the lint gate)
```

There is no separate linter — `tsc` under `strict` is the type gate. ESM throughout: relative imports use the `.js` extension on `.ts` sources (`moduleResolution: "Bundler"`). Husky runs `pnpm test` on commit and `pnpm run verify` before push.

The **hardening tests** in [`src/__tests__/package-hardening.test.ts`](src/__tests__/package-hardening.test.ts) are the enforced package-boundary contract — they fail the build on forbidden imports, stray route literals, layout drift, baked-in registry data, and package-output drift. Treat them as the source of truth over prose, and update them only when the boundary intentionally changes.

## Contributing

Contributions — especially new gateway providers and features — are welcome. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for the dev workflow, the provider-author checklist, and the boundary rules. Architecture and dependency direction are documented above in this README.

## Security

To report a vulnerability, see [`SECURITY.md`](SECURITY.md). Please do not open public issues for security reports.

## License

[MIT](LICENSE) © sasan1200
