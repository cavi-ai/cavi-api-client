---
name: Quality Gate
description: Use to verify a change to @cavi-ai/api-client is safe to propose/merge/publish. Runs and interprets the full gate (tests, typecheck, acceptance gate, lint, pack). The definition of "done" for this repo.
---

# Quality Gate

A change is **done** only when the full gate is green. Run it before opening a PR,
before requesting merge, and before any publish. Same gate runs in CI on every PR.

## Run it

```sh
pnpm run verify   # pnpm test && build && lint:md && pack --dry-run
```

Run individually when isolating a failure:

| Command | Catches |
| --- | --- |
| `pnpm test` | Guardrails (`package-hardening`), behavior, `docs integrity`, provider conformance. ~440 fast tests. |
| `pnpm run typecheck` | `tsc --noEmit` under `strict` — the only lint gate. |
| `pnpm run typecheck:gate` | Acceptance gate (`tsconfig.gate.json`) — RuntimeClient contract shape. |
| `pnpm run lint:md` | markdownlint on published + contributor docs. |
| `HUSKY=0 pnpm pack --dry-run` | The exact tarball that would ship — confirm new files land and removed ones don't. |

## Interpreting failures — do NOT paper over them

- **`package-hardening.test.ts` failed** → you crossed the package boundary
  (route literal outside a `*paths.ts`, provider name in core, a public export
  changed, `tsconfig.include` drift). **Fix the code, not the test.** Only edit a
  hardening assertion when the boundary is *intentionally* changing and a human
  approved it.
- **`docs integrity` failed** → version has no matching `CHANGELOG` entry, a
  released heading is undated, or the README documents a non-exported subpath.
  Update the docs.
- **conformance failed** → a provider doesn't satisfy the universal
  `RuntimeClient` contract. Fix the provider.
- **typecheck failed** → real type error; strict mode is the contract.
- **pack diff unexpected** → a file landed in or vanished from the published
  tarball. Reconcile `package.json` `files`.

## Before publish (maintainer only)

`pnpm run verify` green **and** confirm: on `main`, clean tree, the target
version is **not** already on npm (`npm view @cavi-ai/api-client@<v> version`).
Publishing itself is a private, human-run workflow.
