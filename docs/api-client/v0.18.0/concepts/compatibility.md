---
documentedVersion: 0.18.0
---

# Compatibility boundaries

These pages describe `@cavi-ai/api-client@0.18.0`, using the
declarations from a pinned package tarball. A symbol on a development branch is
not a released API unless the documented artifact includes it.

## What portability gives you

Run statuses, stream events, capability discovery, and the facade's result shape
are shared. Credentials, model names, native tools, persistence, and resource
availability remain provider-specific. Switching adapters requires compatible
configuration and request contents.

Messages-style providers remember terminal runs in client-local storage.
Codex, Managed Agents, and gateways have server-side lifecycle resources.
OpenCode uses scoped sessions. A remembered local run is not a durable backend
handle, and cancelling an already finished synchronous request cannot undo it.

## Upgrades

Pin your package version, review [migration guidance](../release/migration-and-support.md),
and exercise the workflows your application consumes against its target backend.
Beta integrations and OpenCode's pinned server contract require special attention.

Gemini is removed from the development package for the next major release.
Older published references retain their original declarations. Review the
repository migration guide before upgrading an existing Gemini integration;
AGY requires its own service URL and authentication.
