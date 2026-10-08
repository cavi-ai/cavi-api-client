---
documentedVersion: {{documentedVersion}}
---

# Providers and transports

A provider adapter maps authentication, requests, responses, and events to the
shared contracts. A transport moves bytes. Selecting a transport does not
create support for a provider operation.

## Runtime-only providers

Claude Messages, Claude Managed Agents, Codex, AGY, OpenCode, and the legacy
Gemini adapter implement the execution contract. Configure credentials in their
provider modules, register those modules, and pass the registry to the factory.
The default registry contains only Hermes and OpenClaw.

## Gateway providers

Hermes and OpenClaw add resources and a control plane. The facade configures
their backends from the gateway URL and authentication. Streaming is bridged
over Hermes SSE run events or OpenClaw WebSocket frames.

Use [provider setup](../guides/providers.md) for required session fields,
gateway scopes, and the limits of each integration.

## Direct transports

The public `core/transport` entry provides HTTP, SSE, WebSocket, and JSON-RPC
factories. `core/transport/node` adds Node-only stdio and Unix sockets.
These are infrastructure for adapter authors, not ready-made runtime providers.

Reconnect behavior does not replay pending writes. If the connection fails
after a submission, reconcile the upstream state before deciding whether a new
request is safe. See [failure handling](../guides/errors.md).
