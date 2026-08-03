---
documentedVersion: {{documentedVersion}}
---

# Hermes operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Gateway provider. `HermesApiClient` extends `GatewayApiClient`, which implements
the universal `RuntimeClient` over the gateway surface `hermes-api-server`
(provider kind `hermes`). Runs are dispatched over gateway RPC rather than
plain REST route literals, so no provider-owned `paths.ts` exists — the HTTP
lines below read `gateway RPC`. Streaming is delivered through a
`RunEventStreamProvider` (subscribe-by-runId), not an inline `streamRun`. The
batch surface is **not** supported.

Capability (from `GatewayApiClient.getRuntimeCapabilities()`): runs ✅ ·
getRun ✅ · cancelRun ✅ · streamRun ✅ (via provider) · batch ❌.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `gateway RPC`
**Capability** `supports.runs`

Starts a run on the gateway and normalizes the status to the universal
`RuntimeRunStatus`. See [runtime · startRun](../runtime.md#startrun) for the
full field tables.

### Example

```ts
import { HERMES_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/hermes";
// … construct the gateway client via the provider module, then:
const run = await client.startRun({ input: "Hi", model: "…" });
```

## getRun

**Signature** `client.getRun(runId: string): Promise<RuntimeRunStatus>`
**HTTP** `gateway RPC`
**Capability** `supports.runs`

Reads run status by id over gateway RPC. Field tables per
[runtime · getRun](../runtime.md#getrun).

## cancelRun

**Signature** `client.cancelRun(runId: string): Promise<{ status: string }>`
**HTTP** `gateway RPC`
**Capability** `supports.runs`

Stops a run over gateway RPC. See [runtime · cancelRun](../runtime.md#cancelrun).

## streamRun (RunEventStreamProvider)

**HTTP** `gateway RPC`
**Capability** `supports.streaming`

Gateway providers omit the inline `streamRun` method and expose a
`HermesSseRunEventProvider` that subscribes to run events by runId. See
[runtime · streamRun](../runtime.md#streamrun).

## teams

**Capability** `supports.teams`

Not an RPC. `client.teams.*` resolves from the provider manifest: when no explicit
teams backend is supplied, the facade builds a `TeamDirectory` from the resolved
manifest via `teamDirectoryFromManifest`. Absent a manifest, `teams.*` returns a
gap.

## Batch

Not supported — `supports.batch` is absent; the batch methods are not
implemented on the gateway client.
