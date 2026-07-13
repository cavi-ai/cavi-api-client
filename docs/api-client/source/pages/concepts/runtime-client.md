---
documentedVersion: 0.11.0
---

# Runtime client

`RuntimeClient` is the common v0.11.0 interface. Every implementation supports capability discovery and `startRun`; retrieval, cancellation, streaming, and batch methods are optional. See the [request example](../../../../examples/runtime-node.ts).

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
