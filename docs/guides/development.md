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
stable package tarball identified by `CAVI_API_CLIENT_STABLE_TARBALL`.

## Documentation model

Repository guides describe how to work with the current checkout. Immutable
release documentation lives in a versioned directory under `docs/api-client/`
and is generated from an exact packed artifact. Do not manually reinterpret a
development declaration as a released contract.

The current committed artifact is `docs/api-client/v0.11.0`. Its
`manifest.json` records the package digest and content digest, while
`navigation.json` defines the published page order. Hosts copying that artifact
must follow [the consumer contract](../api-client/CONSUMER.md).

## Guardrails

- Public exports and subpath entries are consumer contracts.
- Route literals remain in their owning `paths.ts` or surface-contract files.
- Provider-specific behavior remains inside provider modules.
- Public behavior changes require an Unreleased changelog entry and affected
  documentation updates.
- Never weaken package-hardening or conformance tests to make a change pass.

Release maintainers who need durable consuming-application evidence should use
the separate [consumer verification procedure](../maintainers/consumer-verification.md).
