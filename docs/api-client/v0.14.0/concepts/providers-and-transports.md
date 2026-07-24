---
documentedVersion: 0.14.0
---

# Providers and transports

Provider modules adapt upstream services to `RuntimeClient`; see [provider selection](../examples/runtime-registry.ts). Standalone `core/transport` and `core/transport/node` subpaths are packed in v0.12.0, so transport factories can be imported directly from the published release rather than reached through a provider module.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
