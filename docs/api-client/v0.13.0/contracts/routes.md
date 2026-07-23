# Runtime routes

Package: @cavi-ai/api-client
Verified by: declaration + fixture + conformance test
Contract: routes
Version: 0.13.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: supported

Route keys mirrored for compatible gateway integrations.

## Purpose and lifecycle

Maps stable route keys to paths without making this package the protocol owner.

Resolved when constructing a gateway request and discarded after transport dispatch.

## Packed declaration signatures

### TeamRouteKey

```ts
export type TeamRouteKey = DefaultTeamRouteKey | "action" | "agent.action" | "agent.config" | "agent.workspace" | (string & {});
```

## Field constraints

- **routeKey**: Must be a member of the packed TeamRouteKey union.

## Behavior

Errors: Unknown keys are rejected by typed callers or the resolver.
Retry: Route resolution itself is deterministic and is not retried.
Cancellation: Cancellation applies to the subsequent request, not resolution.
Streaming: Routes do not imply streaming support.

## Dependencies

Capabilities: gateway route support
Transports: gateway HTTP transport

## Valid example

```json
{
  "routeKey": "team"
}
```

The resolver returns the packed route for the key.

## Invalid example

```json
{
  "routeKey": "../../admin"
}
```

Expected failure: The value is not a TeamRouteKey and is rejected.

## Compatibility notes

Actual endpoint behavior remains owned by the compatible gateway.

## Public symbols

- `./contracts:TeamRouteKey`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.13.0-manifest.json`
- fixture: `docs/examples/contracts/routes.ts`
- conformance-test: `src/__tests__/contracts/route-resolver.test.ts`
