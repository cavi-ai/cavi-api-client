---
documentedVersion: 0.12.0
---

# Operator Control operations

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.

The operator-control folder composes the cavi-control **operator plane** — a
plugin-gated surface that only exists when the cavi-control plugin is installed
on the target harness (it runs the same on OpenClaw and Hermes). Its RPC methods
(`operator.status`, `operator.snapshot`, `operator.registry.get`,
`operator.tasks.list`, `operator.memory.list`, `operator.worker.*`) are the
plugin's own methods, **not** native gateway RPC — so there is no upstream
equivalent to be redundant with. The value-add is capability augmentation,
per-section degrade-to-fallback with a structured `contractGap`, and the
empty-snapshot builders that shape the degraded view.

Route/RPC owners: `CAVI_CONTROL_OPERATOR_API`,
`CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS`, and
`CAVI_CONTROL_OPERATOR_RPC_METHODS` in
`extensions/cavi/contracts/paths.ts`;
surface keys `cavi.operator.*` in
`surfaces.ts`.

Source:
`extensions/cavi/operator-control/`.

## Operations

### withCaviControlOperatorCapabilities

**Signature** `withCaviControlOperatorCapabilities<T extends GatewayCapabilities>(base: T): T`
**HTTP** `n/a (client-side)`
**Capability** gateway
**Upstream equivalent** none (plugin-gated CAVI operator plane)
**CAVI value-add** Augments any provider/gateway `GatewayCapabilities` with the operator plane — the `caviControlOperator` feature flag, the status/snapshot/tasks endpoints, the websocket-rpc runtime descriptor, and the operator RPC method list — without baking a CAVI assumption into the base OpenClaw/Hermes clients.

#### Example

```ts
const caps = withCaviControlOperatorCapabilities(openClawClient.capabilities);
console.log(caps.features.caviControlOperator); // true
```

### loadOperatorControlSection

**Signature** `loadOperatorControlSection<TKey, TData>(params: { key; run; fallback; authoritative; sampleLimit; expectedContract; note }): Promise<OperatorSectionLoadResult<TKey, TData>>`
**HTTP** `gateway RPC operator.*` or `GET` `resolveCaviPath("cavi.operator.*")` (supplied by the caller's `run`)
**Capability** gateway
**Upstream equivalent** none (the section loaders target cavi-control operator RPC/REST, not native gateway)
**CAVI value-add** Runs a section loader and, on non-auth failure, returns the caller's `fallback()` data plus a `sectionStatus` (`available/authoritative/error/sampleLimit`) and a classified `contractGap` built from `expectedContract`. Auth errors (401/403) re-throw. This is the per-section graceful-degradation wrapper the operator snapshot is assembled from.

#### Request body / Parameters

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| key | `OperatorControlSectionKey` | yes | Section identifier (status, registry, tasks, …). |
| run | `() => Promise<TData>` | yes | The live loader (RPC or REST). |
| fallback | `() => TData` | yes | Degraded-mode data used when `run` fails. |
| authoritative | `boolean` | yes | Whether a successful load is authoritative. |
| sampleLimit | `number \| null` | yes | Sample cap surfaced in `sectionStatus`. |
| expectedContract | `string` | yes | Contract summary embedded in the `contractGap`. |
| note | `string` | yes | Human-readable failure note. |

#### Example

```ts
const section = await loadOperatorControlSection({
  key: "tasks",
  run: () => wsClient.request("operator.tasks.list", {}),
  fallback: () => createEmptyOperatorTasks(),
  authoritative: true,
  sampleLimit: OPERATOR_TASK_SAMPLE_LIMIT,
  expectedContract: "WS operator.tasks.list",
  note: "Operator tasks unavailable",
});
console.log(section.status.available, section.contractGap);
```

## Empty-snapshot / status builders

`createEmptyOperatorStatus`, `createEmptyOperatorRegistry`,
`createEmptyOperatorTasks`, `createEmptyOperatorMemory`,
`createEmptyWorkerReady`, `createEmptyWorkerTasks`,
`createEmptyOperatorSectionStatus`, `createOperatorSectionStatus`, and the
`OPERATOR_*_SAMPLE_LIMIT` constants are client-side (`n/a` capability) with no
upstream equivalent. They provide the deterministic degraded-mode shapes that
`loadOperatorControlSection` falls back to. Kept — they are the fallback data,
not a duplicated capability.
