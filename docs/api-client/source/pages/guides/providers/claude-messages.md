---
documentedVersion: 0.11.0
---

# Claude Messages

Use `@cavi-ai/api-client/providers/claude/messages` for the focused Messages
runtime entry. It adapts the upstream Messages API to `RuntimeClient` for run
submission and streaming, with optional batch operations exposed through
capability checks.

The broader `@cavi-ai/api-client/providers/claude` entry remains available for
compatibility.

## Configuration

Construct the provider in trusted backend code with credentials accepted by the
upstream service. Never embed provider credentials in browser or mobile
bundles. Model selection belongs to the run request or provider configuration,
not the universal client contract.

## Runtime behavior

- Check `getRuntimeCapabilities()` before invoking optional operations.
- Use `streamRun` only when streaming is advertised.
- Use the batch methods only when `supports.batch` is true.
- Treat provider-native fields as lossless metadata; consume normalized status,
  usage, and stream events in application code.

See the generated `providers/claude/messages` API reference for the exact
release-specific exports.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
