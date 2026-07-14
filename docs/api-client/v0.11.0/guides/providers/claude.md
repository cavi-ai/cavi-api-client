---
documentedVersion: 0.11.0
---

# Claude

Choose the guide for the upstream surface being integrated:

- [Messages](claude-messages.md) — stateless runtime execution, streaming, and
  optional message batches.
- [Managed Agents](claude-managed-agents.md) — persisted agents, environments,
  sessions, steering, and server-sent events.

The broader `@cavi-ai/api-client/providers/claude` entry remains available for
compatibility. New code should prefer the focused entry documented by each
guide.

These implementations call Anthropic-owned services and therefore require
credentials accepted by the selected upstream API. Keep credentials in a
trusted backend and pass them through the provider's documented constructor;
never embed them in browser or mobile bundles.

Messages and Managed Agents have different lifecycle semantics. Do not assume
that a capability exposed by one surface exists on the other.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
