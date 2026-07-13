---
documentedVersion: 0.11.0
---

# Streaming

Streaming is optional in v0.11.0. Check `runtimeSupports(capabilities, "stream")` and `client.streamRun` before subscribing. The compile-checked [capability pattern](../../../../examples/runtime-capabilities.ts) demonstrates the same two-part guard.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
