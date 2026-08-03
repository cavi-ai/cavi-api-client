# Development and release verification

Install dependencies and run the package checks from the repository root:

```sh
pnpm install
pnpm test
pnpm run build
pnpm run lint:md
```

`pnpm run verify` is the complete release gate. In addition to tests and the
TypeScript build, it validates the locked documentation artifact and packed
consumer declarations. Documentation verification therefore requires the exact
stable package tarball for the documented release.

That artifact is provisioned for you: the documentation scripts fetch it into a
gitignored `.cache/docs-stable/` and verify it against the sha256 from the
source release manifest for `package.json` `version`, so `pnpm run verify`
works with no setup. Run `pnpm run docs:stable` to fetch it up front. To use an
artifact you already have, point `CAVI_API_CLIENT_STABLE_TARBALL` at it — a
supplied tarball is digest-checked too, and never trusted blindly.

The documented release version is `package.json` `version`. Commit, tarball
digest, and `sourceDateEpoch` are read from
`docs/api-client/source/releases/<version>-manifest.json` via
`scripts/docs/types.mjs`. Output paths and workflows derive from that identity;
`docs-pins.test.ts` fails the build if they drift from `package.json`.

Release orchestration lives under `scripts/release/`. Docs build/check stays
under `scripts/docs/`. Maintainer release evidence is local-only under
`.artifacts/runtime-control/` (gitignored), not under `docs/`.

## Documentation model

| Tree | Audience | Role |
| --- | --- | --- |
| `docs/api-client/source` → `docs/api-client/v*` | Product docs / docs host | Generated immutable set; site ingest is the GitHub release docs artifact |
| `docs/guides`, `docs/examples` | Contributors | Checkout-only how-to; not host IA |
| `docs/postman` | Integrators | Generated gateway surface verification |
| `docs/maintainers`, `docs/compatibility` | Maintainers | Process / ledgers; not packed for the host |
| `docs/brand`, `docs/assets` | Packaging / site chrome | Logos and assets |

Do not manually reinterpret a development declaration as a released contract.
Hosts follow [the consumer contract](../api-client/CONSUMER.md) and validate with
`pnpm run docs:host-ingest-check`.

The current committed artifact is
`docs/api-client/v<package.json version>`.

## Guardrails

- Public exports and subpath entries are consumer contracts.
- Route literals remain in their owning `paths.ts` or surface-contract files.
- Provider-specific behavior remains inside provider modules.
- Public behavior changes require an Unreleased changelog entry and affected
  documentation updates.
- Never weaken package-hardening or conformance tests to make a change pass.
