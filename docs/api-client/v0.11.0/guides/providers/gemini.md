---
documentedVersion: 0.11.0
---

# Gemini

Use `@cavi-ai/api-client/providers/gemini/runtime` for runtime execution and
`@cavi-ai/api-client/providers/gemini/files` for file operations. The broader
`@cavi-ai/api-client/providers/gemini` entry remains available for
compatibility.

This implementation mirrors Google-owned Gemini API behavior and requires
credentials accepted by that upstream service. Keep credentials in a trusted
backend rather than a browser or mobile bundle.

Model selection, file handling, and batch availability follow the upstream API
and the release-specific adapter. Check capabilities and consult the generated
reference pages before relying on an optional surface.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
