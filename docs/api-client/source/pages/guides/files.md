---
documentedVersion: {{documentedVersion}}
---

# Files

There is no provider-neutral files API in v{{documentedVersion}}. Codex and Gemini expose provider-specific file subpaths; inspect the compile-checked [narrow imports](../examples/narrow-imports.ts).

Gemini resumable-upload failures report a status-only `ApiClientError`; raw
response bodies are not retained in the error or its cause.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
