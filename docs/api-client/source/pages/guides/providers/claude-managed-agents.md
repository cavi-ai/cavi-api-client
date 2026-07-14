---
documentedVersion: 0.11.0
---

# Claude Managed Agents

Use `@cavi-ai/api-client/providers/claude/managed-agents` for the focused
Managed Agents entry. This is a separate stateful surface for persisted agents,
containerized environments, sessions, messages, steering, and server-sent
events.

The broader `@cavi-ai/api-client/providers/claude` entry remains available for
compatibility.

## Configuration

Construct the client in trusted backend code with credentials accepted by the
upstream service. Keep credentials out of browser and mobile bundles. The
client mirrors the upstream lifecycle; it does not provision credentials or
redefine upstream ownership.

## Lifecycle

1. Create or select an agent.
2. Create or select an environment when the workflow needs one.
3. Create a session bound to the required agent and environment.
4. Send messages or steering input.
5. Subscribe to session events and handle terminal states explicitly.

Managed Agents are not interchangeable with the stateless
[Messages](claude-messages.md) runtime. Consult the generated
`providers/claude/managed-agents` API reference for the exact
release-specific clients, request types, and event contracts.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
