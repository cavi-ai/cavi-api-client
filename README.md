<h1 align="center">
  <img src="docs/brand/logo-wordmark.png" alt="cavi-ai/api-client" width="440">
</h1>

<p align="center">
  <strong>One TypeScript client for every agent runtime. 🛰️</strong><br>
  Build against <code>RuntimeClient</code>, discover capabilities at runtime, and
  keep provider and transport details at the application boundary.
  <strong>Swap providers, not your code.</strong>
</p>

<p align="center">
  <strong><a href="https://cavi-ai.xyz/docs/api-client">Read the online documentation</a></strong>
</p>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml/badge.svg)](https://github.com/cavi-ai/cavi-api-client/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Types](https://img.shields.io/badge/types-included-blue)
![ESM](https://img.shields.io/badge/module-ESM-blueviolet)

<p align="center">
  <img src="docs/assets/api-client-hero.svg" alt="@cavi-ai/api-client provider-agnostic architecture diagram" width="100%">
</p>

`@cavi-ai/api-client` is a provider-agnostic TypeScript package for agent
runtimes. Every implementation exposes the same core run contract. Optional
features such as streaming, cancellation, batch processing, gateway resources,
and runtime control are discovered through capabilities instead of assumptions.

This package mirrors provider and gateway APIs for its consumers. Upstream
runtimes remain the owners of their wire protocols.

## Install

```sh
npm install @cavi-ai/api-client
```

The package is ESM, includes TypeScript declarations, has no runtime
dependencies, and supports Node.js 20 or a compatible runtime with the required
web APIs. React bindings are an optional peer dependency.

## Use the universal contract

Application logic can depend only on `RuntimeClient`. Provider selection,
credentials, base URLs, and concrete transports stay in composition code.

```ts
import {
  runtimeSupports,
  type RuntimeClient,
  type RuntimeRunStartBody,
} from "@cavi-ai/api-client";

export async function runTask(
  client: RuntimeClient,
  request: RuntimeRunStartBody,
) {
  const capabilities = await client.getRuntimeCapabilities();

  if (runtimeSupports(capabilities, "streaming") && client.streamRun) {
    return client.streamRun(request, {
      onEvent: (event) => console.log(event),
    });
  }

  return client.startRun(request);
}
```

Choose and configure a concrete implementation outside this function. See
[Providers and setup](docs/guides/providers.md) for the available adapters and
their configuration requirements.

## What the package provides

- A universal `RuntimeClient` contract for capabilities, runs, streaming, and
  optional batch operations.
- A `GatewayClient` tier for gateway-owned resources such as teams, kanban,
  workspace, media, wiki, and operator surfaces.
- Provider registries and factories for runtime selection without branching in
  application logic.
- Typed HTTP, SSE, WebSocket, JSON-RPC, framing, lifecycle, and error
  infrastructure.
- Capability-aware React bindings and conformance helpers for consumers and
  third-party provider adapters.
- CAVI extension adapters that remain outside the provider-neutral core.

Provider-specific behavior is isolated in provider modules. Core interfaces,
configuration, and routing do not make one provider the default.

## Documentation

- [Online documentation](https://cavi-ai.xyz/docs/api-client) — guides,
  concepts, and the browsable API reference.
- [API reference index](API.md) — operation and generated type references.
- [Exports and import paths](docs/guides/exports.md) — root and subpath entry
  points.
- [Providers and setup](docs/guides/providers.md) — selecting and configuring
  runtime and gateway adapters.
- [Claude integrations](docs/guides/claude.md) — Messages API and Managed
  Agents documentation.
- [Architecture](ARCHITECTURE.md) — package boundaries, ownership, and
  transport design.
- [Migration guide](MIGRATION.md) — supported import migrations.
- [Development and release verification](docs/guides/development.md) — local
  checks and documentation artifacts.
- [Changelog](CHANGELOG.md) — released and unreleased changes.

The immutable documentation artifact for the currently committed stable docs is
under [`docs/api-client/v0.11.0`](docs/api-client/v0.11.0). Its manifest records
the exact packed declaration surface used to generate it. Repository docs may
describe later released or unreleased work; the versioned artifact does not.

## Capability-first behavior

Optional methods are only usable when the selected provider both advertises the
capability and implements the method. Callers should gate optional operations
with `runtimeSupports` and a method-presence check, as shown above.

Unsupported features fail truthfully or return the documented typed degradation
shape. The package does not silently claim that every runtime supports every
surface.

## Security

Keep provider credentials in trusted application infrastructure. Provider
modules accept their own authentication configuration; the universal runtime
contract does not require or expose a particular provider's credential scheme.
Errors and diagnostic metadata redact secret-bearing fields.

Report vulnerabilities through [SECURITY.md](SECURITY.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow, public API
rules, provider-author guidance, and required verification gates. Participation
is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
