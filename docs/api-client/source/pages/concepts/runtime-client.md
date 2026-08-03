---
documentedVersion: {{documentedVersion}}
---

# Runtime client

`RuntimeClient` is the common v{{documentedVersion}} interface. Every implementation supports capability discovery and `startRun`; retrieval, cancellation, streaming, and batch methods are optional. Codex `startRun` starts a stored background response, so its initial normalized status can be `started` or `running`; use `getRun` to reach a terminal result as shown in the [request example](../examples/runtime-node.ts).

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
