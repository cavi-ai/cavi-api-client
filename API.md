# API reference

Start with the [consumer documentation](https://cavi-ai.xyz/docs/api-client)
for provider setup and complete workflows. Prefer `createApiClient` for
application code; use the raw `RuntimeClient` contract when implementing an
adapter or managing its execution interface directly.

## Find the right reference

| Need | Editable source |
| --- | --- |
| Choose and configure a provider | [Provider setup](docs/api-client/source/pages/guides/providers.md) |
| Connect an application endpoint | [Server requests](docs/api-client/source/pages/guides/server.md) |
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

The required package gate is `pnpm run verify`. For runtime HTTP providers,
operation checks compare verbs and complete route shapes against owning
transport calls and built path helpers. Gateway and CAVI pages retain static
prefix checks. These checks do not validate query parameters, wire schemas,
or live backend compatibility.

## Unreleased Codex normalization

Development builds preserve an explicit string `output_text`, including an
empty string. Otherwise, run statuses, successful batch responses, and completed
stream events concatenate `output_text` content from native `message` items in
wire order, without inserted separators. Tool calls, reasoning, refusals, and
malformed items are excluded. Empty text remains an absent normalized `output`.
Partial text does not change a failed or incomplete run into a successful one.

The versioned docs still describe the pinned published package. Check the
[changelog](CHANGELOG.md#unreleased) before relying on this development change.

## Unreleased run outcome errors

`ApiClientErrorType.Run` and `ApiClientErrorCode.RunFailed`, `RunCancelled`,
`RunIncomplete`, and `RunOutputMissing` are additive exports from the root and
`core/errors`. Use them when an application requires completed output:

```ts
import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "@cavi-ai/api-client";

throw new ApiClientError("The run completed without required text", {
  type: ApiClientErrorType.Run,
  code: ApiClientErrorCode.RunOutputMissing,
});
```

Preserve the run in `cause` for protected diagnostics when available.
`RunIncomplete` does not assert backend failure or cancellation, and
`RunCancelled` does not mean a local request was aborted. Providers continue
returning lifecycle states; these codes do not automatically turn a run into
a thrown exception. Versioned examples use the matching string values to stay
compatible with the pinned release.

## Unreleased result helpers

The root and `core/runtime` export `requireCompletedRun`, `requireRunText`,
`requireCompletedStream`, and `requireStreamText`. Completion helpers return
the original object with a narrowed completion state and preserve extra fields.
Text helpers require completion, accept an explicit empty string, and throw
`RunOutputMissing` for absent output. Run text prefers `output` over legacy
`response`; stream text consumes caller-collected `output`.

Failed and cancelled outcomes use `RunFailed` and `RunCancelled`. All other
uncompleted outcomes use `RunIncomplete`, including unknown states, null
stream outcomes, and `dry_run` run states. The original input is retained in
`cause`. Helpers neither validate nullable stream identity nor perform polling,
retries, cancellation, or disposal. Existing client methods are unchanged.

See [complete development examples](docs/guides/run-results.md) for service and
streaming integration. These helpers are not in the pinned published release.

## Maintainer references

- [Architecture](ARCHITECTURE.md): layers and ownership.
- [Development](docs/guides/development.md): generation and package gates.
- [Provider exports](docs/guides/exports.md): exhaustive import inventory.
- [Security](SECURITY.md): disclosure and transport protections.
