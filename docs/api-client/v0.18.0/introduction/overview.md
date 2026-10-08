---
documentedVersion: 0.18.0
---

# Build an application across agent runtimes

An agent application needs to start work, show progress, handle failures, and
clean up connections. Different runtimes expose different APIs for those jobs.
`@cavi-ai/api-client` supplies common run and stream shapes plus provider
adapters, so your workflow code can depend on a stable client interface.

Use the package for an agent UI, a gateway integration, or a service that lets
users choose a runtime. It is an ESM TypeScript library with no runtime
dependencies. React bindings are optional.

## Get a useful result

1. [Install](installation.md) and keep credentials on a trusted backend.
2. [Run the quickstart](quickstart.md) to print your first generated response.
3. [Choose a provider](../guides/providers.md) for your deployment.
4. [Stream output](../guides/streaming.md) and [handle failures](../guides/errors.md).
5. [Retrieve and cancel runs](../guides/requests.md) when the provider has a
   server-side lifecycle.

Start with `createApiClient`, the application facade. It exposes the same
accessors across providers and returns either a live result or a structured
capability gap. Authentication and unclassified errors still throw.

## What stays provider-specific

Credentials, model access, tool definitions, and run persistence belong to the
selected provider. A common interface does not make these interchangeable:
Claude Messages returns a terminal result, Codex can return a background run,
and gateways add resources that runtime-only providers do not supply.

Use [capabilities](../concepts/routing-and-capabilities.md) to make those
differences visible in your application. Unsupported operations do not receive
invented successful results.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
