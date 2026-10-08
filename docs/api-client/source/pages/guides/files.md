---
documentedVersion: {{documentedVersion}}
---

# Use provider-specific files

There is no provider-neutral files API in this release. File IDs, uploads,
retention, and how files are referenced in prompts belong to the provider.

Use the Codex `providers/codex/files` or Gemini
`providers/gemini/files` subpath. The [narrow-import example](../examples/narrow-imports.ts)
shows their public imports. Consult the generated
[Codex file reference](../reference/providers-codex-files.md) or
[Gemini file reference](../reference/providers-gemini-files.md) for the exact
upload, retrieval, and deletion shapes.

Keep credentials on your backend. Upload with the provider's required purpose
and content type, retain the returned resource identity, and explicitly clean
up resources when your application no longer needs them. Do not reuse a file ID
from one backend on another.

Gemini resumable uploads stay on the configured API origin, reject redirects,
and honor cancellation/timeout options. Failures report a status-only
`ApiClientError`; raw response bodies are not retained in its cause.

For batch input/output files, follow [batch processing](batching.md). Local
workspace access is a different gateway capability; see [gateway resources](gateway.md).
