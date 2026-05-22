# @cavi/api-client

Gateway-agnostic TypeScript API client package for CAVI Control mobile and portal surfaces.

This package is the shared boundary for HTTP clients, gateway RPC helpers, endpoint path contracts, domain DTOs, and UI-facing adapter helpers. Consumers should import from `@cavi/api-client` instead of reaching into host application packages or checkout-specific paths.

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the package boundary plan, including the migration away from baked product registries and portal-specific root exports.

## Runtime

- ESM package.
- Requires Node.js `>=20.0.0`.
- Uses the platform `fetch` by default. Pass `fetchImpl` when a runtime needs an explicit fetch implementation.

## Install

```sh
npm install @cavi/api-client
```

For workspace consumers, depend on the workspace package through the repo package manager configuration.

## Main Exports

- `BaseHttpApiClient` for shared HTTP behavior, headers, JSON parsing, tracing, timeouts, and errors.
- `CaviControlApiClient` for CAVI Control HTTP endpoints.
- `GatewayApiClient` and `createGatewayApiClient` for gateway-agnostic run and capability APIs.
- `GatewayMediaApiClient`, `createGatewayMediaClient`, `HermesMediaApiClient`, and `OpenClawMediaApiClient` for gateway-native audio, video, and music generation.
- `GatewayWikiApiClient`, `createGatewayWikiClient`, `HermesWikiApiClient`, and `OpenClawWikiApiClient` for gateway-native Obsidian/QMD wiki vault operations.
- `GatewaySseRunEventProvider`, `createGatewaySseRunEventProvider`, `GatewayWebSocketClient`, and `createGatewayWebSocketClient` for shared run-event SSE and WebSocket/RPC transports.
- `HermesApiClient` and Hermes run-stream helpers as provider-specific compatibility exports.
- `TeamRegistry`, `TEAM_REGISTRY_CONFIG`, `configureTeamRegistryConfig`, `createHermesTeamRegistry`, and `createOpenClawTeamRegistry` for runtime-loaded team registry config.
- `TeamManifest`, `normalizeTeamManifest`, `resolveTeamRoutePath`, `resolveTeamWorkspaceApiPath`, `resolveTeamWorkspacePath`, `resolveTeamActionContract`, and `resolveTeamActionApiPath` for agnostic team/member/workspace/action contracts.
- `LibraryApiClient` for library search, ingest, and document APIs.
- `PortalApiClient` for portal-scoped dashboard and relative portal API calls.
- `GatewayRpcClient`, gateway RPC helpers, and React hooks/providers from the package root.
- `createCaviControlAdapters` for UI data loaders backed by HTTP and optional gateway WebSocket RPC.
- Path contracts such as `CAVI_CONTROL_API_ENDPOINTS`, `GATEWAY_API_ENDPOINTS`, `LIBRARY_API_ENDPOINTS`, `SURFACE_CONTRACTS`, and `resolvePath`.
- Domain types and pure gateway transform helpers.
- Repo-root helpers: `resolveRepoRoot`, `requireRepoRoot`, `REPO_ROOT_ENV_KEY`.

## Basic HTTP Usage

```ts
import {
  CaviControlApiClient,
  createGatewayApiClient,
  LibraryApiClient,
} from "@cavi/api-client";

const auth = {
  bearerToken: process.env.CAVI_API_AUTH_TOKEN,
  clientId: "portal-client",
};

const cavi = new CaviControlApiClient({
  baseUrl: "https://control.example.com",
  auth,
});

const snapshot = await cavi.getOperatorSnapshot();

const gateway = createGatewayApiClient(
  {
    baseUrl: "https://gateway.example.com",
    auth,
  },
  { provider: "openclaw" },
);

const run = await gateway.startRun({
  input: "Summarize the latest operator state.",
  session_id: "operator-dashboard",
});

const library = new LibraryApiClient({
  baseUrl: "https://control.example.com",
  auth,
});

const results = await library.search({ q: "release notes", archived: false });
```

## Environment Configuration

Use `resolveHttpApiConfigFromEnv` when a caller wants consistent defaults and compatibility aliases.

