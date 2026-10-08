---
documentedVersion: {{documentedVersion}}
---

# API Reference

This reference documents the operations you call on `@cavi-ai/api-client` —
each with its method signature, the HTTP endpoint it maps to, request body,
response, and focused usage snippets. Snippets assume the named clients and
transports are already configured; they are not standalone programs. Use
[provider setup](../guides/providers.md), [server requests](../guides/server.md),
and [streaming](../guides/streaming.md) for complete application examples.
This is the operation-level companion to the
generated [symbol reference](../reference/index.md), which carries exhaustive
type declarations.

## How to read an operation

- **Signature** — the method you call and its return type.
- **HTTP** — the wire endpoint(s) the method dispatches to, per provider. Route
  literals are owned by `paths.ts` files and validated against this reference in
  CI.
- **Capability** — the `RuntimeCapabilities.supports` flag gating the operation.
  Optional methods (`getRun?`, `submitBatch?`, …) are absent when unsupported;
  check both advertised support and method presence before calling.
- **Request body / Parameters**, **Response**, **Example** — as named.

Raw errors follow the [errors reference](../reference/core-errors.md). Facade
calls use structured gaps with auth/unclassified exceptions; some CAVI
extension helpers use their own fallback envelopes.

## Client contracts

These signatures document the raw runtime/provider methods. The application
facade wraps values in CapabilityResult and keeps accessors present. See
[client contracts](../concepts/runtime-client.md) and [error handling](../guides/errors.md)
for the distinct result and exception conventions.

## Capability matrix

| Provider | runs | getRun/cancelRun | streamRun | batch |
| -------- | ---- | ---------------- | --------- | ----- |
| Claude (Anthropic) | ✅ | ✅ client-local (sync) | ✅ | ✅ |
| Codex (OpenAI) | ✅ | ✅ | ✅ | ✅ |
| Gemini (Google) | ✅ | ✅ client-local (sync) | ✅ | ✅ |
| Antigravity (AGY) | ✅ | ✅ client-local (sync) | ✅ | ❌ |
| Hermes (gateway) | ✅ | ✅ | ✅ | ❌ |
| OpenClaw (gateway) | ✅ | ✅ | ✅ | ❌ |
| Claude Managed Agents (beta) | ✅ | ✅ server-side | ✅ | ❌ |
| OpenCode | ✅ | ✅ server-side/cached | ✅ | ❌ |

Synchronous providers (Claude Messages, Gemini, AGY) implement `getRun` /
`cancelRun` over a client-side `SynchronousRunStore`: they return the remembered
terminal status from `startRun` / `streamRun` and do not poll an upstream run
resource. Codex and gateway providers serve real server-side run handles.
