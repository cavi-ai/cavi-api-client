# Runtime capabilities

Contract: capabilities
Version: 0.11.0
Stability: stable
Source of truth: upstream-compatible-mirror
Capability: supported

Capability declarations mirrored for compatible runtime clients.

## Purpose and lifecycle

Lets callers gate optional operations without inferring runtime support from type presence.

Fetched from a runtime client and evaluated before each optional operation.

## Packed declaration signatures

### RuntimeCapabilities

```ts
/** Provider-declared capability profile. Returned by RuntimeClient. */
export type RuntimeCapabilities = {
    providerKind: string;
    protocolVersion?: string | null;
    auth?: {
        type?: string;
        required?: boolean;
    };
    supports: Partial<Record<RuntimeSurface, boolean>>;
};
```

## Field constraints

- **capability value**: Documentation support states are supported, unsupported, conditional, or unknown.

## Behavior

Errors: Capability discovery failures leave support unknown.
Retry: Discovery may be retried under the provider transport policy.
Cancellation: A cancellation capability does not guarantee a particular upstream termination latency.
Streaming: Stream must be reported and implemented before use.

## Dependencies

Capabilities: capability discovery
Transports: provider-defined upstream transport

## Valid example

```json
{
  "stream": true
}
```

The caller also checks streamRun before streaming.

## Invalid example

```json
{
  "stream": "always"
}
```

Expected failure: The value does not match the packed capability field type.

## Compatibility notes

Capabilities are observations of an upstream implementation, not protocol ownership claims.

## Public symbols

- `./core/runtime:RuntimeCapabilities`

## Verification evidence

- declaration: `docs/api-client/source/releases/0.11.0-manifest.json`
- conformance-test: `src/__tests__/core/runtime/capabilities.test.ts`
