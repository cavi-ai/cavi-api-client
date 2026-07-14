---
documentedVersion: 0.11.0
---

# Runtime client

`RuntimeClient` is the provider-neutral execution contract. Every
implementation supports capability discovery and run submission. Retrieval,
cancellation, streaming, usage, and batch operations are capability-gated.

Consumers should inspect declared capabilities and the corresponding optional
method before invoking an optional surface. The
[compile-checked capability example](../examples/runtime-capabilities.ts)
demonstrates the pattern.

## Runtime execution and control plane

`RuntimeClient` owns execution: starting, inspecting, cancelling, and streaming
runs. `RuntimeControlPlane` is a separate discovery and administration
contract. It can expose focused clients for `authStatus`, `sessions`,
`models`, `usage`, `tasks`, `workspace`, and `events`.

Consumers should rely on declared capabilities and stable module contracts,
never infer support from provider identity. Authentication status is
observational and must not contain tokens, API keys, passwords, cookies, or
authorization headers.

`CanonicalRuntimeControlPlane` provides one predictable shape with all seven
modules and an idempotent `dispose()`. When an implementation is absent, its
operations reject with a fresh `CapabilityUnavailable` that identifies the
selected provider and operation capability.

```ts
import { createRuntimeControlPlane } from "@cavi-ai/api-client";

const controlPlane = await createRuntimeControlPlane(config.provider, {
  baseUrl: config.baseUrl,
  webSocketUrl: config.webSocketUrl,
  resolveAuth: () => authStore.resolve(config.provider),
});

const sessions = await controlPlane.sessions.listSessions({ limit: 50 });
```

Factory options remain provider-neutral: `baseUrl`, `webSocketUrl`, `token`,
`resolveAuth`, `signal`, `trace`, `transport`, and `registry`. A supplied
registry replaces the default registry. A supplied transport remains
caller-owned; a transport created by the factory is disposed with the facade.

This client mirrors and verifies upstream-compatible behavior. Upstream runtimes remain the canonical protocol owners.
