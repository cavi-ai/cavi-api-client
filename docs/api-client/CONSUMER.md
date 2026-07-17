# API Documentation Consumer Contract

This contract describes how a documentation host consumes the immutable
documentation artifact built from and for the immutable `@cavi-ai/api-client`
`0.12.0` release surface.

```text
source: docs/api-client/v0.12.0
publicBasePath: /docs/api-client/v0.12.0
stableAlias: /docs/api-client
entrypoints: manifest.json, navigation.json
identity: manifest.package
sourceIntegrity: manifest.sourceTarballSha256
contentIntegrity: manifest.contentSha256
```

## Copy And Install

The already-published npm package `@cavi-ai/api-client@0.12.0` does not contain
this subsequently generated documentation. Until a future package release
separately publishes it, copy the complete `docs/api-client/v0.12.0` directory
from this repository checkout or its CI documentation artifact to the host's
`/docs/api-client/v0.12.0` public base path. Serve `/docs/api-client` as an
alias to that immutable version only after validation succeeds. Do not merge
files from another package version into this directory.

Use `manifest.json` to validate the artifact and `navigation.json` as the
navigation entry point. Paths in `navigation.json` are relative to the public
base path.

## Integrity And Immutability

The manifest version must equal the documented package version, `0.12.0`.
`manifest.package` must be `@cavi-ai/api-client`, and
`manifest.sourceTarballSha256` must equal
`3327537cf74089970251c1983fa786f95c843fb061f0411fe3ee651939d1638e`, the
SHA-256 digest of the packed `@cavi-ai/api-client@0.12.0` authority artifact.
Verify `manifest.contentSha256` by hashing every artifact file except
`manifest.json`, in lexical path order, as `path`, NUL, bytes, NUL. This
separate digest prevents source-artifact identity from being mistaken for
generated-content integrity.

Consumers must fail ingestion on a version or digest mismatch.
Consumers must not edit generated pages; replace the complete versioned
directory with a newly validated immutable artifact when upgrading.
