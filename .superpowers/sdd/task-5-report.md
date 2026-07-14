# Task 5 report

## Status

Complete. The repository now publishes reproducible `docs:build` and `docs:check`
commands, commits the generated `v0.11.0` artifact, validates relative Markdown
links, and runs the drift check from `verify`.

## Immutable inputs

- Stable tarball: npm authority artifact for `@cavi-ai/api-client@0.11.0`
- Verified SHA-256: `3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5`
- Release tag commit: `48adfa6ba7c3d5e8ffee0a6cf2572574ca630fa0`
- `SOURCE_DATE_EPOCH`: `1783740944`, derived from the immutable `v0.11.0`
  release commit timestamp (not wall clock)

## TDD evidence

- RED: `pnpm vitest run src/__tests__/docs-integrity.test.ts` failed three
  assertions because the scripts and committed artifact were absent.
- RED: the focused drift test failed because `scripts/docs/check.mjs` was absent.
- GREEN: focused docs suites passed: 2 files, 26 tests.
- Drift proof: a disposable artifact with `reference/index.md` changed exited 1
  and printed `generated documentation drift: reference/index.md`.

## Verification

Command:

```sh
CAVI_API_CLIENT_STABLE_TARBALL=/Volumes/MIRZA/workspace/CAVI/packages/cavi-api-client/cavi-ai-api-client-0.11.0.tgz SOURCE_DATE_EPOCH=1783740944 pnpm run verify
```

Result: exit 0; 158 test files and 856 tests passed, stable docs typechecking
passed, TypeScript build passed, docs drift check passed, Markdown lint reported
0 errors, and the package dry-run completed.

`git diff --check` also passed.

## Scope and concern

No runtime dependencies, sibling repositories, runtime services, or public
release state were changed.

## Review resolution

Stable artifact truth now exclusively owns the generated reference surface.
`inspect-release.mjs` records every packed export as either a `declaration` or
an `asset`; `build.mjs` no longer reads or unions the current checkout's
`package.json` exports. The generated navigation contains exactly the 29 packed
v0.11.0 exports and 1,609 inspected symbols, gives every declaration a validated
reference page, and types
`./extensions/cavi/library-clip-contract.json` as an asset with its packed
target. The current-only `./core/transport` and `./core/transport/node` exports
are absent.

The publish workflow now provisions the immutable npm artifact
`@cavi-ai/api-client@0.11.0` in an isolated runner-temp directory, verifies
SHA-256 `3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5`,
and supplies both tarball environment variables plus
`SOURCE_DATE_EPOCH=1783740944` before verification. Fetching the already packed
npm artifact avoids invoking this checkout's `prepack` or build hooks.

Review-fix verification used the supplied real tarball. Focused suites passed
3 files and 34 tests. The full `pnpm run verify` gate passed 158 test files and
858 tests, stable docs typechecking, TypeScript build, docs drift checking,
Markdown lint with 0 errors, and package dry-run. `git diff --check` passed.
