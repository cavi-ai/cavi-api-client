# Claude integrations

The Claude provider contains two distinct integrations. Choose one deliberately;
they have different lifecycles and should not be treated as interchangeable
transports.

## Claude Messages

The Messages integration is a stateless runtime provider. Each `startRun`
request maps to a provider request and returns the normalized `RuntimeClient`
shape. Batch operations map to Anthropic Message Batches when the configured
runtime supports them.

Import the narrow entry when only the Messages integration is required:

```ts
import {
  ClaudeApiClient,
  createClaudeProviderModule,
} from "@cavi-ai/api-client/providers/claude/messages";
```

See the [Claude Messages operation reference](../api-client/v0.11.0/operations/providers/claude-anthropic.md)
for methods, request mapping, responses, and batch behavior.

## Claude Managed Agents

Managed Agents is the stateful, server-run integration. It includes persisted
agents, environments, sessions, event streaming and steering, session
resources, multi-agent threads, memory stores, vaults, deployments, webhooks,
and team provisioning.

Import it independently from the stateless Messages client:

```ts
import {
  ClaudeManagedAgentClient,
} from "@cavi-ai/api-client/providers/claude/managed-agents";
```

The integration is beta and tracks a provider-owned beta contract. Consumers
should pin package versions, capability-gate optional surfaces, and review the
upstream beta contract before upgrading.

See the complete [Claude Managed Agents operation reference](../api-client/v0.11.0/operations/providers/claude-managed-agents.md)
for agents, environments, sessions, steering, resources, credentials,
deployments, runtime mapping, webhooks, and team provisioning.

## Credentials

Both integrations accept provider-owned authentication through their concrete
client or provider-module configuration. Keep credentials on a trusted backend.
The universal `RuntimeClient` contract neither requires nor exposes Anthropic
credential fields.
