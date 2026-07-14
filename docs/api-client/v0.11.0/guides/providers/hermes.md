---
documentedVersion: 0.11.0
---

# Hermes

Use `@cavi-ai/api-client/providers/hermes` for the complete gateway adapter or
`@cavi-ai/api-client/providers/hermes/runtime` for the narrow runtime entry.

Hermes is a gateway-style provider. It can expose runtime execution plus
gateway resources when the connected Hermes deployment supports them. Supply
the deployment URL and its gateway authentication through application-owned
configuration; the client does not provision or own the runtime.

Check capabilities before using optional surfaces. See the generated
`providers/hermes` and `providers/hermes/runtime` reference pages for the
release-specific constructors and types.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
