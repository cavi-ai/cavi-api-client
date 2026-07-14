# API Documentation Consumer Contract

This contract describes how a documentation host consumes the immutable
`@cavi-ai/api-client` `0.11.0` artifact shipped in this package.

```text
source: docs/api-client/v0.11.0
publicBasePath: /docs/api-client/v0.11.0
stableAlias: /docs/api-client
entrypoints: manifest.json, navigation.json
identity: manifest.package
integrity: manifest.sha256
```

## Copy And Install

After installing `@cavi-ai/api-client@0.11.0`, copy the complete
`docs/api-client/v0.11.0` directory from the installed package to the host's
`/docs/api-client/v0.11.0` public base path. Serve `/docs/api-client` as an
alias to that immutable version only after validation succeeds. Do not merge
files from another package version into this directory.

Use `manifest.json` to validate the artifact and `navigation.json` as the
navigation entry point. Paths in `navigation.json` are relative to the public
base path.

## Integrity And Immutability

The manifest version must equal the installed package version, `0.11.0`. The
contract's identity and integrity keys map directly to the generated manifest's
top-level `package` and `sha256` fields. `manifest.package` must be
`@cavi-ai/api-client`, and `manifest.sha256` must equal
`93b1abc345e42de4e3e4a8744b2dc72d5ed850952ff9176bb179382f79ffc13a`, the
SHA-256 digest of the packed `@cavi-ai/api-client@0.11.0` authority artifact.

Consumers must fail ingestion on a version or digest mismatch.
Consumers must not edit generated pages; replace the complete versioned
directory with a newly validated immutable artifact when upgrading.
