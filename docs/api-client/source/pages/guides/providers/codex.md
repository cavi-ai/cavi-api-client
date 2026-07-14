---
documentedVersion: 0.11.0
---

# Codex

Use `@cavi-ai/api-client/providers/codex/runtime` for runtime execution and
`@cavi-ai/api-client/providers/codex/files` for file operations. The broader
`@cavi-ai/api-client/providers/codex` entry remains available for
compatibility.

The hosted implementation mirrors OpenAI-owned Responses, Files, and Batch API
behavior where supported. It requires credentials accepted by that upstream
service. Keep those credentials in a trusted backend.

Hosted Responses behavior is distinct from local Codex application-server
protocols. Select the adapter that matches the runtime actually being used and
check its advertised capabilities.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
