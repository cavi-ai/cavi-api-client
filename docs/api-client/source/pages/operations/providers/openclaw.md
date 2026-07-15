---
documentedVersion: 0.11.0
---

# OpenClaw operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

Gateway provider. `OpenClawApiClient` extends `GatewayApiClient`, which
implements the universal `RuntimeClient` over the gateway surface
`openclaw-api` (provider kind `openclaw`, alias `open-claw`). Each unified call
is dispatched to OpenClaw's native RPC surface (e.g. `chat.send` / `agent.wait`)
rather than plain REST route literals, so no provider-owned `paths.ts` exists —
the HTTP lines below read `gateway RPC`. Streaming is delivered through a
`RunEventStreamProvider` (subscribe-by-runId), not an inline `streamRun`. The
batch surface is **not** supported.

Capability (from `GatewayApiClient.getRuntimeCapabilities()`): runs ✅ ·
getRun ✅ · cancelRun ✅ · streamRun ✅ (via provider) · batch ❌.

## startRun

**Signature** `client.startRun(body: RuntimeRunStartBody): Promise<RuntimeRunStatus>`
**HTTP** `gateway RPC`
**Capability** `supports.runs`

Dispatches a run to OpenClaw's native surface and normalizes the status to the
universal `RuntimeRunStatus`. See [runtime · startRun](../runtime.md#startrun)
for the full field tables.

### Example

```ts
import { OPENCLAW_PROVIDER_MODULE } from "@cavi-ai/api-client/providers/openclaw";
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

Gateway providers omit the inline `streamRun` method and expose an
`OpenClawSseRunEventProvider` that subscribes to run events by runId. See
[runtime · streamRun](../runtime.md#streamrun).

## Batch

Not supported — `supports.batch` is absent; the batch methods are not
implemented on the gateway client.

## Control-plane adapter

OpenClaw declares all seven canonical modules and its stable WebSocket transport;
unregistered providers retain the required shape and typed unavailable errors. The
six focused clients are sessions, models, usage, tasks, workspace, and
authentication status; `RuntimeEventClient` is the event subscription contract,
and `RuntimeTransportCapabilities` declares the available transports separately.
`RuntimeControlPlane` remains the optional declaration-driven contract, and
`RuntimeAuthStatus` is the read-only, secret-safe model-availability and
authentication-status shape. The verified facade and its per-module methods are
documented under
[gateway control-plane operations](../gateway/control-plane.md#runtime-control-plane-facade).
