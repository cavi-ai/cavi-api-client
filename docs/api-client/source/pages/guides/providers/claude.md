---
documentedVersion: 0.11.0
---

# Claude

Use `@cavi-ai/api-client/providers/claude/messages` for the Messages runtime
or `@cavi-ai/api-client/providers/claude/managed-agents` for the separate
managed-agent surface. The broader `@cavi-ai/api-client/providers/claude`
entry remains available for compatibility.

These implementations call Anthropic-owned services and therefore require
credentials accepted by the selected upstream API. Keep credentials in a
trusted backend and pass them through the provider's documented constructor;
never embed them in browser or mobile bundles.

Messages and managed agents have different lifecycle semantics. Consult their
generated reference pages and do not assume that a capability exposed by one
surface exists on the other.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