```ts
import {
  CaviControlApiClient,
  LibraryApiClient,
  resolveHttpApiConfigFromEnv,
} from "@cavi/api-client";

const config = resolveHttpApiConfigFromEnv(process.env);

const cavi = new CaviControlApiClient({
  baseUrl: config.cavi.baseUrl,
  auth: {
    bearerToken: config.cavi.authToken,
    clientId: config.cavi.clientId,
  },
});

const library = new LibraryApiClient({
  baseUrl: config.library.baseUrl,
  auth: {
    bearerToken: config.library.authToken,
    clientId: config.library.clientId,
  },
});
```

Canonical environment keys:

- `CAVI_API_BASE_URL`
- `CAVI_API_AUTH_TOKEN`
- `CAVI_API_CLIENT_ID`
- `GATEWAY_API_BASE_URL`
- `GATEWAY_API_AUTH_TOKEN`
- `GATEWAY_API_CLIENT_ID`
- `LIBRARY_API_BASE_URL`
- `LIBRARY_API_AUTH_TOKEN`
- `LIBRARY_API_CLIENT_ID`

Alias keys for Expo and Vite clients are also supported by default. Pass `{ includeAliases: false }` to disable alias lookup. Hermes-specific env keys remain available through `resolveHermesHttpApiConfigFromEnv` from the Hermes provider exports.

## Gateway Providers

Prefer gateway-agnostic names in new code:

```ts
import {
  createGatewayApiClient,
  resolveGatewayProviderKind,
} from "@cavi/api-client";

const provider = resolveGatewayProviderKind({
  provider: settings.gatewayProvider,
  env: process.env,
});

const gateway = createGatewayApiClient(
  {
    baseUrl: config.gateway.baseUrl,
    auth: {
      bearerToken: config.gateway.authToken,
      clientId: config.gateway.clientId,
    },
  },
  { provider },
);
```

Provider resolution checks an explicit `provider` first, then `CAVI_GATEWAY_PROVIDER`, then `GATEWAY_PROVIDER`, and defaults to `gateway`. Supported provider values are `gateway`, `hermes`, and `openclaw`. Hermes-specific exports remain available for existing callers, but new shared code should use `GatewayApiClient`, `GatewayCapabilities`, `GatewayRunStatus`, `streamGatewayChatRun`, `GatewaySseRunEventProvider`, and `GatewayWebSocketClient` unless it is binding to provider-only behavior.

## Gateway Transports

HTTP, run-event SSE, and WebSocket/RPC follow the same shape: core owns the
base contract, while Hermes and OpenClaw provide thin adapters for
provider-specific headers, endpoint maps, or default client surfaces.

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

OpenClaw WebSocket clients and Hermes SSE clients should still be selected
through these provider-aware factories in shared frontend code.

## Gateway Media

Audio, video, and music are core gateway features. Use the media client instead
of product-specific shims when a frontend wants to render voice, video, songs,
loops, or other generated media.

```ts
import { createGatewayMediaClient } from "@cavi/api-client";

const media = createGatewayMediaClient(
  {
    baseUrl: config.gateway.baseUrl,
    auth: {
      bearerToken: config.gateway.authToken,
      clientId: config.gateway.clientId,
    },
  },
  { provider },
);

const providers = await media.listMediaProviders("audio");

const music = await media.generateMusic({
  input: "lofi loop for a research dashboard",
  format: "mp3",
  options: { bpm: 90 },
});

const asset = music.asset?.id
  ? await media.getMediaAsset(music.asset.id, { accept: "audio/mpeg" })
  : null;
```

The same interface is implemented by the generic gateway client plus
`HermesMediaApiClient` and `OpenClawMediaApiClient`. Provider-specific routing
stays behind `createGatewayMediaClient`.

## Gateway Wiki

Wiki operations are also core gateway features. Hermes and OpenClaw both expose
external wiki plugins as specialized Obsidian-style vaults backed by QMD. Use
the wiki client for ingest, compile, promote, tree/read, job polling, and
artifact download instead of product-specific vault shims.

