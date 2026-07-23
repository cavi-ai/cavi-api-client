---
documentedVersion: 0.13.0
---

# Testing

Use the stable `testing` subpath for conformance helpers. Keep tests focused on consumed `RuntimeClient` behavior, and use [capability gating](../examples/runtime-capabilities.ts) for optional surfaces.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
