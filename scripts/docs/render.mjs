/** @typedef {import("./types.mjs").ReleaseManifest} ReleaseManifest */

/** @param {string} subpath */
export function subpathSlug(subpath) {
  return subpath === "." ? "index" : subpath.slice(2).replaceAll("/", "-");
}

/** @param {string} subpath @param {string} name */
function symbolAnchor(subpath, name) {
  const identity = `${subpath === "." ? "root" : subpath.slice(2)}-${name}`;
  return `symbol-${identity.toLowerCase().replaceAll(/[^a-z0-9]+/gu, "-").replaceAll(/^-|-$/gu, "")}`;
}

/** @param {import("./types.mjs").ReleaseSymbol & {signature?: string}} symbol */
function declarationSignature(symbol) {
  if (symbol.signature) return symbol.signature.trim();
  if (symbol.kind === "variable") return `export const ${symbol.name};`;
  return `export ${symbol.kind} ${symbol.name};`;
}

/** @param {ReleaseManifest} manifest @param {string} subpath */
function renderReferencePage(manifest, subpath) {
  const title = subpath === "." ? manifest.package : `${manifest.package}/${subpath.slice(2)}`;
  const symbols = manifest.symbols
    .filter((symbol) => symbol.subpath === subpath)
    .sort((left, right) => left.name.localeCompare(right.name) || left.kind.localeCompare(right.kind));
  const body = symbols.map((symbol) => [
    `<a id="${symbolAnchor(symbol.subpath, symbol.name)}"></a>`,
    `## ${symbol.name}`,
    "",
    `Kind: ${symbol.kind}`,
    "",
    "```ts",
    declarationSignature(symbol),
    "```",
  ].join("\n"));
  return [`# ${title}`, "", `Package subpath: ${subpath}`, "", ...body, ""].join("\n");
}

/** @param {import("./contracts.mjs").ContractRecord} contract */
function renderContractPage(contract) {
  const symbols = contract.symbols.map(({ subpath, name }) => `- \`${subpath}:${name}\``).join("\n");
  const evidence = contract.evidence.map((item) => `- \`${item}\``).join("\n");
  return [
    `# ${contract.title}`,
    "",
    `Contract: ${contract.id}`,
    `Version: ${contract.version}`,
    `Stability: ${contract.stability}`,
    `Source of truth: ${contract.sourceOfTruth}`,
    `Capability: ${contract.capability}`,
    "",
    contract.summary,
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
 * @param {{manifest: ReleaseManifest, contracts: import("./contracts.mjs").ContractRecord[], navigation: unknown, curatedRoot: string, sourceDateEpoch: number|string}} input
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
  output.set("manifest.json", `${JSON.stringify({
    package: input.manifest.package,
    version: input.manifest.version,
    tag: `v${input.manifest.version}`,
    sha256: input.manifest.sha256,
    tarballDigest: `sha256:${input.manifest.sha256}`,
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
  }, null, 2)}\n`);
  output.set("navigation.json", `${JSON.stringify(input.navigation, null, 2)}\n`);

  for (const releaseExport of [...input.manifest.exports].sort((a, b) => a.subpath.localeCompare(b.subpath))) {
    output.set(
      `reference/${subpathSlug(releaseExport.subpath)}.md`,
      renderReferencePage(input.manifest, releaseExport.subpath),
    );
  }
  for (const contract of [...input.contracts].sort((a, b) => a.id.localeCompare(b.id))) {
    output.set(`contracts/${contract.id}.md`, renderContractPage(contract));
  }

  validateRenderedDocumentation(output, input.manifest);
  return new Map([...output].sort(([left], [right]) => left.localeCompare(right)));
}

/** @param {Map<string, string>} output @param {ReleaseManifest} manifest */
export function validateRenderedDocumentation(output, manifest) {
  /** @type {string[]} */
  const diagnostics = [];
  for (const releaseExport of manifest.exports) {
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
