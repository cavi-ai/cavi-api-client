---
documentedVersion: {{documentedVersion}}
---

# Requests

Use the compile-checked [Codex request](../examples/runtime-node.ts) as the complete server-side flow. Supply credentials through configuration, send a `RuntimeRunStartBody`, then poll the returned `run_id` while its normalized status is `started` or `running`. A successful terminal result has `status: "completed"` and provider output in `output`.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
