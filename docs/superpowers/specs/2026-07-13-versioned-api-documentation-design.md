# Versioned API Documentation Design

**Status:** Approved design checkpoint
**Package:** `@cavi-ai/api-client`
**Initial documented release:** `v0.11.0`
**Public route:** `https://cavi-ai.xyz/docs/api-client`

## Purpose

Create exceptionally high-quality developer documentation for the stable `@cavi-ai/api-client` release. The documentation must explain how to use the package, document its verified public contracts, and make compatibility boundaries explicit.

The package is a follower and mirror of upstream CAVI, Caviclaw, OpenClaw, and gateway APIs. These pages describe the client behavior and compatibility that this package ships and verifies; they do not declare this package to be the canonical runtime protocol.

## Goals

- Give developers a reliable five-minute path from installation to a working request.
- Cover every public export and supported package subpath in the shipped package.
- Document requests, responses, events, errors, routes, and capabilities as explicit contracts.
- Validate examples and reference material against the packed stable artifact.
- Publish immutable, versioned documentation that `cavi-home` can present without maintaining a duplicate editable source.
- Keep unreleased branch behavior out of the stable `v0.11.0` documentation.

## Non-goals

- Defining or replacing canonical upstream runtime contracts.
- Documenting unreleased shared-transport or control-plane work as stable.
- Building an interactive API console or authenticated playground in the first release.
- Editing or deploying `cavi-home` as part of the package-local implementation slice.
- Maintaining handwritten copies of generated API signatures.

## Chosen approach

Use a hybrid, contract-driven documentation system:

1. Curated prose explains installation, concepts, workflows, compatibility, and common failure modes.
2. Generated reference pages derive public signatures from the declarations in the packed stable package.
3. Structured contract records describe semantics that declarations alone cannot express.
4. CI compares the documentation surface with the package export surface and runs type-checked examples.

This gives developers readable guidance while keeping reference truth anchored to the artifact they install.

## Source ownership and versioning

The canonical editable documentation source lives in `cavi-api-client`. The first public documentation set targets the published `v0.11.0` package, even if development continues on a newer branch.

Stable documentation generation must begin from an immutable release input: the `v0.11.0` Git tag or an equivalently verified packed `@cavi-ai/api-client@0.11.0` artifact. It must not infer the stable surface from the current development checkout.

Each generated documentation artifact records package name and version, Git tag and commit when available, packed package digest, public export and subpath manifest, documentation schema version, and generation timestamp.

Versioned output is addressable beneath `/docs/api-client/v0.11.0/`. The unversioned `/docs/api-client` route resolves to the current stable documentation version.

## Architecture

The system contains five bounded components.

### 1. Curated documentation source

Markdown or MDX source contains introductions, concepts, guides, semantic contract notes, examples, and migration information. It may reference public symbols through stable identifiers, but it does not duplicate generated signatures.

### 2. Release artifact inspector

The inspector builds or obtains the immutable stable package, packs it, and reads only the public material a consumer receives: package metadata, export mappings, JavaScript entry points, and TypeScript declarations. Its normalized export manifest is used by generation and validation. Source-only declarations are not public proof.

### 3. Contract registry

Structured records augment TypeScript declarations with behavior and provenance. Each record contains a stable identifier, version, stability, mirrored provenance, linked symbols and routes, lifecycle, field constraints, errors, retry and streaming behavior, transport and capability dependencies, examples, fixtures, and conformance tests.

Capability values are restricted to `supported`, `unsupported`, `conditional`, or `unknown`. The presence of a type never implies runtime support.

### 4. Documentation generator and validator

The generator combines curated content, the export manifest, declarations, and contract records into a portable versioned static artifact. The validator rejects incomplete or contradictory documentation before publishing.

### 5. Site consumer

`cavi-home` consumes the immutable artifact and provides layout, search, routing, and deployment. It does not own or edit API documentation content. Integration with that repository is a separate, explicitly authorized publishing slice.

## Content model and navigation

The public experience uses a developer-first, three-column layout: versioned navigation on the left, content in the center, and an outline plus contract metadata on the right. The top bar includes version selection, search, GitHub, npm, and a link to the CAVI AI landing page.

