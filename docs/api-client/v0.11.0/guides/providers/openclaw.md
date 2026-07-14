---
documentedVersion: 0.11.0
---

# OpenClaw

Use `@cavi-ai/api-client/providers/openclaw` for the complete gateway adapter
or `@cavi-ai/api-client/providers/openclaw/runtime` for the narrow runtime
entry.

OpenClaw is a gateway-style provider. Its adapter mirrors the connected
OpenClaw runtime's declared surfaces and transport behavior. Configure the
gateway URL, token, and any client identity in the consuming application.

Treat absent surfaces as unsupported and use capability checks before invoking
optional operations. OpenClaw remains the canonical owner of its runtime
protocol.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
