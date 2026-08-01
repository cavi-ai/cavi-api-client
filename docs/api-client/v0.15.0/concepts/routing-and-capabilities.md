---
documentedVersion: 0.15.0
---

# Routing and capabilities

Use a provider registry to select an implementation by provider kind. Then call `getRuntimeCapabilities()` and gate optional work with `runtimeSupports` and the method itself. See [registry routing](../examples/runtime-registry.ts) and [capability gating](../examples/runtime-capabilities.ts).

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
