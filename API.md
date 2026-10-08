# API reference

Start with the [consumer documentation](https://cavi-ai.xyz/docs/api-client)
for provider setup and complete workflows. Prefer `createApiClient` for
application code; use the raw `RuntimeClient` contract when implementing an
adapter or managing its execution interface directly.

## Find the right reference

| Need | Editable source |
| --- | --- |
| Choose and configure a provider | [Provider setup](docs/api-client/source/pages/guides/providers.md) |
| Run, retrieve, and cancel work | [Requests](docs/api-client/source/pages/guides/requests.md) |
| Handle stream events and terminal states | [Streaming](docs/api-client/source/pages/guides/streaming.md) |
| Handle gaps and exceptions | [Error handling](docs/api-client/source/pages/guides/errors.md) |
| Select an import path | [Imports](docs/api-client/source/pages/guides/imports.md) |
| Inspect raw method signatures and mappings | [Operations](docs/api-client/source/pages/operations/index.md) |
| Upgrade a consumer | [Migration](MIGRATION.md) |

Generated declaration references cover every published subpath, including the
opt-in OpenCode provider. They are built from the pinned package tarball rather
than inferred from development source. `package.json` `exports` is the import
contract; the generated release manifest identifies the documented surface.

## Documentation sources and delivery

Consumer guidance lives in `docs/api-client/source/pages`; edit it there and
regenerate the versioned artifact. The built tree lives under
`docs/api-client/v<package.json version>`. Repository provider guides are
pointers into that consumer guidance; maintainer procedures remain separate.

The docs site ingests the GitHub release asset
`cavi-api-client-docs-v{VERSION}.tar.gz`. The npm package contains a convenience
copy for offline reading. See the [consumer contract](docs/api-client/CONSUMER.md)
for provenance, navigation, and integrity requirements.

```sh
export CAVI_DOCS_PACKAGE_TGZ="$(node scripts/docs/fetch-stable.mjs)"
pnpm run docs:build
pnpm run build
pnpm docs:check
```

The required package gate is `pnpm run verify`. Operation endpoint checks
validate static path prefixes against owning source files; they do not by
themselves prove provider behavior or live backend compatibility.

## Maintainer references

- [Architecture](ARCHITECTURE.md): layers and ownership.
- [Development](docs/guides/development.md): generation and package gates.
- [Provider exports](docs/guides/exports.md): exhaustive import inventory.
- [Security](SECURITY.md): disclosure and transport protections.