```ts
import { createGatewayWikiClient } from "@cavi/api-client";

const wiki = createGatewayWikiClient(
  {
    baseUrl: config.gateway.baseUrl,
    auth: {
      bearerToken: config.gateway.authToken,
      clientId: config.gateway.clientId,
    },
  },
  { provider },
);

const vaults = await wiki.listWikiVaults();
const tree = await wiki.getWikiTree("research");
const page = await wiki.readWikiPage("research", "index.qmd");

const ingest = await wiki.ingestWiki("research", {
  path: "drafts/market-note.qmd",
  content: "# Market note",
  format: "qmd",
});

const compiled = await wiki.compileWiki("research", {
  path: "drafts/market-note.qmd",
  target: "html",
});

await wiki.promoteWiki("research", {
  sourcePath: "drafts/market-note.qmd",
  targetPath: "published/market-note.qmd",
});
```

Legacy `/api/obsidian/*` vault helpers remain compatibility routes. New shared
frontend code should prefer `GatewayWikiApiClient` and `createGatewayWikiClient`.

## Team Registry

Team and portal registry data is runtime config. The package exposes the
interface and normalizers, but it does not bake product team lists or library
team mappings into core modules.

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

Hermes and OpenClaw registry factories share the same config shape. Apps can
pass config directly to a factory or populate `TEAM_REGISTRY_CONFIG` after
loading the selected gateway/plugin registry document. Registry-dependent APIs
throw a clear error when config has not been loaded.

Legacy registry import paths such as `@cavi/api-client/team-registry` and
`@cavi/api-client/hermes/team-registry` are not exported. Use the package root,
`@cavi/api-client/cavi`, or provider exports such as
`@cavi/api-client/providers/hermes`.

## Team Manifest, Workspace Paths, And Actions

Prefer manifest-driven team config for new frontend compatibility surfaces.
The consumer owns team/member entries; this package owns the contract,
normalization, generated route grammar, workspace path whitelist checks, and
action override resolution.

```ts
import {
  configureTeamRegistryConfig,
  findTeamManifestTeam,
  normalizeTeamManifest,
  resolvePath,
  resolveTeamActionApiPath,
  resolveTeamActionContract,
  resolveTeamWorkspaceApiPath,
  type TeamManifest,
} from "@cavi/api-client";

const manifest = normalizeTeamManifest({
  version: 1,
  teams: [
    {
      id: "research",
      identity: {
        displayName: "Research",
        slug: "research",
        code: "RND",
        aliases: ["scout-school"],
      },
      workspace: {
        rootPath: "/teams/research/workspace-research",
        paths: [
          "research/complete",
          { key: "media.images", path: "media/images" },
        ],
      },
      actions: [
        {
          id: "summarize",
          input: {
            mode: "json",
            params: [{ key: "documentId", type: "string", required: true }],
          },
          output: { mode: "json", contentType: "application/json" },
        },
      ],
      members: [
        {
          id: "scout",
          capabilities: ["research.complete"],
          actions: [
            {
              id: "summarize",
              defaults: { tone: "brief" },
            },
          ],
        },
      ],
    },
  ],
} satisfies TeamManifest);

configureTeamRegistryConfig({ provider: "gateway", manifest });

resolvePath("team.kanban", "canonical", { teamId: "research" });
// /api/teams/research/kanban

resolvePath("team.agent.config", "canonical", {
  teamId: "research",
  agentId: "scout",
});
// /api/teams/research/agents/scout/config

const team = findTeamManifestTeam(manifest, "research");
if (!team) throw new Error("missing team");

resolveTeamWorkspaceApiPath(team, "media.images", { memberId: "scout" });
// /api/teams/research/agents/scout/workspace/media/images

const action = resolveTeamActionContract(manifest, "research", "summarize", {
  memberId: "scout",
});

resolveTeamActionApiPath(manifest, "research", action.id, { memberId: "scout" });
// /api/teams/research/agents/scout/actions/summarize
```

The workspace resolver accepts only paths declared in `workspace.paths`, so
custom folders such as `media/images` and `research/complete` do not require
new product-specific endpoint constants. Action contracts work the same way:
shared behavior lives on the manifest or team, and agent-specific differences
override only the fields they need. Responses should use the exported
`TeamActionResponse` union rather than custom per-agent response bodies. See
[`docs/team-manifest.md`](docs/team-manifest.md) and
[`docs/team-manifest.consumer.template.ts`](docs/team-manifest.consumer.template.ts)
for the consumer-side add/remove agent and override template.

