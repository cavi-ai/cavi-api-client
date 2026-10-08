---
documentedVersion: 0.18.0
---

# Keep your application independent of its agent runtime

A runtime selector should change backend configuration, not your progress
renderer and every job handler. `@cavi-ai/api-client` translates provider APIs
into common run states, stream events, token usage, and capability results.

## What you can build

| Application need | Start with |
| --- | --- |
| Return an answer from a server | [Answer service](quickstart.md) and [server handler](../guides/server.md) |
| Show text and tool progress while work runs | [Streaming](../guides/streaming.md) |
| Resume a background job after the initiating request | [Run retrieval](../guides/requests.md) |
| Process many inputs and correlate individual outcomes | [Batch collection](../guides/batching.md) |
| Browse a gateway's sessions and workspace | [Gateway resources](../guides/gateway.md) |
| Show which actions the selected backend can perform | [Capability discovery](../concepts/routing-and-capabilities.md) |

The package is ESM with TypeScript declarations, no runtime dependencies,
and optional React gateway bindings.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

## Decide whether you need the abstraction

Use this client when several runtimes must feed the same application workflow,
or when a backend may change later. For one provider's native API without a
shared integration boundary, a direct provider SDK may be simpler.

Portability covers result/event shapes, not credentials, model names, native
tool schemas, or persistence. Claude Messages finishes within `startRun`;
Codex may return a background handle; gateways may expose sessions and
workspace resources that runtime-only providers do not have.

## Make the boundary explicit

Start with `createApiClient`, which returns the application
`CapabilityClient`. Discover support for feature visibility, then inspect
every call's `ok`. A successful call can still contain a failed run.
Authentication and unclassified failures remain exceptions.

Choose a [provider](../guides/providers.md), keep credentials on a trusted
backend, and let one application owner control the client's lifetime.
[Install](installation.md) · [Build your first service](quickstart.md) ·
[Facade versus raw runtime](../concepts/runtime-client.md)
