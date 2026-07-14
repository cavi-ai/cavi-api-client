# Runtime response

Package: @cavi-ai/api-client
Verified by: declaration + fixture + conformance test
Contract: runtime-response
Version: 0.11.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: supported

Run status returned by a compatible runtime client.

## Purpose and lifecycle

Normalizes upstream run identity, state, output, and error information.

Returned at creation and polling boundaries until a terminal state is observed.

## Packed declaration signatures

### RuntimeRunStatus

```ts
/** The UNIVERSAL run status. Gateway-only fields live on `GatewayRunStatus`. */
export type RuntimeRunStatus = {
    run_id: string;
    status: RuntimeRunState;
    model?: string;
    output?: string;
    response?: string;
    error?: string;
    /**
     * @deprecated Raw provider-native token counts. Use `tokens` for portable,
     * normalized usage. Still populated for backward compatibility.
     */
    usage?: Record<string, number>;
    /** Provider-agnostic normalized token usage. */
    tokens?: RuntimeUsage;
};
```

## Field constraints

- **id**: Non-empty upstream or adapter run identifier.
- **status**: One normalized RuntimeRunState value.

## Behavior

Errors: Terminal failures are represented by failed state and may include normalized error data.
Retry: Polling retries depend on transport errors and caller policy.
Cancellation: Cancelled is terminal when the upstream runtime confirms cancellation.
Streaming: Status polling is independent from optional event streaming.

## Dependencies

Capabilities: run
Transports: provider-defined upstream transport

## Valid example

```json
{
  "id": "run_123",
  "status": "completed",
  "output": "Done"
}
```

The caller treats completed as terminal.

## Invalid example

```json
{
  "id": "",
  "status": "invented"
}
```

Expected failure: The identifier is empty and the state is outside the declaration union.

## Compatibility notes

Upstream state names are adapter-normalized and remain subject to provider support.

## Public symbols

- `./core/runtime:RuntimeRunStatus`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.11.0-manifest.json`
- fixture: `docs/examples/contracts/runtime-response.ts`
- conformance-test: `src/__tests__/core/runtime/run-types.test.ts`
