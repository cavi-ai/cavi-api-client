---
documentedVersion: 0.15.0
---

# Streaming

Streaming is an optional capability. Gate on `supports.streaming` before subscribing; the compile-checked [capability pattern](../examples/runtime-capabilities.ts) demonstrates the guard.

Through the `createApiClient` facade, `streamRun(body, handlers, { signal? })` resolves a `CapabilityResult<RunStreamOutcome>`. `ok` reflects the streaming call; `data` carries the run's terminal state (`runId` + `outcome`), so a run that fails as a `run.failed` event still resolves `ok:true`. Runtime-only providers stream natively; gateway providers (Hermes, OpenClaw) are bridged over their event transport. A caller abort (`options.signal`) resolves `ok:false` with a `request-aborted` gap and issues a best-effort `cancelRun`.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
