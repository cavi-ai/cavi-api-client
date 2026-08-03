---
documentedVersion: {{documentedVersion}}
---

# Quickstart

Install `@cavi-ai/api-client@{{documentedVersion}}`, set `OPENAI_API_KEY` in the trusted server environment, and run the compile-checked [complete request example](../examples/runtime-node.ts). The example configures a Codex client, starts one background text request, and polls `getRun` until the status is terminal. A successful result has `status: "completed"` and the generated sentence in `output`; failed or cancelled requests return their corresponding terminal status instead.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
