---
documentedVersion: 0.18.0
---

# Choose your client contract

The package offers an application facade and a lower-level execution contract.
They represent the same provider capabilities through different calling
conventions. Choose one at your application boundary and use its return shape
consistently.

## Application facade: CapabilityClient

`createApiClient(provider, options)` returns `CapabilityClient`.
Every accessor exists, including runs, batches, sessions, models, and workspace.
Method presence is not evidence that the selected backend supports a feature.

Calls return `CapabilityResult<T>`:

- `{ ok: true, data, source: "live" }`: inspect the data and the run state.
- `{ ok: false, data: null, gap }`: display or handle the capability gap.
- Authentication and unclassified failures still reject; catch exceptions.

Use `getCapabilityMap()` for feature visibility, then handle each call's result.
Use `dispose()` when the owner of the client shuts down.

## Execution contract: RuntimeClient

`createRuntimeClient` or a concrete provider client returns the raw execution
contract. `getRuntimeCapabilities` and `startRun` are required; retrieval,
cancellation, streaming, and batch methods are optional. Methods return raw
statuses and can throw.

Before an optional call, check the advertised capability with `runtimeSupports`
and confirm the method exists. Gateway raw clients usually expose subscriptions
rather than an inline `streamRun`; the application facade bridges that difference.

## Gateway and control-plane contracts

`GatewayApiClient` implements `RuntimeClient` and adds gateway resources.
`RuntimeControlClient` supplies administration and discovery modules.
Neither implies that every backend has teams, media, or workspace access.

For application integrations, [provider setup](../guides/providers.md) starts
with the facade. [Requests](../guides/requests.md) and
[streaming](../guides/streaming.md) explain observable lifecycle differences.
