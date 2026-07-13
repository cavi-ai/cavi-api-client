---
documentedVersion: 0.11.0
---

# Providers and transports

Provider modules adapt upstream services to `RuntimeClient`; see [provider selection](../../../../examples/runtime-registry.ts). Standalone `core/transport` and `core/transport/node` subpaths are unavailable in v0.11.0. Do not import development-branch transport factories when targeting this release.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
