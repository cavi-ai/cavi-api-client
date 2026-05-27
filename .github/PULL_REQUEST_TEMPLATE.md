<!-- Thanks for contributing! Keep PRs focused: one provider, feature, or fix. -->
<!-- markdownlint-disable MD041 -->

## Summary

<!-- What does this change and why? -->

## Type of change

- [ ] Bug fix
- [ ] New gateway provider
- [ ] New feature
- [ ] Docs / tooling
- [ ] Boundary change (updates a hardening test — explain below)

## Checklist

- [ ] `pnpm test` passes
- [ ] `pnpm run build` (or `pnpm exec tsc --noEmit`) passes
- [ ] `pnpm run lint:md` passes (when markdown changed)
- [ ] New public exports are added to `src/index.ts` (and the right subpath entry)
- [ ] New route literals live in a `*paths.ts` / `contracts/surfaces.ts` file
- [ ] New data loaders route through `withFallback` / `withMutationResult`
- [ ] `CHANGELOG.md` updated under `[Unreleased]` (for user-facing changes)
- [ ] No imports of forbidden host packages or quarantined paths

## Boundary changes

<!-- If you modified src/__tests__/package-hardening.test.ts or the layer rules, explain the
intentional boundary change here. Otherwise write "none". -->

## Notes for reviewers

<!-- Anything that needs context: tradeoffs, follow-ups, things you're unsure about. -->
