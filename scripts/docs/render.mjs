import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { normalizedRelativePath, safeSlug } from "./paths.mjs";

function readContainedFile(root, relativePath, label) {
  normalizedRelativePath(relativePath, label);
  const resolvedRoot = realpathSync(root);
  const candidate = path.join(resolvedRoot, relativePath);
  const resolved = realpathSync(candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`${label}: resolved target escapes root: ${relativePath}`);
  return readFileSync(resolved, "utf8");
}

/** @typedef {import("./types.mjs").ReleaseManifest} ReleaseManifest */

/** @param {string} subpath */
export function subpathSlug(subpath) {
  if (subpath === ".") return "index";
  if (typeof subpath !== "string" || !subpath.startsWith("./")) throw new Error(`subpath: invalid public subpath ${String(subpath)}`);
  return safeSlug(subpath.slice(2).replaceAll("/", "-"), "subpath slug");
}

/** @param {string} subpath @param {string} name */
function symbolAnchor(subpath, name) {
  const identity = `${subpath === "." ? "root" : subpath.slice(2)}-${name}`;
  return `symbol-${identity.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-|-$/gu, "")}`;
}

/** @param {import("./types.mjs").ReleaseSymbol} symbol */
function declarationSignature(symbol) {
  if (typeof symbol.signature !== "string" || !symbol.signature.trim()) {
    throw new Error(`${symbol.subpath}:${symbol.name}: expected declaration signature from stable release manifest; observed missing`);
  }
  return symbol.signature.trim();
}

/** @param {ReleaseManifest} manifest @param {string} subpath */
function renderReferencePage(manifest, subpath) {
  const title = subpath === "." ? manifest.package : `${manifest.package}/${subpath.slice(2)}`;
  const symbols = manifest.symbols
    .filter((symbol) => symbol.subpath === subpath)
    .sort((left, right) => left.name.localeCompare(right.name) || left.kind.localeCompare(right.kind));
  const body = symbols.map((symbol) => [
    `<a id="${symbolAnchor(symbol.subpath, symbol.name)}"></a>`,
    "",
    `## ${symbol.name}`,
    "",
    `Kind: ${symbol.kind}`,
    "",
    "```ts",
    declarationSignature(symbol),
    "```",
    "",
  ].join("\n"));
  return [`# ${title}`, "", `Package subpath: ${subpath}`, "", ...body].join("\n");
}

/** @param {import("./contracts.mjs").ContractRecord} contract @param {string} packageName */
function renderContractPage(contract, packageName) {
  const symbols = contract.symbols.map(({ subpath, name }) => `- \`${subpath}:${name}\``).join("\n");
  const evidence = contract.evidence.map((item) => `- ${item.type}: \`${item.path}\``).join("\n");
  const signatures = contract.symbols.map(({ subpath, name, signature }) => `### ${name}\n\n\`\`\`ts\n${signature}\n\`\`\``).join("\n\n");
  return [
    `# ${contract.title}`,
    "",
    `Package: ${packageName}`,
    "Verified by: declaration + fixture + conformance test",
    `Contract: ${contract.id}`,
    `Version: ${contract.version}`,
    `Stability: ${contract.stability}`,
    `Source of truth: ${contract.sourceOfTruth}`,
    `Capability: ${contract.capability}`,
    "",
    contract.summary,
    "",
    "## Purpose and lifecycle", "", contract.purpose, "", contract.lifecycle,
    "", "## Packed declaration signatures", "", signatures,
    "", "## Field constraints", "", contract.fieldConstraints.map((item) => `- **${item.field}**: ${item.constraint}`).join("\n"),
    "", "## Behavior", "", `Errors: ${contract.behavior.errors}`, `Retry: ${contract.behavior.retry}`, `Cancellation: ${contract.behavior.cancellation}`, `Streaming: ${contract.behavior.streaming}`,
    "", "## Dependencies", "", `Capabilities: ${contract.dependencies.capabilities.join(", ")}`, `Transports: ${contract.dependencies.transports.join(", ")}`,
    "", "## Valid example", "", "```json", JSON.stringify(contract.examples.valid.value, null, 2), "```", "", contract.examples.valid.expected,
    "", "## Invalid example", "", "```json", JSON.stringify(contract.examples.invalid.value, null, 2), "```", "", `Expected failure: ${contract.examples.invalid.expectedFailure}`,
    "", "## Compatibility notes", "", contract.compatibilityNotes,
    "",
    "## Public symbols",
    "",
    symbols,
    "",
    "## Verification evidence",
    "",
    evidence,
    "",
  ].join("\n");
}

/**
 * @param {{manifest: ReleaseManifest, contracts: import("./contracts.mjs").ContractRecord[], navigation: unknown, curatedRoot: string, sourceDateEpoch: number|string, release?: {packageName:string}}} input
 * @returns {Map<string, string>}
 */
