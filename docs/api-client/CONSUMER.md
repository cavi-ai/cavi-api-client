# API Documentation Consumer Contract

How a documentation host (for example cavi-ai.xyz) ingests and serves the
immutable `@cavi-ai/api-client` documentation artifact.

## Canonical ingest source

**GitHub Release asset** (authoritative):

```text
asset: cavi-api-client-docs-v{VERSION}.tar.gz
sidecar: cavi-api-client-docs-v{VERSION}.tar.gz.sha256
release tag: v{VERSION}
```

Built by the package publish workflow from the exact npm tarball for `{VERSION}`.
Do **not** treat the npm package as the site ingest authority.

### Convenience mirror (non-authoritative)

The npm package may include `docs/api-client/v{VERSION}/` for offline reading.
Hosts may preview from a checkout or `node_modules`, but production promotion
must use the GitHub release docs artifact for that version.

## Layout after unpack

```text
source: docs/api-client/v{VERSION}   (or the artifact root equivalent)
publicBasePath: /docs/api-client/v{VERSION}
stableAlias: /docs/api-client
entrypoints: manifest.json, navigation.json
identity: manifest.package
sourceIntegrity: manifest.sourceTarballSha256
contentIntegrity: manifest.contentSha256
```

## Host checklist

1. Download `cavi-api-client-docs-v{VERSION}.tar.gz` from the `v{VERSION}` GitHub release.
2. Verify the `.sha256` sidecar (or published digest) matches the archive.
3. Unpack and locate `manifest.json` + `navigation.json`.
4. Assert `manifest.package == "@cavi-ai/api-client"`.
5. Assert `manifest.version == "{VERSION}"` and matches the release tag (`v{VERSION}`).
6. Assert `manifest.sourceTarballSha256` equals the SHA-256 of the published npm tarball for that version.
7. Recompute `contentSha256`: hash every artifact file except `manifest.json`, in lexical path order, as `path`, NUL, bytes, NUL; must equal `manifest.contentSha256`.
8. Publish under `/docs/api-client/v{VERSION}` only after validation succeeds.
9. Point `/docs/api-client` at that version only after step 8 (stable alias).
10. On mismatch: **fail closed** — do not promote the alias.

Run the package helper (from a checkout with the unpacked tree or archive):

```bash
pnpm run docs:host-ingest-check -- --dir path/to/unpacked-docs
# or
pnpm run docs:host-ingest-check -- --archive cavi-api-client-docs-v0.15.0.tar.gz
```

## Navigation contract

`navigation.json` drives host IA:

| Field | Role |
| --- | --- |
| `sections[].title` | Top-level nav groups (Introduction, Concepts, Guides, Operations, Type reference, …) |
| `sections[].pages[]` | `{ title, path }` entries; paths are relative to `publicBasePath` |
| `reference[]` | Full declaration export index (subpath → `reference/*.md`); mirrors Type reference pages |

Hosts must skip empty sections and must not invent pages absent from the artifact.

## Immutability

Consumers must not edit generated pages. Replace the complete versioned directory
(or re-ingest the release asset) when upgrading. Fail ingestion on version or digest mismatch.
