# API Documentation Consumer Contract

This contract describes how a documentation host consumes the immutable
documentation artifact built from and for the immutable `@cavi-ai/api-client`
`0.14.0` release surface.

```text
source: docs/api-client/v0.14.0
publicBasePath: /docs/api-client/v0.14.0
stableAlias: /docs/api-client
entrypoints: manifest.json, navigation.json
identity: manifest.package
sourceIntegrity: manifest.sourceTarballSha256
contentIntegrity: manifest.contentSha256
```

## Authority And Delivery

The repository source is the editable documentation authority. A documentation
release is built from that source and the exact published npm artifact; the
GitHub Release asset is the immutable delivery authority consumed by
documentation hosts.

The release asset is named `cavi-api-client-docs-vX.Y.Z.tar.gz`. Its root
contains `cavi-release.json` and `docs/`; a matching `.sha256` sidecar records
the archive digest. The producer sends a schema-version-1 `cavi-oss-release`
envelope to the host only after the asset has been verified and uploaded.

Extract and validate the complete version directory before serving
`/docs/api-client` as its stable alias. Use `manifest.json` as the documentation
manifest and `navigation.json` as the navigation entry point. Paths in
`navigation.json` are relative to the public base path.

The release workflow also supports a historical backfill for an existing,
published, non-prerelease version. A backfill rebuilds from the exact npm
artifact and release commit; it accepts an existing asset only when the bytes
are identical and never republishes the npm package.

## Integrity And Immutability

The manifest version must equal the documented package version, `0.14.0`.
`manifest.package` must be `@cavi-ai/api-client`, and
`manifest.sourceTarballSha256` must equal
`3327537cf74089970251c1983fa786f95c843fb061f0411fe3ee651939d1638e`, the
SHA-256 digest of the packed `@cavi-ai/api-client@0.14.0` authority artifact.
Verify `manifest.contentSha256` by hashing every artifact file except
`manifest.json`, in lexical path order, as `path`, NUL, bytes, NUL. This
separate digest prevents source-artifact identity from being mistaken for
generated-content integrity.

Consumers must fail ingestion on a version or digest mismatch.
Consumers must not edit generated pages; replace the complete versioned
directory with a newly validated immutable artifact when upgrading.