### Introduction

- What CAVI AI is
- Package scope and upstream relationship
- Installation
- Five-minute quickstart

### Core concepts

- Runtime client
- Providers and transports
- Routing
- Capabilities
- Graceful degradation
- Compatibility model

### Guides

- Requests and responses
- Streaming
- Files and attachments
- Batching
- Manifests
- React integration
- Testing and conformance

### Contracts

- Request envelopes
- Response envelopes
- Streaming events
- Error taxonomy
- Routes
- Capability matrix
- Compatibility guarantees

### API reference

- Every public export
- Every supported package subpath
- Public types, functions, classes, and hooks

### Release information

- Changelog
- Migration guidance
- Version support
- MIT license

## Contract page format

Every contract page begins with machine-derived metadata:

```text
Contract: StreamEvent
Package: @cavi-ai/api-client
Version: 0.11.0
Stability: Stable
Source of truth: Upstream-compatible mirrored contract
Verified by: declaration + fixture + conformance test
```

Each page includes its purpose and lifecycle, packed declaration signature, field requirements, valid and invalid examples, expected failures, error and retry behavior, capability and transport dependencies, compatibility notes, and links to verification evidence.

Generated declarations and curated semantic claims remain visibly distinct. When behavior cannot be proven, the page says `unknown` rather than guessing.

## Build and publishing flow

1. Resolve the immutable `v0.11.0` release input.
2. Build and pack the package in a clean release context.
3. Inspect the tarball, declarations, and export mappings.
4. Produce the normalized public export manifest.
5. Load curated pages and structured contract records.
6. Type-check all examples against the stable package.
7. Generate reference and contract pages.
8. Validate coverage, links, provenance, and internal consistency.
9. Emit a portable, immutable artifact with integrity metadata.
10. In a later publishing slice, have `cavi-home` consume and expose that artifact.

Generated output is reproducible for the same release input and documentation source. The site consumer never silently regenerates reference truth from a different package version.

## Validation and failure handling

The build fails when content names a symbol absent from the packed package, a public export lacks reference coverage, an example fails to type-check, evidence links are missing, stable content leaks a development-only symbol, identifiers or routes are ambiguous, required provenance is absent, navigation is broken, or the declared version disagrees with artifact metadata.

Generation errors identify the page or contract, the expected fact, the observed artifact fact, and a corrective action. Unknown upstream behavior remains explicitly `unknown`; it is not converted into a build failure unless the documentation claims stronger support.

## Verification strategy

Package-local verification includes:

- existing `typecheck:docs` coverage for curated examples;
- packed export-manifest comparison;
- one-to-one export and reference-page coverage;
- contract schema validation;
- fixture and conformance-test link validation;
- invalid-example assertions where deterministic failures exist;
- internal link and navigation validation;
- reproducibility checks;
- the existing full `pnpm run verify` gate;
- dependency audit, packed-tarball consumer import proof, and `git diff --check` before completion claims.

The later `cavi-home` integration requires its own build proof and browser validation of responsive layout, version routing, search, links, and representative contract pages.

## Delivery slices

### Slice 1: package-local documentation foundation

- Documentation source structure and navigation manifest
- Structured contract schema and initial records
- Stable release artifact inspector
- Reference generator and validation commands
- Initial quickstart, concepts, guides, and contract pages for `v0.11.0`
- Portable versioned artifact output

### Slice 2: public site integration

- Explicitly target the separate `cavi-home` repository
- Add artifact ingestion and version routing
- Implement the three-column experience and search
- Verify and deploy `/docs/api-client`

The second slice requires explicit authorization to work in that separate repository.

## Acceptance criteria

The package-local slice is complete when documentation is generated from a verified immutable `v0.11.0` input; every shipped public export and subpath has reference coverage; examples compile against the stable artifact; core request, response, stream, error, route, and capability contracts have structured pages and provenance; unreleased APIs are absent; the artifact contains version and integrity metadata; all documentation and package gates pass; and a consumer can ingest the artifact without package source files.

The public documentation project is complete only after the separately authorized site integration is browser-verified at `cavi-ai.xyz/docs/api-client`.
