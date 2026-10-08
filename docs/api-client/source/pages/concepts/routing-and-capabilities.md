---
documentedVersion: {{documentedVersion}}
---

# Capabilities and feature visibility

A provider name identifies an adapter; it does not prove that your deployment
has a particular resource, plugin, permission, or transport.

The package has static provider declarations and instance-level resolution.
On the facade, runtime-resolved values override the static fallback. Refresh
with `refreshCapabilities()` when configuration or the backend changes.

## Facade callers

Use `getCapabilityMap()` to decide which controls to show. Keep handling
`result.ok` on each call, because availability can change after discovery.
An accessor always exists; do not check for `client.sessions` to infer support.

```ts
import { supportsCapability, type CapabilityClient } from "@cavi-ai/api-client";

export async function availableControls(client: CapabilityClient) {
  const capabilities = await client.getCapabilityMap();
  return {
    stream: supportsCapability(capabilities, "streaming"),
    batch: supportsCapability(capabilities, "batch"),
    sessions: supportsCapability(capabilities, "sessions"),
  };
}
```

Use these flags for feature visibility. A visible control still needs a call
result and exception handler; discovery is not a permission guarantee.

Unsupported, unwired, invalid, or unavailable calls can return a structured
gap. Authentication and unclassified failures still throw.
[Error handling](../guides/errors.md) explains both paths.

## Raw runtime callers

Check `getRuntimeCapabilities()`, then `runtimeSupports(capabilities, surface)`
and the optional method before using it. The
[batch example](../examples/runtime-capabilities.ts) demonstrates this pattern.

## Routes and application ownership

Provider modules own their wire mappings. Team manifests can supply resource
identity and permitted relative workspace paths, but do not override provider
protocol semantics. Import public helpers rather than hardcoding endpoint
strings in your application. See [manifests](../guides/manifests.md).
