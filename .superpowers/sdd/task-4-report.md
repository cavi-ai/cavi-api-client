# Task 4 report: typed runtime error metadata

## Scope

- Added the eight specified provider-neutral `ApiClientErrorCode` values.
- Added `RuntimeErrorMetadata`, optional readonly `ApiClientError.runtime`
  storage, and `getRuntimeErrorMetadata`.
- Curated the new getter and type into the package root.
- Preserved the exact stable `serializeError` shape.
- Documented the additive API under `[Unreleased]` and in `API.md`.

## RED

Command:

```text
pnpm vitest run src/__tests__/core/errors.test.ts
```

Evidence: exit 1; 1 failed and 9 passed. The new serialization/metadata test
failed at `getRuntimeErrorMetadata(error)` with
`TypeError: getRuntimeErrorMetadata is not a function`, confirming the missing
feature caused the failure.

## GREEN

Covering command:

```text
pnpm vitest run src/__tests__/core/errors.test.ts src/__tests__/core/http/gateway-error.test.ts src/__tests__/core/gateway/error-details.test.ts && pnpm typecheck
```

Evidence: exit 0; 3 test files passed, 16 tests passed; `tsc --noEmit` passed.

Documentation command:

```text
pnpm lint:md
```

Evidence: exit 0; 13 Markdown files linted with 0 errors.

Full gate:

```text
pnpm run verify
```

The first sandboxed run reached 655/656 passing and failed only because the
Codex local HTTP integration server could not bind `127.0.0.1` (`listen EPERM`).
The identical command was rerun with local-listener permission.

Evidence from the permitted rerun: exit 0; 143 test files passed, 656 tests
passed; docs typecheck, build, Markdown lint (0 errors), and package dry-run all
passed.

## Serialization compatibility

The regression assertion verifies an error carrying runtime metadata still
serializes exactly to:

```json
{
  "name": "ApiClientError",
  "message": "overloaded",
  "type": "transport",
  "code": "server_overloaded"
}
```
