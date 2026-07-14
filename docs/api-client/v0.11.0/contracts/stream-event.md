# Stream event

Contract: stream-event
Version: 0.11.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: conditional

Normalized event emitted when a compatible runtime provider implements streaming.

## Purpose and lifecycle

Represents ordered run progress, output, completion, or failure events.

Produced while streamRun is active and ends at terminal event, abort, or transport failure.

## Packed declaration signatures

### RunStreamEvent

```ts
export type RunStreamEvent = RunStreamMessageDeltaEvent | RunStreamRunCompletedEvent | RunStreamRunFailedEvent | RunStreamRunCancelledEvent | RunStreamApprovalRequestEvent | RunStreamToolEvent;
```

## Field constraints

- **type**: Required member of the packed RunStreamEvent discriminated union.

## Behavior

Errors: Transport failures reject streamRun; error events carry normalized upstream failure information.
Retry: Reconnect and deduplication behavior is provider-specific unless documented by that provider.
Cancellation: AbortSignal stops local consumption; upstream cancellation requires cancelRun support.
Streaming: Support is conditional and must be checked before invocation.

## Dependencies

Capabilities: stream
Transports: provider streaming transport

## Valid example

```json
{
  "type": "text_delta",
  "delta": "hello"
}
```

The matching handler receives incremental text.

## Invalid example

```json
{
  "type": "unknown_event"
}
```

Expected failure: The discriminator is not a packed RunStreamEvent variant.

## Compatibility notes

Event ordering and resumability beyond the normalized union remain upstream-owned.

## Public symbols

- `./core/runtime:RunStreamEvent`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.11.0-manifest.json`
- conformance-test: `src/__tests__/core/runtime/stream-run-contract.test.ts`
