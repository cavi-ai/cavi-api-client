# README documentation decomposition

## Objective

Replace the monolithic, provider-heavy README with a concise, provider-neutral
front door. Move retained material into logical documentation pages and link to
those pages instead of duplicating their content.

## README boundary

The README will contain only:

- the package's follower/mirror role and provider-neutral purpose;
- installation and a provider-neutral gateway quickstart;
- the universal `RuntimeClient` and `GatewayClient` contract summary;
- a concise supported-entry-point map;
- links to concepts, guides, API reference, migration, architecture, security,
  contributing, and release documentation;
- the local verification command.

The README will not contain provider setup, provider credentials, model names,
provider-specific examples, provider marketing, endpoint catalogs, or detailed
implementation guides.

## Documentation decomposition

Existing source pages under `docs/api-client/source/pages` remain the editable
documentation source. Material retained from the README will be moved into the
closest existing page where one exists:

- runtime and client semantics -> `concepts/runtime-client.md`;
- provider and transport implementation details ->
  `concepts/providers-and-transports.md`;
- routing, capability, and degradation behavior ->
  `concepts/routing-and-capabilities.md`;
- request, streaming, batching, React, files, manifests, and testing examples ->
  their existing `guides/*.md` pages;
- compatibility and migration policy -> the existing compatibility and release
  pages;
- endpoint-level detail -> `API.md` and generated reference pages.

Provider-specific setup and examples will live in dedicated provider guide
pages beneath `docs/api-client/source/pages/guides/providers/`. The README will
link to the provider guide index without naming credentials or prescribing a
provider.

The immutable versioned artifact under `docs/api-client/v0.11.0` will be rebuilt
from the source pages using the repository's documentation tooling rather than
edited independently.

## Contract safety

This change does not remove or rename package exports, alter runtime behavior,
or change the package version. Existing public-surface and package-hardening
tests remain unchanged.

Documentation integrity coverage will assert that the README remains a concise
navigation surface and does not regress to provider credential examples.

## Verification

The completed change must pass `pnpm run verify`, including documentation build
and integrity checks, TypeScript compilation, Markdown linting, and package
dry-run verification.
