# Task 4 report: Curated developer journeys

Status: DONE

## Implementation

- Added 14 version-locked introduction, concept, and workflow pages.
- Added each page exactly once to navigation and taught the portable renderer to copy curated pages into its output.
- Added renderer coverage for navigation resolution, `documentedVersion: 0.11.0`, and the required mirror-not-canonical notice.
- Reworked the Node example into one complete Codex request and added a stable contracts narrow import.
- Replaced development-only standalone transport examples with explicit v0.11.0 unavailability markers.
- Added digest-locked artifact extraction and a stable declaration TypeScript configuration. `CAVI_API_CLIENT_STABLE_TARBALL` may relocate the artifact, but the typecheck rejects any digest other than `93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a`.

## TDD evidence

- RED: `pnpm vitest run src/__tests__/docs-renderer.test.ts` ran 9 tests with 1 expected failure: `introduction/overview.md must occur exactly once in navigation`, observed zero entries.
- GREEN: the same command passed all 9 tests after adding curated navigation, pages, and renderer support.

## Verification

- Locked artifact: `shasum -a 256 .../cavi-ai-api-client-0.11.0.tgz` returned the required `93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a`.
- Required content gate: `pnpm vitest run src/__tests__/docs-renderer.test.ts src/__tests__/docs-integrity.test.ts` passed 2 files and 18 tests.
- Full tests: `pnpm test` passed 158 files and 849 tests.
- Stable docs typecheck: `pnpm run typecheck:docs` passed against declarations freshly extracted from the digest-locked tarball.
- Package typecheck: `pnpm run typecheck` passed.
- Markdown: `pnpm run lint:md` completed with 0 errors.
- Whitespace: `git diff --check` exited 0.

## Concerns

The stable tarball is intentionally not copied into the repository. The default artifact path matches the approved CAVI workspace; other environments must set `CAVI_API_CLIENT_STABLE_TARBALL` to the same digest-locked artifact.
