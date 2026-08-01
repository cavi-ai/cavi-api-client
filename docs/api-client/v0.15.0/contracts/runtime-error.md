# Runtime error

Package: @cavi-ai/api-client
Verified by: declaration + fixture + conformance test
Contract: runtime-error
Version: 0.15.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: supported

Typed client errors exposed by this compatible client mirror.

## Purpose and lifecycle

Preserves a stable client error identity while carrying normalized status and details.

Created when validation, transport, or upstream execution fails and propagated to the caller.

## Packed declaration signatures

### ApiClientError

```ts
export declare class ApiClientError extends Error {
    readonly type: ApiClientErrorType | string;
    readonly code: ApiClientErrorCode | string;
    readonly runtime?: RuntimeErrorMetadata;
    constructor(message: string, options?: ApiClientErrorOptions);
}
```

## Field constraints

- **message**: Required non-empty human-readable failure description.

## Behavior

Errors: ApiClientError is the normalized error surface; details can remain unknown.
Retry: Retry only when explicit status or provider guidance makes the operation safe.
Cancellation: Abort-related errors may represent local cancellation rather than upstream termination.
Streaming: Stream transport failures may surface as ApiClientError.

## Dependencies

Capabilities: unknown
Transports: client and provider transports

## Valid example

```json
{
  "message": "Request failed",
  "status": 503
}
```

The caller may apply bounded retry policy.

## Invalid example

```json
{
  "message": ""
}
```

Expected failure: An empty diagnostic does not satisfy the documented constraint.

## Compatibility notes

Provider error payloads are not canonicalized beyond the packed client type.

## Public symbols

- `./core/errors:ApiClientError`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.15.0-manifest.json`
- fixture: `docs/examples/contracts/runtime-error.ts`
- conformance-test: `src/__tests__/core/errors.test.ts`
