---
name: Open a PR
description: Use when proposing a change to @cavi-ai/api-client for review/merge. Covers the correct branch→gate→PR flow and the factual, no-prose PR/commit style this repo requires. Agents never push to main or merge.
---

# Opening a Pull Request

`main` is branch-protected and CI-gated. **All** changes land via PR; agents never
push to `main` and never merge — a human does both.

## Flow

1. **Branch off `main`** with a descriptive name: `feat/<x>`, `fix/<x>`,
   `chore/<x>`. Never commit straight to `main`.
2. **Gate green first.** Run the `quality-gate` skill (`pnpm run verify`). Do not
   open a PR on a red gate. The `pre-commit` hook runs the tests; `pre-push` runs
   `verify` — let them.
3. **One PR, one concern.** If the diff sprawled beyond the task, split it. A
   reviewer (and CI) should be able to reason about one change.
4. **Push the branch and open the PR against `main`.** CI runs the full gate on
   the PR automatically.
5. **Stop there.** Report the PR URL to the human. Do not merge, do not publish,
   do not bump the version.

## Commit and PR description style — facts only

A commit message and PR description contain ONLY facts about the diff: **what
changed, why, and how it was verified.** Terse and structured — bullets, not
paragraphs.

- **Lead the body with what changed**, then why, then the verification line
  (e.g. "440 tests; `verify` green").
- **Banned:** working-tree/process notes, what was "left out", session context,
  apologies, marketing, or anything not in the diff. If something adjacent was
  intentionally excluded, tell the human in chat — not in the PR body.
- A **public-surface or behavior** change must call that out explicitly and link
  the `CHANGELOG` entry.

## Example

```
feat(<area>): <imperative summary>

<one or two factual sentences on what + why>

- <change 1>
- <change 2>
- docs: CHANGELOG [Unreleased] + <affected doc>

<N> tests; verify green (test + build + lint:md + pack --dry-run).
```
