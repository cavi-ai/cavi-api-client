# Runtime request

Package: @cavi-ai/api-client
Verified by: declaration + fixture + conformance test
Contract: runtime-request
Version: 0.14.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: supported

Request accepted by a compatible runtime client.

## Purpose and lifecycle

Carries provider-neutral input and optional execution settings into startRun.

Created by the caller, validated by the provider adapter, and retained only when the upstream runtime persists a run.

## Packed declaration signatures

### RuntimeRunStartBody

```ts
/**
 * The UNIVERSAL run-start body. Carries only fields every agent runtime
 * understands. Provider/gateway-only concepts (sessions, routing, target
 * profiles, tasks) are NOT here — they live on `GatewayRunStartBody`.
 */
export type RuntimeRunStartBody = {
    input: RuntimeRunInput;
    /** System / developer instructions (Anthropic `system`). */
    instructions?: string;
    model?: string;
    tools?: Record<string, unknown>[];
    metadata?: Record<string, unknown>;
    dryRun?: boolean;
};
```

## Field constraints

- **input**: Required runtime input supported by the selected provider.
- **metadata**: Optional JSON-compatible provider metadata; unknown keys may be ignored upstream.

## Behavior

Errors: Invalid input is rejected by the provider or upstream runtime.
Retry: Retry only when the returned error is explicitly retryable.
Cancellation: Cancellation occurs after a run identifier exists and support is capability-gated.
Streaming: Streaming requires both the stream capability and streamRun implementation.

## Dependencies

Capabilities: run
Transports: provider-defined upstream transport

## Valid example

```json
{
  "input": "Summarize this document."
}
```

startRun returns a normalized run status.

## Invalid example

```json
{}
```

Expected failure: The required input is absent and the provider rejects the request.

## Compatibility notes

Provider-specific metadata remains owned by the upstream runtime.

## Public symbols

- `./core/runtime:RuntimeRunStartBody`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.14.0-manifest.json`
- fixture: `docs/examples/contracts/runtime-request.ts`
- conformance-test: `src/__tests__/core/runtime/run-types.test.ts`
