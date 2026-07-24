---
documentedVersion: 0.14.0
---

# API Reference

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

This reference documents the operations you call on `@cavi-ai/api-client` —
each with its method signature, the HTTP endpoint it maps to, request body,
response, and a runnable example. It is the operation-level companion to the
generated [symbol reference](../reference/index.md), which carries exhaustive
type declarations.

## How to read an operation

- **Signature** — the method you call and its return type.
- **HTTP** — the wire endpoint(s) the method dispatches to, per provider. Route
  literals are owned by `paths.ts` files and validated against this reference in
  CI.
- **Capability** — the `RuntimeCapabilities.supports` flag gating the operation.
  Optional methods (`getRun?`, `submitBatch?`, …) are absent when unsupported;
  null-check or gate on capabilities before calling.
- **Request body / Parameters**, **Response**, **Example** — as named.

Errors follow the canonical taxonomy in the
[errors reference](../reference/core-errors.md): `HttpApiError`,
`EndpointNotFound`, and `withFallback` degrade-to-mock semantics (401/403 and
`unknown`-classified errors always throw).

## CAVI extension operations

CAVI-extension operations additionally declare **Upstream equivalent** and
**CAVI value-add**. An operation with no value-add beyond its upstream
equivalent is marked deprecated and listed under
[Removal candidates](removal-candidates.md).

## Capability matrix

| Provider | runs | getRun/cancelRun | streamRun | batch |
| -------- | ---- | ---------------- | --------- | ----- |
| Claude (Anthropic) | ✅ | ❌ (stateless) | ✅ | ✅ |
| Codex (OpenAI) | ✅ | ✅ | ✅ | ✅ |
| Gemini (Google) | ✅ | ❌ `EndpointNotFound` | ✅ | ✅ |
| Hermes (gateway) | ✅ | ✅ | ✅ | ❌ |
| OpenClaw (gateway) | ✅ | ✅ | ✅ | ❌ |
