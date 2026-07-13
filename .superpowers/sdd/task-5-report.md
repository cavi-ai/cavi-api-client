# Task 5 report

## Status

Complete. The repository now publishes reproducible `docs:build` and `docs:check`
commands, commits the generated `v0.11.0` artifact, validates relative Markdown
links, and runs the drift check from `verify`.

## Immutable inputs

- Stable tarball: `/Volumes/MIRZA/workspace/CAVI/packages/cavi-api-client/cavi-ai-api-client-0.11.0.tgz`
- Verified SHA-256: `93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a`
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
release state were changed. The immutable release tarball has fewer export keys
than the current checkout's same-version `package.json`; generated navigation
therefore records every current export, while it only assigns reference-page
paths to subpaths verified in the stable release artifact.
