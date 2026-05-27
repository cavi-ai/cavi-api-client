<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="cavi-ai/api-client" width="440">
</h1>

<p align="center">
  <strong>A gateway-agnostic TypeScript client for agent runtimes.</strong><br>
  HTTP, WebSocket RPC, SSE, media, wiki, team routing, React hooks, and typed data adapters behind one package boundary.
</p>

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

## Contents

- [Why This Package Exists](#why-this-package-exists)
- [Runtime](#runtime)
- [Exports](#exports)
- [Quick Start](#quick-start)
- [Core Concepts](#core-concepts)
  - [One Client Shape](#one-client-shape)
  - [Typed Errors](#typed-errors)
  - [Graceful Degradation](#graceful-degradation)
  - [Route Ownership](#route-ownership)
  - [Team Manifest](#team-manifest)
- [Common Surfaces](#common-surfaces)
  - [HTTP](#http)
  - [WebSocket RPC](#websocket-rpc)
  - [Run Event Streams](#run-event-streams)
  - [Media And Wiki](#media-and-wiki)
  - [React](#react)
  - [CAVI Extension Adapters](#cavi-extension-adapters)
- [Secure Credential Handling](#secure-credential-handling)
- [Development](#development)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Why This Package Exists

Agent applications need the same client plumbing again and again: authenticated
JSON requests, WebSocket RPC, run-event streams, capability snapshots, route
contracts, typed errors, and graceful fallback behavior. `@cavi-ai/api-client`
keeps that plumbing in one reusable package so application code can focus on the
workflow.

The core is gateway-agnostic. Provider modules customize only the parts that are
actually different, such as endpoint maps, headers, or method transport. The
shared transports, error handling, stream parsing, and trace behavior stay in
one place.

## Runtime

- Pure TypeScript ESM with generated `.d.ts` files.
- Node.js `>=20`, or any modern runtime with `fetch` and `WebSocket`.
- Zero runtime dependencies.
- React is an optional peer dependency used only by
  `@cavi-ai/api-client/frameworks/react`.
- `fetchImpl` can be supplied anywhere a runtime needs an explicit fetch
  implementation.

## Exports

The root export contains the common client APIs. Subpath exports let consumers
import only the slice they need:

- `@cavi-ai/api-client/core/http`
- `@cavi-ai/api-client/core/data`
- `@cavi-ai/api-client/core/errors`
- `@cavi-ai/api-client/core/runtime`
- `@cavi-ai/api-client/core/sse`
- `@cavi-ai/api-client/core/ws`
- `@cavi-ai/api-client/core/gateway`
- `@cavi-ai/api-client/core/env`
- `@cavi-ai/api-client/contracts`
- `@cavi-ai/api-client/extensions/cavi`
- `@cavi-ai/api-client/providers/hermes`
- `@cavi-ai/api-client/providers/openclaw`
- `@cavi-ai/api-client/frameworks/react`

## Quick Start

```ts
import { createGatewayApiClient } from "@cavi-ai/api-client";

const gateway = createGatewayApiClient({
  baseUrl: process.env.GATEWAY_API_BASE_URL!,
  auth: {
    bearerToken: process.env.GATEWAY_API_AUTH_TOKEN,
    clientId: "dashboard",
  },
});

const run = await gateway.startRun({
  input: "Summarize the current workspace state.",
  session_id: "dashboard",
});
// run.id / run.status are your handle for polling, streaming, or UI state.
// Failures are typed — see Typed Errors below for how to branch on them.
```

## Core Concepts

### One Client Shape

`GatewayApiClient` exposes the common run and capability methods. Built-in
provider modules can be registered through `createGatewayApiClient`, and
third-party modules use the same `GatewayProviderModule` interface.

```ts
import {
  GatewayApiClient,
  createGatewayApiClient,
  createGatewayProviderRegistry,
} from "@cavi-ai/api-client";
import type { GatewayProviderModule } from "@cavi-ai/api-client/core/gateway";

const provider: GatewayProviderModule = {
  kind: "acme",
  aliases: ["acme-gateway"],
  createApiClient: (options) => new GatewayApiClient(options, "acme-api"),
};

const registry = createGatewayProviderRegistry({ modules: [provider] });
const client = createGatewayApiClient(config.gateway, {
  provider: "acme-gateway",
  registry,
});
```

Provider modules should reuse core transports. They should not fork JSON request
handling, RPC flow, SSE parsing, trace redaction, or error normalization.

### Typed Errors

Every failure is one of the package's typed classes — `HttpApiError` (non-2xx,
network failure, abort, invalid JSON), `GatewayHttpError` (gateway HTTP detail),
`GatewayRpcError` (WebSocket RPC rejection), or `ApiClientError` (synthesized
config/validation/transport). Branch on a guard, never on `error.message`, and
never re-wrap a failure in a generic `Error`.

```ts
import {
  getErrorStatus,
  isAbortError,
  isAuthError,
  isHttpApiError,
} from "@cavi-ai/api-client";

try {
  await cavi.getOperatorSnapshot();
} catch (error) {
  if (isAbortError(error)) return;          // request was cancelled
  if (isAuthError(error)) return signOut(); // 401/403 across HTTP error classes
  if (getErrorStatus(error) === 404) return markUnavailable();
  if (isHttpApiError(error)) {
    reportError({ status: error.status, path: error.path, body: error.body });
  }
  throw error; // unknown shape: never swallow it
}
```

`isAuthError` covers both `HttpApiError` and `GatewayHttpError`; `getErrorStatus`
returns the numeric HTTP status or `undefined`. Lower-level helpers
(`getErrorMessage`, `serializeError`, `toError`, and the `ApiClientErrorType` /
`ApiClientErrorCode` enums) remain available from `core/errors`.

> **Antipattern:**
>
> ```ts
> // ❌ Message matching breaks on rewording/localization and swallows real failures.
> catch (e: any) {
>   if (e.message.includes("401")) signOut();
>   else console.log("request failed");
> }
> // ❌ Re-wrapping erases status, path, body, and the cause chain.
> throw new Error("snapshot failed");
> ```

### Graceful Degradation

Gateway loaders can return a typed `DataEnvelope<T>`:

```ts
type DataEnvelope<T> = {
  data: T;
  source: "gateway" | "mock";
  fetchedAt: number;
  contractGaps: ContractGap[];
};
```

`withFallback` and `withMutationResult` keep expected backend gaps visible
without crashing an entire dashboard. Auth failures and unknown errors still
throw.

### Route Ownership

Route literals belong in owner files:

- Global contracts: `src/contracts/paths.ts` and `src/contracts/surfaces.ts`.
- CAVI extension contracts:
  `src/extensions/cavi/contracts/paths.ts` and
  `src/extensions/cavi/contracts/surfaces.ts`.

Consumers should use exported constants and resolvers such as `resolvePath`,
`resolveCaviPath`, `appendHttpQuery`, and extension-specific helpers. Avoid
assembling paths by hand in clients, components, or adapters.

### Team Manifest

Team, member, workspace, and action routing is runtime configuration. The
package owns the manifest schema, normalization, lookup validation, generated
route grammar, and workspace path whitelist. Applications own the actual team
data.

```ts
import {
  configureTeamRegistryConfig,
  normalizeTeamManifest,
  resolveTeamWorkspaceApiPath,
  type TeamManifest,
} from "@cavi-ai/api-client";

const manifest = normalizeTeamManifest({
  version: 1,
  teams: [
    {
      id: "research",
      identity: { displayName: "Research", slug: "research", code: "RND" },
      workspace: {
        rootPath: "/teams/research/workspace",
        paths: ["reports", { key: "media.images", path: "media/images" }],
      },
      members: [{ id: "analyst", capabilities: ["research.read"] }],
    },
  ],
} satisfies TeamManifest);

configureTeamRegistryConfig({ provider: "gateway", manifest });

const team = manifest.teams[0]!;
const path = resolveTeamWorkspaceApiPath(team, "media.images", {
  memberId: "analyst",
});
```

See [docs/team-manifest.md](docs/team-manifest.md) and
[docs/team-manifest.consumer.template.ts](docs/team-manifest.consumer.template.ts)
for consumer-owned manifest examples.

## Common Surfaces

### HTTP

```ts
import { CaviControlApiClient, resolveHttpApiConfigFromEnv } from "@cavi-ai/api-client";

const config = resolveHttpApiConfigFromEnv(process.env);
const cavi = new CaviControlApiClient({
  baseUrl: config.cavi.baseUrl,
  auth: {
    bearerToken: config.cavi.authToken,
    clientId: config.cavi.clientId,
  },
});
```

Canonical environment keys:

- `CAVI_API_BASE_URL`, `CAVI_API_AUTH_TOKEN`, `CAVI_API_CLIENT_ID`
- `GATEWAY_API_BASE_URL`, `GATEWAY_API_AUTH_TOKEN`, `GATEWAY_API_CLIENT_ID`
- `LIBRARY_API_BASE_URL`, `LIBRARY_API_AUTH_TOKEN`, `LIBRARY_API_CLIENT_ID`

Alias keys for common web and mobile app runtimes are supported by default.
Pass `{ includeAliases: false }` to disable aliases.

### WebSocket RPC

```ts
import { createGatewayWebSocketClient } from "@cavi-ai/api-client";

const ws = createGatewayWebSocketClient(target.wsUrl, authToken, {
  clientId: "dashboard",
  requestedScopes: ["operator.read"],
});

await ws.connect();
const sessions = await ws.request<{ sessions: unknown[] }>("sessions.list", {
  limit: 20,
});
```

### Run Event Streams

```ts
import { createGatewaySseRunEventProvider } from "@cavi-ai/api-client";

const stream = createGatewaySseRunEventProvider({
  httpBase: config.gateway.baseUrl,
  authToken: config.gateway.authToken,
  clientId: config.gateway.clientId,
  sessionKey: "dashboard",
});

// Keep the subscription handle so you can `subscription.unsubscribe()` on unmount.
const subscription = await stream.subscribe(
  { runId: "run-123" },
  {
    onEvent: (event) => appendRunEvent(event),
    onError: (error) => reportError(error),
    onComplete: () => markRunComplete(),
  },
);
```

### Media And Wiki

```ts
import {
  createGatewayMediaClient,
  createGatewayWikiClient,
} from "@cavi-ai/api-client";

const media = createGatewayMediaClient({ baseUrl, auth });
const image = await media.generateImage({
  input: "diagram of a workflow",
  format: "png",
});

const wiki = createGatewayWikiClient({ baseUrl, auth });
const page = await wiki.readWikiPage("default", "index.qmd");
```

### React

```tsx
import {
  GatewayClientProvider,
  useGatewayClientContext,
} from "@cavi-ai/api-client/frameworks/react";

function App() {
  return (
    <GatewayClientProvider
      gatewayBaseUrl={gatewayBaseUrl}
      authToken={authToken}
      clientId="portal"
      autoReconnect
    >
      <Panel />
    </GatewayClientProvider>
  );
}

function Panel() {
  const { client, state, connect } = useGatewayClientContext();
  return <button onClick={() => void connect()}>{state}</button>;
}
```

### CAVI Extension Adapters

`extensions/cavi` contains product-shaped composition over the generic core.
The extension owns CAVI-specific DTOs, adapters, fallback providers, and route
contracts while still using shared transports and error handling.

```ts
import { createCaviControlAdapters } from "@cavi-ai/api-client";

const adapters = createCaviControlAdapters({
  gatewayBaseUrl,
  apiBaseUrl,
  authToken,
  client: gatewayRpcClient,
  fallbackMode: "empty",
});

const overview = await adapters.loadOverview();
```

## Secure Credential Handling

The client never persists credentials — applications pass `auth.bearerToken` and
own storage. On devices that means the OS keychain/keystore or an encrypted
store, **never** plaintext `AsyncStorage` or `localStorage`. Keep the client
storage-agnostic behind one interface:

```ts
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}
```

`expo-secure-store` (Keychain / Keystore) and `react-native-mmkv` (encrypted
instance) are drop-in backends:

```ts
import * as SecureStore from "expo-secure-store";
import { MMKV } from "react-native-mmkv";

const KEY = "cavi.gateway.bearer";

export const secureStoreTokens: TokenStore = {
  get: () => SecureStore.getItemAsync(KEY),
  set: (token) =>
    SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  clear: () => SecureStore.deleteItemAsync(KEY),
};

const storage = new MMKV({ id: "cavi-auth", encryptionKey: deviceEncryptionKey });
export const mmkvTokens: TokenStore = {
  get: async () => storage.getString(KEY) ?? null,
  set: async (token) => storage.set(KEY, token),
  clear: async () => storage.delete(KEY),
};
```

Build the client from the stored token and refresh only on a typed auth
failure — `isAuthError` covers `HttpApiError` and `GatewayHttpError`, so you
never re-check `.status` by hand:

```ts
import { CaviControlApiClient, isAuthError } from "@cavi-ai/api-client";

async function withFreshAuth<T>(
  tokens: TokenStore,
  call: (client: CaviControlApiClient) => Promise<T>,
): Promise<T> {
  const build = async () =>
    new CaviControlApiClient({
      baseUrl: config.cavi.baseUrl,
      auth: { bearerToken: (await tokens.get()) ?? undefined, clientId: "cavi-mobile" },
    });
  try {
    return await call(await build());
  } catch (error) {
    if (!isAuthError(error)) throw error; // only refresh on 401/403
    await tokens.set(await refreshAccessToken());
    return call(await build());
  }
}
```

Avoid logging raw request headers, auth tokens, or full error bodies; trace
helpers redact sensitive values before emitting previews.

> **Antipattern:**
>
> ```ts
> // ❌ Plaintext token on disk — readable by backups, other apps, rooted devices.
> await AsyncStorage.setItem("token", token);
> localStorage.setItem("token", token);
> ```

## Development

```sh
pnpm install
pnpm test
pnpm run build
pnpm run lint:md
pnpm run verify
```

Strict TypeScript is the lint gate. Relative source imports use `.js`
extensions. Tests live under `src/__tests__/**`.

The hardening tests in
[`src/__tests__/package-hardening.test.ts`](src/__tests__/package-hardening.test.ts)
enforce package boundaries, path ownership, forbidden imports, and output shape.
Update them only when the package boundary intentionally changes.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow, provider-author guidance,
and boundary rules.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
