# README Documentation Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `README.md` into a concise provider-neutral entry page and relocate its implementation material into focused, navigable documentation pages.

**Architecture:** `README.md` becomes the stable front door and links to source-authored guides. The editable documentation remains under `docs/api-client/source/pages`; the immutable `docs/api-client/v0.11.0` tree is regenerated through the existing docs builder. Export coverage moves from README-specific assertions to a dedicated imports-and-exports guide so README no longer has to enumerate provider subpaths.

**Tech Stack:** Markdown, Vitest, Node.js documentation renderer, TypeScript package verification, markdownlint-cli2.

## Global Constraints

- Do not remove, rename, or alter any published export or runtime behavior.
- Do not change `package.json` version.
- Keep the package provider-neutral and describe it as a follower/mirror of upstream runtime contracts.
- Keep provider setup, provider credentials, model names, provider examples, and provider marketing out of `README.md`.
- Edit generated versioned documentation only through the repository documentation build.
- Do not commit without separate user authorization.

---

### Task 1: Lock the README boundary and relocate export coverage

**Files:**

- Modify: `src/__tests__/docs-integrity.test.ts`
- Create: `docs/api-client/source/pages/guides/imports-and-exports.md`
- Modify: `docs/api-client/source/navigation.json`

**Interfaces:**

- Consumes: `package.json#exports` and the existing source documentation navigation format.
- Produces: an export catalog that owns exhaustive subpath documentation and a README guard that enforces provider neutrality.

- [ ] **Step 1: Write failing integrity assertions**

Add `const importsAndExports = read("docs/api-client/source/pages/guides/imports-and-exports.md");`. Replace the test that requires every export in README with an equivalent loop over `importsAndExports`. Add a test that expects README to link to the import guide, stay below 300 lines, and omit provider implementation tokens:

```ts
it("keeps README as a provider-neutral documentation index", () => {
  expect(readme.split("\n").length).toBeLessThan(300);
  expect(readme).toContain("docs/api-client/source/pages/guides/imports-and-exports.md");
  for (const token of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "Claude Managed Agents",
    "gpt-5-codex",
    "claude-opus",
    "gemini-",
  ]) {
    expect(readme, `README contains provider implementation detail: ${token}`).not.toContain(token);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm test src/__tests__/docs-integrity.test.ts`

Expected: FAIL because README is over 300 lines, contains provider details, and the import guide does not exist.

- [ ] **Step 3: Create the exhaustive import catalog and navigation entry**

Create the guide with frontmatter `documentedVersion: 0.11.0`, explain root versus subpath imports, and list every `package.json#exports` key exactly once. Add `guides/imports-and-exports.md` to the Guides list in `docs/api-client/source/navigation.json`.

- [ ] **Step 4: Run the focused export assertions**

Run: `pnpm test src/__tests__/docs-integrity.test.ts`

Expected: README-neutrality assertions remain red; export-catalog assertions pass.

### Task 2: Split provider implementation material into provider guides

**Files:**

- Create: `docs/api-client/source/pages/guides/providers/index.md`
- Create: `docs/api-client/source/pages/guides/providers/hermes.md`
- Create: `docs/api-client/source/pages/guides/providers/openclaw.md`
- Create: `docs/api-client/source/pages/guides/providers/claude.md`
- Create: `docs/api-client/source/pages/guides/providers/codex.md`
- Create: `docs/api-client/source/pages/guides/providers/gemini.md`
- Modify: `docs/api-client/source/navigation.json`

**Interfaces:**

- Consumes: current provider examples and credential guidance from `README.md`.
- Produces: one provider-guide index plus one focused page per shipped provider family.

- [ ] **Step 1: Add provider pages with version frontmatter**

Each page begins with:

```yaml
---
documentedVersion: 0.11.0
---
```

The index explains that provider modules adapt upstream-owned APIs to universal contracts. Each provider page owns only that provider's imports, required upstream credentials, construction example, supported surfaces, and links to generated reference pages.

- [ ] **Step 2: Add provider navigation**

Add a nested Providers group beneath Guides in `navigation.json`, pointing to the six new pages.

- [ ] **Step 3: Validate source navigation**

Run: `pnpm docs:check`

Expected: FAIL until the generated versioned artifact is rebuilt, proving source and generated docs differ.

### Task 3: Rewrite README as the provider-neutral front door

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Interfaces:**

- Consumes: focused source pages and the versioned documentation artifact.
- Produces: a README under 300 lines with no provider credentials, provider walkthroughs, model names, or provider marketing.

- [ ] **Step 1: Replace the monolith with a neutral index**

Keep: package identity, follower/mirror boundary, installation, generic gateway quickstart, universal contract summary, documentation map, compatibility statement, `pnpm run verify`, contribution/security/license links.

The quickstart uses only `createGatewayApiClient`, an application-selected gateway URL, and optional gateway bearer authentication. It does not name or configure a model provider.

- [ ] **Step 2: Link logical docs once**

Link the overview, quickstart, runtime concepts, providers/transports concept, routing/capabilities, imports/exports, guides index, API reference, architecture, migration, changelog, security, and contributing docs. Do not duplicate their content.

- [ ] **Step 3: Add the Unreleased changelog entry**

Under `[Unreleased]`, state that the monolithic README was decomposed, provider-specific setup moved to focused guides, and exhaustive import documentation moved to its own guide. Do not imply runtime or public API changes.

- [ ] **Step 4: Run the focused integrity test and verify GREEN**

Run: `pnpm test src/__tests__/docs-integrity.test.ts`

Expected: PASS.

### Task 4: Rebuild immutable docs and verify release integrity

**Files:**

- Modify: generated pages and `navigation.json` beneath `docs/api-client/v0.11.0`

**Interfaces:**

- Consumes: source-authored pages, navigation, the configured stable package tarball, and source-date epoch.
- Produces: reproducible versioned documentation matching the updated source tree.

- [ ] **Step 1: Run the repository documentation build**

Run:

```sh
CAVI_DOCS_PACKAGE_TGZ=/tmp/cavi-docs-stable/cavi-ai-api-client-0.11.0.tgz SOURCE_DATE_EPOCH=1783740944 pnpm docs:build
```

Use the stable tarball already provisioned at the CI-defined path. Do not
hand-edit generated pages.

- [ ] **Step 2: Verify documentation integrity**

Run: `pnpm docs:check`

Expected: PASS with no generated drift.

- [ ] **Step 3: Run Markdown lint**

Run: `pnpm exec markdownlint-cli2 '**/*.md' '#node_modules' '#dist'`

Expected: PASS.

### Task 5: Run full package proof

**Files:**

- Verify only; fix only task-related failures in files listed above.

**Interfaces:**

- Consumes: the complete documentation decomposition.
- Produces: release-grade evidence that docs, tests, types, build, and package contents remain valid.

- [ ] **Step 1: Update the knowledge graph and inspect affected flows**

Run the graph incremental update, change detection, and affected-flow analysis for the changed documentation and integrity-test files.

- [ ] **Step 2: Run the mandatory package gate**

Run: `pnpm run verify`

Expected: PASS for tests, documentation typechecking, TypeScript build, docs drift check, Markdown lint, and package dry run.

- [ ] **Step 3: Inspect scope and whitespace**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and only documentation decomposition files plus the focused integrity test are modified.
