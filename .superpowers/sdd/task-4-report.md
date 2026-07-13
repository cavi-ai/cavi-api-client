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

The stable tarball is intentionally not copied into the repository. Every environment, including CI, must provision the digest-locked artifact and set `CAVI_API_CLIENT_STABLE_TARBALL` explicitly.

## Review finding fixes

- The renderer now copies every compile-checked TypeScript example into `examples/` in the generated artifact. All curated links target that stable artifact path, and a regression resolves every rendered relative Markdown link entirely inside the artifact.
- The Codex quickstart now reflects the actual v0.11.0 background API: it starts the complete request, polls `getRun(run_id)` while status is `started` or `running`, and documents the expected completed output and other terminal outcomes.
- Stable docs typechecking no longer contains a developer path or shared extraction directory. It requires `CAVI_API_CLIENT_STABLE_TARBALL`, verifies the v0.11.0 digest, uses a unique `mkdtemp` workspace, generates declaration mappings for that workspace, and always cleans it up. Regression tests cover the actionable absent-variable error and digest mismatch.
- Navigation integrity now discovers every curated Markdown page recursively and compares its exact sorted multiset with curated navigation entries, detecting both unlisted pages and duplicate entries without a maintained path list.

### Review verification

- Focused content gate: 2 files passed, 22 tests passed.
- Exact stable typecheck: `CAVI_API_CLIENT_STABLE_TARBALL=.../cavi-ai-api-client-0.11.0.tgz pnpm run typecheck:docs` exited 0 after verifying digest `93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a`.
- Full `pnpm run verify`: 158 test files passed, 852 tests passed; stable docs typecheck, build, Markdown lint (0 errors), and package dry-run all passed.
- `git diff --check` exited 0.
