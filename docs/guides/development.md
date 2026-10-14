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
baseline tarball for the documented version.

The documented consumer contract tests also compile and run against that exact
stable package and the development pack. Snippets can import sibling application
downloads; those imports are resolved and checked alongside the snippet.

That artifact is provisioned into a gitignored `.cache/docs-stable/` and verified
against the sha256 from the
source release manifest for `package.json` `documentation.version`, so `pnpm run verify`
works with no setup. Run `pnpm run docs:stable` to provision it up front. To use an
artifact you already have, point `CAVI_API_CLIENT_STABLE_TARBALL` at it — a
supplied tarball is digest-checked too, and never trusted blindly.

The baseline version is `package.json` `documentation.version`, pinned
independently of the working package version. `documentation.source` is `git`
for an immutable source snapshot and `npm` for a published artifact (the default).
Git snapshots are rebuilt without requesting an npm artifact of the same version;
both sources retain digest verification. Commit, tarball
digest, and `sourceDateEpoch` are read from
`docs/api-client/source/releases/<version>-manifest.json` via
`scripts/docs/types.mjs`. Output paths and workflows derive from that identity;
`docs-pins.test.ts` fails the build if the baseline pin and its manifest disagree.
Advance this pin only after publication, using the exact npm artifact and release
commit. The release workflow uses explicit release identity to build the new docs
asset without changing or replacing historical pins.

Release orchestration lives under `scripts/release/`. Docs build/check stays
under `scripts/docs/`. Maintainer release evidence is local-only under
`.artifacts/runtime-control/` (gitignored), not under `docs/`.

The npm release workflow verifies the checkout, then packs that checkout for
publication. `CAVI_API_CLIENT_STABLE_TARBALL` is only the documentation reference
input; it is never the npm publication artifact. The release tag must match
`package.json` `version`. An already published version is skipped, and the docs
job resolves the exact published npm bytes separately before building its asset.

Python publication uses the independent `publish-python.yml` workflow. A
published, non-prerelease GitHub release must match the version in
`python/pyproject.toml`. The workflow builds `cavi-api-client`, tests its installed
wheel without Node/npm, checks distribution metadata, and passes the same wheel
and source archive to the publishing job. That job uses PyPI Trusted Publishing
with the `pypi` GitHub environment; it does not require a stored API token.
Configure the PyPI publisher for GitHub owner `cavi-ai`, repository
`cavi-api-client`, workflow `publish-python.yml`, and environment `pypi`.

`release:dry-run-report` compares the supplied `cavi-release.json` with the
manifest embedded in the documentation archive before emitting a report.
Equivalent JSON formatting is accepted; differing provenance is rejected.
Archive inspection and the reported digest use the same captured archive bytes.
The documentation release workflow also requires host ingestion validation of
the generated archive before uploading assets or dispatching downstream ingestion.

## Documentation model

| Tree | Audience | Role |
| --- | --- | --- |
| `docs/api-client/source` → `docs/api-client/v*` | Product docs / docs host | Generated immutable set; site ingest is the GitHub release docs artifact |
| `docs/guides`, `docs/examples`, `examples` | Contributors and development consumers | Versioned workflows and checked examples; artifact-pinned guidance belongs in source/pages |
| `docs/postman` | Integrators | Generated gateway surface verification |
| `docs/maintainers`, `docs/compatibility` | Maintainers | Process / ledgers; not packed for the host |
| `docs/brand`, `docs/assets` | Packaging / site chrome | Logos and assets |

Do not manually reinterpret a development declaration as a released contract.
Hosts follow [the consumer contract](../api-client/CONSUMER.md) and validate with
`pnpm run docs:host-ingest-check`.

The current committed artifact is
`docs/api-client/v<documented version>`.

## Guardrails

- Public exports and subpath entries are consumer contracts.
- Route literals remain in their owning `paths.ts` or surface-contract files.
- Provider-specific behavior remains inside provider modules.
- Public behavior changes require an Unreleased changelog entry and affected
  documentation updates.
- Never weaken package-hardening or conformance tests to make a change pass.

## Editing consumer documentation

Edit pages under `docs/api-client/source/pages` and its navigation.json.
Keep setup and workflows there; repository provider guides link to those pages.
After edits, run:

```sh
export CAVI_DOCS_PACKAGE_TGZ="$(node scripts/docs/fetch-stable.mjs)"
pnpm run docs:build
pnpm run verify
```

Generation retains exhaustive reference pages and places their links in a hub.
Runtime HTTP provider operations are checked against source transport calls and
built path helpers for verbs and complete route shapes. Run the build before
standalone `docs:check`. Gateway/CAVI pages keep prefix checks; query parameters,
wire schemas, and deployed behavior require separate checks.
Complete introduction, concept, and guide TypeScript snippets are checked against
the pinned release declarations; operation examples can be contextual fragments.
Do not patch generated pages independently or replace an already published
release artifact. Deliver candidate docs through the maintainer release process.
