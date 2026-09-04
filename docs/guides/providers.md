# Providers and setup

Application code should depend on `RuntimeClient`. Composition code selects a
provider module, supplies its provider-owned authentication and transport
configuration, and registers it with the universal factory.

There is no package-wide API key and no default provider.

## Choose by capability

| Provider family | Runtime runs | Streaming | Batch | Gateway resources |
| --- | --- | --- | --- | --- |
| Claude Messages | yes | provider-specific | yes | no |
| Claude Managed Agents | yes | yes | capability-gated | no |
| Codex | yes | yes | yes | no |
| Gemini (legacy compatibility) | yes | yes | yes | no |
| Antigravity (AGY, active successor direction) | yes | yes | no | no |
| Hermes | yes | yes | no | yes |
| OpenClaw | yes | yes | no | yes |
| OpenCode | yes | yes | no | no |

Treat this table as orientation, not runtime truth. Always inspect
`getRuntimeCapabilities()` because upstream availability and configured
transports can change what an instance supports.

AGY is the active successor direction for new compatible orchestration
integrations. Gemini remains available as a legacy compatibility surface; these
labels describe package direction and do not replace runtime capability checks.
OpenCode is the next added harness, not a replacement for AGY.

## Composition boundary

Provider modules own provider credentials. The universal factory receives only
provider-neutral client options.

```ts
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
} from "@cavi-ai/api-client";

const registry = createRuntimeProviderRegistry({ modules: [providerModule] });
const client = createRuntimeClient(providerId, {
  registry,
  clientOptions: { baseUrl },
});
```

The concrete `providerModule`, `providerId`, authentication values, and
provider-owned base URL belong in application configuration. Do not move those
details into reusable workflow code.

## Provider references

- [Claude integrations](claude.md)
- [Antigravity (AGY) integrations](agy.md)
- [OpenCode integrations](opencode.md)
- [Claude operation reference](../api-client/v0.11.0/operations/providers/claude-anthropic.md)
- [Claude Managed Agents operation reference](../api-client/v0.11.0/operations/providers/claude-managed-agents.md)
- [Codex operation reference](../api-client/v0.11.0/operations/providers/codex.md)
- [Gemini operation reference](../api-client/v0.11.0/operations/providers/gemini.md)
- [Hermes operation reference](../api-client/v0.11.0/operations/providers/hermes.md)
- [OpenClaw operation reference](../api-client/v0.11.0/operations/providers/openclaw.md)

These adapters mirror upstream services. Their operation pages document client
behavior and mapping; upstream projects remain the canonical owners of their
wire protocols.