## Requests, Headers, and Errors

All HTTP clients share the same request behavior:

- `Accept: application/json` is always sent.
- `Authorization: Bearer <token>` is sent when `auth.bearerToken` is present.
- `X-Portal-Client-Id` defaults to `cavi-api-client` unless `auth.clientId` is provided.
- `Idempotency-Key` is sent when a request receives an `idempotencyKey`.
- Request bodies are JSON-encoded and receive `Content-Type: application/json`.
- Non-2xx responses throw `HttpApiError` with `path`, `url`, `method`, `status`, and raw response `body`.
- Network failures, aborts, and invalid JSON responses are also surfaced as `HttpApiError`.

```ts
import { CAVI_CONTROL_API_ENDPOINTS, HttpApiError } from "@cavi/api-client";

try {
  await cavi.postJson(CAVI_CONTROL_API_ENDPOINTS.operator.tasks, { title: "Review" }, "task-1");
} catch (error) {
  if (error instanceof HttpApiError) {
    console.error(error.status, error.path, error.body);
  }
}
```

Pass `onTrace` to observe request timing without changing request behavior:

```ts
const client = new CaviControlApiClient({
  baseUrl: "https://control.example.com",
  onTrace: (trace) => {
    console.debug(trace.method, trace.path, trace.status, trace.durationMs);
  },
});
```

## Gateway RPC and React

The package exports the canonical gateway RPC client and React bindings.

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

React consumers must have React available in the application runtime.

## UI Data Adapters

`createCaviControlAdapters` builds dashboard loaders that combine gateway WebSocket RPC with HTTP fallbacks where appropriate.

```ts
import { createCaviControlAdapters } from "@cavi/api-client";

const adapters = createCaviControlAdapters({
  gatewayBaseUrl: "https://gateway.example.com",
  apiBaseUrl: "https://control.example.com",
  authToken: token,
  client: gatewayRpcClient,
});

const overview = await adapters.loadOverview();
const operator = await adapters.loadOperatorControl();
```

Pass `client: null` when only HTTP-backed loaders are available. Loaders that require an active gateway client will throw a clear connection error.

## Path Contracts

Route literals belong in path-owner files such as `src/paths.ts` and surface path contract files. Consumers should use exported path constants or `resolvePath` instead of recreating route strings.

Canonical surface routes are api-first: use `/api/plugins/<surface>/...` for plugin-backed surfaces. Legacy compatibility routes keep the old `/<surface>/api/...` shape only where existing clients or gateways still need them.

```ts
import {
  CAVI_CONTROL_API_ENDPOINTS,
  GATEWAY_API_ENDPOINTS,
  resolvePath,
} from "@cavi/api-client";

const taskPath = CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b");
const runPath = GATEWAY_API_ENDPOINTS.run("run/1");
const dashboardPath = resolvePath("portal.dashboard", "canonical", {
  portal: "research",
});
const frontDoorPath = resolvePath("frontDoor.ideaList", "canonical");
```

`src/endpoints.ts` exists only as a compatibility re-export of `src/paths.ts`.

## Repo Root Resolution

Filesystem integrations must receive an explicit repo root or resolve one from `REPO_ROOT`. This package must not assume a host checkout layout.

```ts
import { requireRepoRoot } from "@cavi/api-client";

const repoRoot = requireRepoRoot({
  repoRoot: options.repoRoot,
  env: process.env,
});
```

Resolution order:

1. Explicit `repoRoot`.
2. `env.REPO_ROOT`.
3. Explicit `globalRepoRoot`.
4. `globalThis.__CAVI_REPO_ROOT__`.
5. `process.env.REPO_ROOT`.

## Compatibility Guidance

- Prefer gateway-agnostic names such as `GatewayApiClient`, `GATEWAY_API_ENDPOINTS`, and `GatewayRunStatus` for new code.
- Hermes-specific exports remain available for compatibility with existing callers.
- Keep provider-specific behavior behind shared client interfaces or provider-specific modules.
- Add new API paths in path-owner files, not inside clients, React adapters, or mobile-specific code.

## Development

```sh
npm test
npm run build
```

Use `npm test` for package guardrails and API behavior. Run `npm run build` before publishing or linking a changed package.
