<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="@cavi-ai/api-client" width="440">
</h1>

<p align="center">
  <strong>One provider-neutral TypeScript client contract for agent runtimes and gateways.</strong>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Types](https://img.shields.io/badge/types-included-blue)
![ESM](https://img.shields.io/badge/module-ESM-blueviolet)

`@cavi-ai/api-client` provides stable client-side contracts for compatible
agent runtimes. It centralizes runtime execution, gateway resources, transports,
capability checks, typed errors, and optional framework bindings behind one
package boundary.

This package is a follower and compatibility mirror. Connected runtimes own
their protocols, routes, authentication requirements, and operational behavior.

## Install

```sh
npm install @cavi-ai/api-client
```

Requirements:

- Node.js 20 or a modern runtime with `fetch` and `WebSocket`
- ESM
- no runtime dependencies
- React only when using the optional React binding

## Quickstart

Construct a gateway client with the URL and authentication selected by your
application:

```ts
import { createGatewayApiClient } from "@cavi-ai/api-client";

const gateway = createGatewayApiClient({
  baseUrl: process.env.AGENT_GATEWAY_URL!,
  auth: {
    bearerToken: process.env.AGENT_GATEWAY_TOKEN,
    clientId: "dashboard",
  },
});

const capabilities = await gateway.getRuntimeCapabilities();

if (capabilities.supports.runs) {
  const run = await gateway.startRun({
    input: "Summarize the current workspace state.",
    session_id: "dashboard",
  });

  console.log(run.run_id, run.status);
}
```

The gateway determines which runtime implementation serves the request. The
application code depends on the universal client contract, not an upstream
vendor SDK.

## Package model

The package has two universal client tiers:

- `RuntimeClient` covers capabilities, runs, streaming, usage, dry runs, and
  optional batch operations.
- `GatewayClient` extends the runtime contract with gateway-owned resources
  such as teams, workspace data, kanban, media, wiki, and operator surfaces.

Optional behavior is capability-gated. Unsupported operations remain explicit
instead of being simulated by an unrelated implementation.

Published APIs are additive within the current release line. Import universal
contracts from the package root and implementation-specific or low-level
surfaces from documented subpaths.

## Documentation

Start with the page that matches the work:

- [Overview](docs/api-client/source/pages/introduction/overview.md)
- [Installation](docs/api-client/source/pages/introduction/installation.md)
- [Quickstart](docs/api-client/source/pages/introduction/quickstart.md)
- [Runtime client](docs/api-client/source/pages/concepts/runtime-client.md)
- [Providers and transports](docs/api-client/source/pages/concepts/providers-and-transports.md)
- [Routing and capabilities](docs/api-client/source/pages/concepts/routing-and-capabilities.md)
- [Compatibility](docs/api-client/source/pages/concepts/compatibility.md)
- [Imports and exports](docs/api-client/source/pages/guides/imports-and-exports.md)
- [Provider implementation guides](docs/api-client/source/pages/guides/providers/index.md)
- [Requests](docs/api-client/source/pages/guides/requests.md)
- [Streaming](docs/api-client/source/pages/guides/streaming.md)
- [Files](docs/api-client/source/pages/guides/files.md)
- [Batching](docs/api-client/source/pages/guides/batching.md)
- [Manifests](docs/api-client/source/pages/guides/manifests.md)
- [React](docs/api-client/source/pages/guides/react.md)
- [Testing](docs/api-client/source/pages/guides/testing.md)

Reference and project documentation:

- [API reference](API.md)
- [Architecture](ARCHITECTURE.md)
- [Migration guide](MIGRATION.md)
- [Changelog](CHANGELOG.md)
- [Versioned documentation artifact](docs/api-client/v0.11.0)
- [Documentation consumer contract](docs/api-client/CONSUMER.md)

The source pages are the editable documentation. The versioned artifact is
generated and immutable. Verify that they agree with:

```sh
pnpm docs:check
```

## Development

```sh
pnpm install
pnpm run verify
```

`pnpm run verify` runs the package tests, documentation type checks,
TypeScript build, generated-documentation drift check, Markdown lint, and
package dry run. A change is not complete until this command passes.

## Project

- [Contributing](CONTRIBUTING.md)
- [Code of conduct](CODE_OF_CONDUCT.md)
- [Security](SECURITY.md)
- [Contributors](CONTRIBUTORS.md)
- [MIT license](LICENSE)