export function renderDocumentation(input) {
  const epoch = Number(input.sourceDateEpoch);
  if (!Number.isInteger(epoch) || epoch < 0) {
    throw new Error(`sourceDateEpoch: expected a non-negative integer; observed ${input.sourceDateEpoch}`);
  }
  const generatedAt = new Date(epoch * 1000);
  if (Number.isNaN(generatedAt.valueOf())) {
    throw new Error(`sourceDateEpoch: expected a representable timestamp; observed ${input.sourceDateEpoch}`);
  }

  /** @type {Map<string, string>} */
  const output = new Map();
  const packageName = input.release?.packageName ?? input.manifest.package;
  const navigation = structuredClone(input.navigation);
  if (navigation && typeof navigation === "object" && !Array.isArray(navigation)) {
    navigation.version = input.manifest.version;
    navigation.reference = [...input.manifest.exports]
      .sort((left, right) => left.subpath.localeCompare(right.subpath))
      .map((releaseExport) => releaseExport.kind === "declaration"
        ? {
            subpath: releaseExport.subpath,
            kind: "declaration",
            path: `reference/${subpathSlug(releaseExport.subpath)}.md`,
          }
        : {
            subpath: releaseExport.subpath,
            kind: "asset",
            target: releaseExport.target,
          });
  }
  output.set("navigation.json", `${JSON.stringify(navigation, null, 2)}\n`);

  for (const releaseExport of [...input.manifest.exports].sort((a, b) => a.subpath.localeCompare(b.subpath))) {
    if (releaseExport.kind !== "declaration") continue;
    output.set(
      `reference/${subpathSlug(releaseExport.subpath)}.md`,
      renderReferencePage(input.manifest, releaseExport.subpath),
    );
  }
  for (const contract of [...input.contracts].sort((a, b) => a.id.localeCompare(b.id))) {
    safeSlug(contract.id, "contract id");
    output.set(`contracts/${contract.id}.md`, renderContractPage(contract, packageName));
  }

  for (const pagePath of navigationPaths(input.navigation)) {
    normalizedRelativePath(pagePath, "navigation path");
    if (!pagePath.startsWith("reference/") && !pagePath.startsWith("contracts/")) {
      output.set(pagePath, readContainedFile(path.join(input.curatedRoot, "pages"), pagePath, "curated page path"));
    }
  }

  const examplesRoot = path.join(input.curatedRoot, "..", "..", "examples");
  const excludedStableExamples = new Set(["custom-runtime-provider.ts"]);
  if (existsSync(examplesRoot)) {
    for (const entry of readdirSync(examplesRoot, { withFileTypes: true })) {
      if (entry.isFile() && /\.tsx?$/u.test(entry.name) && !excludedStableExamples.has(entry.name)) {
        output.set(`examples/${entry.name}`, readContainedFile(examplesRoot, entry.name, "example path"));
      }
    }
  }

  validateRenderedDocumentation(output, input.manifest);
  const contentSha256 = createHash("sha256");
  for (const [filePath, contents] of [...output].sort(([a], [b]) => a.localeCompare(b))) {
    contentSha256.update(filePath).update("\0").update(contents).update("\0");
  }
  output.set("manifest.json", `${JSON.stringify({
    package: input.manifest.package,
    version: input.manifest.version,
    release: { tag: input.manifest.tag ?? `v${input.manifest.version}`, ...(input.manifest.commit ? { commit: input.manifest.commit } : {}) },
    sourceTarballSha256: input.manifest.sha256,
    contentSha256: contentSha256.digest("hex"),
    publicExports: [...input.manifest.exports].sort((a, b) => a.subpath.localeCompare(b.subpath)),
    schemaVersion: 2,
    generatedAt: generatedAt.toISOString(),
  }, null, 2)}\n`);
  return new Map([...output].sort(([left], [right]) => left.localeCompare(right)));
}

/** @param {unknown} value @returns {string[]} */
function navigationPaths(value) {
  if (Array.isArray(value)) return value.flatMap(navigationPaths);
  if (!value || typeof value !== "object") return [];
  const entry = /** @type {Record<string, unknown>} */ (value);
  return [
    ...(typeof entry.path === "string" ? [entry.path] : []),
    ...Object.values(entry).flatMap(navigationPaths),
  ];
}

/** @param {Map<string, string>} output @param {ReleaseManifest} manifest */
export function validateRenderedDocumentation(output, manifest) {
  /** @type {string[]} */
  const diagnostics = [];
  for (const releaseExport of manifest.exports) {
    if (releaseExport.kind !== "declaration") continue;
    const pagePath = `reference/${subpathSlug(releaseExport.subpath)}.md`;
    if (!output.has(pagePath)) {
      diagnostics.push(`${releaseExport.subpath}: expected reference index page ${pagePath}; observed missing`);
    }
  }
  const renderedText = [...output.values()].join("\n");
  for (const symbol of manifest.symbols) {
    const identity = `${symbol.subpath}:${symbol.name}`;
    const anchor = `<a id="${symbolAnchor(symbol.subpath, symbol.name)}"></a>`;
    const occurrences = renderedText.split(anchor).length - 1;
    if (occurrences !== 1) {
      diagnostics.push(`${identity}: expected exactly one reference anchor; observed ${occurrences}`);
    }
  }
  if (diagnostics.length) throw new Error(diagnostics.join("\n"));
}
