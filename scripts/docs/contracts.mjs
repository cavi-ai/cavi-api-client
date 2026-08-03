import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { CAPABILITY_STATES, resolveDocumentationRelease } from "./types.mjs";
import { normalizedRelativePath, safeSlug } from "./paths.mjs";
import { resolveDocumentedVersionToken } from "./version-tokens.mjs";

const CONTRACTS_DIRECTORY = "docs/api-client/source/contracts";
const REQUIRED_KEYS = ["id", "title", "version", "stability", "sourceOfTruth", "symbols", "capability", "evidence", "summary", "purpose", "lifecycle", "fieldConstraints", "behavior", "dependencies", "examples", "compatibilityNotes"];
const SOURCE_OF_TRUTH = "upstream-compatible-mirror";
const REQUIRED_EVIDENCE_TYPES = ["declaration", "fixture", "conformance-test"];

/** @typedef {{subpath: string, name: string}} ContractSymbol */
/** @typedef {{id: string, title: string, version: string, stability: "stable", sourceOfTruth: "upstream-compatible-mirror", symbols: Array<ContractSymbol & {signature:string}>, capability: import("./types.mjs").CapabilityState, evidence: Array<{type:string,path:string}>, summary: string, purpose:string, lifecycle:string, fieldConstraints:Array<{field:string,constraint:string}>, behavior:{errors:string,retry:string,cancellation:string,streaming:string}, dependencies:{capabilities:string[],transports:string[]}, examples:{valid:{value:unknown,expected:string},invalid:{value:unknown,expectedFailure:string}}, compatibilityNotes:string}} ContractRecord */
/** @typedef {{contractId: string, requirement: string, observed: string, action: string}} ContractDiagnostic */

/** @param {ContractDiagnostic} diagnostic */
function formatDiagnostic({ contractId, requirement, observed, action }) {
  return `${contractId}: expected ${requirement}; observed ${observed}; fix: ${action}`;
}

/** @param {unknown} value */
function shown(value) {
  if (typeof value === "string") return value || "empty";
  if (value === undefined) return "missing";
  return JSON.stringify(value);
}

/** @param {unknown} value */
function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} value */
function semver(value) {
  return typeof value === "string" && /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.test(value);
}

/** @param {string} root @param {string} relativePath */
function repositoryPath(root, relativePath) {
  try { normalizedRelativePath(relativePath, "evidence path"); } catch { return undefined; }
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  return relative.startsWith("..") || path.isAbsolute(relative) ? undefined : resolved;
}

/** @param {string} root @param {import("./types.mjs").ReleaseManifest} manifest @param {ReturnType<typeof resolveDocumentationRelease>} [release] @returns {Promise<ContractRecord[]>} */
export async function loadContracts(root, manifest, release = resolveDocumentationRelease()) {
  const resolvedRoot = await realpath(root);
  const directory = path.join(root, CONTRACTS_DIRECTORY);
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  /** @type {ContractDiagnostic[]} */
  const diagnostics = [];
  /** @type {ContractRecord[]} */
  const records = [];

  if (manifest.package !== release.packageName) {
    diagnostics.push({ contractId: "registry", requirement: `manifest package to equal ${release.packageName}`, observed: shown(manifest.package), action: `use the ${release.packageName} release manifest` });
  }

  for (const filename of filenames) {
    const fallbackId = path.basename(filename, ".json");
    let source;
    try {
      source = await readFile(path.join(directory, filename), "utf8");
    } catch (error) {
      diagnostics.push({ contractId: fallbackId, requirement: "a readable JSON source", observed: error instanceof Error ? error.message : String(error), action: "restore the contract source file" });
      continue;
    }
    try {
      source = resolveDocumentedVersionToken(
        source,
        release.version,
        `contract source ${filename}`,
      );
    } catch (error) {
      diagnostics.push({ contractId: fallbackId, requirement: "canonical documentation version tokens", observed: error instanceof Error ? error.message : String(error), action: "replace release versions with {{documentedVersion}}" });
      continue;
    }
    let candidate;
    try {
      candidate = JSON.parse(source);
    } catch (error) {
      diagnostics.push({ contractId: fallbackId, requirement: "valid JSON", observed: error instanceof Error ? error.message : String(error), action: "correct the JSON record" });
      continue;
    }
    const record = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? /** @type {Record<string, unknown>} */ (candidate) : {};
    const id = nonEmptyString(record.id) ? /** @type {string} */ (record.id) : fallbackId;
    try { safeSlug(id, "contract id"); } catch (error) {
      diagnostics.push({ contractId: id, requirement: "id to be a safe lowercase slug", observed: shown(record.id), action: "use lowercase letters, digits, and single hyphens" });
    }

    for (const key of REQUIRED_KEYS) {
      if (!(key in record)) diagnostics.push({ contractId: id, requirement: `required key ${key}`, observed: "missing", action: `add ${key} to ${filename}` });
    }
    for (const key of ["id", "title", "summary", "purpose", "lifecycle", "compatibilityNotes"]) {
      if (!nonEmptyString(record[key])) diagnostics.push({ contractId: id, requirement: `${key} to be a non-empty string`, observed: shown(record[key]), action: `provide a non-empty ${key}` });
    }
    if (!semver(record.version)) {
      diagnostics.push({ contractId: id, requirement: "version to be a valid semantic version", observed: shown(record.version), action: "use a released semantic version" });
    } else if (!release.isExplicitRelease && (record.version !== release.version || record.version !== manifest.version)) {
      diagnostics.push({ contractId: id, requirement: `version to equal ${release.version}`, observed: shown(record.version), action: `document only ${release.version} release contracts` });
    }
    if (record.stability !== "stable") diagnostics.push({ contractId: id, requirement: "stability to equal stable", observed: shown(record.stability), action: "mark only stable contracts in this registry" });
    if (record.sourceOfTruth !== SOURCE_OF_TRUTH) diagnostics.push({ contractId: id, requirement: `sourceOfTruth to equal ${SOURCE_OF_TRUTH}`, observed: shown(record.sourceOfTruth), action: "describe this follower package as an upstream-compatible mirror" });
    if (!CAPABILITY_STATES.includes(/** @type {never} */ (record.capability))) diagnostics.push({ contractId: id, requirement: `capability to be one of ${CAPABILITY_STATES.join(", ")}`, observed: shown(record.capability), action: "use a supported capability state" });

    if (!Array.isArray(record.symbols) || record.symbols.length === 0) {
      diagnostics.push({ contractId: id, requirement: "symbols to be a non-empty array", observed: shown(record.symbols), action: "reference at least one public release symbol" });
    } else for (const symbol of record.symbols) {
      const subpath = symbol && typeof symbol === "object" ? symbol.subpath : undefined;
      const name = symbol && typeof symbol === "object" ? symbol.name : undefined;
      if (!nonEmptyString(subpath) || !nonEmptyString(name)) {
        diagnostics.push({ contractId: id, requirement: "each symbol to contain non-empty subpath and name", observed: shown(symbol), action: "provide a complete public symbol reference" });
      } else if (!manifest.symbols.some((item) => item.subpath === subpath && item.name === name)) {
        diagnostics.push({ contractId: id, requirement: `public symbol ${subpath}:${name} in ${manifest.package}@${manifest.version}`, observed: "absent", action: "use a symbol verified in the stable release artifact" });
      }
    }

    if (!Array.isArray(record.fieldConstraints) || record.fieldConstraints.length === 0 || record.fieldConstraints.some((item) => !item || !nonEmptyString(item.field) || !nonEmptyString(item.constraint))) diagnostics.push({ contractId: id, requirement: "fieldConstraints to contain structured non-empty entries", observed: shown(record.fieldConstraints), action: "describe each public field constraint" });
    for (const [section, keys] of [["behavior", ["errors", "retry", "cancellation", "streaming"]], ["dependencies", ["capabilities", "transports"]]]) {
      const value = record[section];
      if (!value || typeof value !== "object" || keys.some((key) => section === "dependencies" ? !Array.isArray(value[key]) || value[key].length === 0 || value[key].some((item) => !nonEmptyString(item)) : !nonEmptyString(value[key]))) diagnostics.push({ contractId: id, requirement: `${section} to be complete and structured`, observed: shown(value), action: `provide all ${section} fields` });
    }
    const examples = record.examples;
    if (!examples || typeof examples !== "object" || !examples.valid || !nonEmptyString(examples.valid.expected) || !("value" in examples.valid) || !examples.invalid || !nonEmptyString(examples.invalid.expectedFailure) || !("value" in examples.invalid)) diagnostics.push({ contractId: id, requirement: "valid and invalid examples with expected outcomes", observed: shown(examples), action: "provide structured valid and invalid examples" });

    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      diagnostics.push({ contractId: id, requirement: "evidence to be a non-empty array", observed: shown(record.evidence), action: "reference at least one repository evidence file" });
    } else for (const evidence of record.evidence) {
      const evidenceType = evidence && typeof evidence === "object" ? evidence.type : undefined;
      const evidenceValue = evidence && typeof evidence === "object" ? evidence.path : undefined;
      if (!["declaration", "fixture", "conformance-test"].includes(evidenceType)) diagnostics.push({ contractId: id, requirement: "evidence type to be declaration, fixture, or conformance-test", observed: shown(evidenceType), action: "type every evidence record" });
      const evidencePath = typeof evidenceValue === "string" ? repositoryPath(root, evidenceValue) : undefined;
      if (!evidencePath) {
        diagnostics.push({ contractId: id, requirement: "evidence path to be repository-relative", observed: shown(evidenceValue), action: "use a path contained by the repository root" });
        continue;
      }
      try {
        const resolvedEvidencePath = await realpath(evidencePath);
        const relativeEvidencePath = path.relative(resolvedRoot, resolvedEvidencePath);
        if (relativeEvidencePath.startsWith("..") || path.isAbsolute(relativeEvidencePath)) {
          diagnostics.push({ contractId: id, requirement: "evidence path to be contained by the repository root", observed: evidenceValue, action: "use a file whose resolved target is inside the repository" });
          continue;
        }
        if (!(await lstat(resolvedEvidencePath)).isFile()) throw new Error("not a file");
      } catch {
        diagnostics.push({ contractId: id, requirement: `evidence file ${evidenceValue} to exist`, observed: "missing", action: "add the evidence file or correct its path" });
      }
    }
    if (Array.isArray(record.evidence) && Array.isArray(record.symbols)) {
      for (const fixture of record.evidence.filter((item) => item?.type === "fixture")) {
        const fixturePath = typeof fixture.path === "string" ? repositoryPath(root, fixture.path) : undefined;
        if (!fixturePath) continue;
        try {
          const fixtureContent = await readFile(fixturePath, "utf8");
          for (const symbol of record.symbols) {
            if (nonEmptyString(symbol?.name) && !new RegExp(`\\b${symbol.name}\\b`, "u").test(fixtureContent)) {
              diagnostics.push({ contractId: id, requirement: `fixture evidence ${fixture.path} to reference declared symbol ${symbol.name}`, observed: "symbol absent", action: `import or use ${symbol.name} in the focused fixture` });
            }
          }
        } catch {
          // Missing and invalid fixture paths are diagnosed by the evidence checks above.
        }
      }
    }
    if (Array.isArray(record.evidence)) {
      const evidenceTypes = new Set(record.evidence.map((item) => item?.type));
      for (const requiredType of REQUIRED_EVIDENCE_TYPES) {
        if (!evidenceTypes.has(requiredType)) diagnostics.push({ contractId: id, requirement: `evidence to include ${requiredType}`, observed: "missing", action: `add repository-backed ${requiredType} evidence` });
      }
    }
    if (release.isExplicitRelease) record.version = manifest.version;
    if (Array.isArray(record.symbols)) record.symbols = record.symbols.map((symbol) => ({ ...symbol, signature: manifest.symbols.find((item) => item.subpath === symbol.subpath && item.name === symbol.name)?.signature ?? "" }));
    records.push(/** @type {ContractRecord} */ (record));
  }

  const ids = new Set();
  for (const record of records) {
    if (ids.has(record.id)) diagnostics.push({ contractId: record.id, requirement: "contract id to be unique", observed: "duplicate", action: "assign a unique contract id" });
    ids.add(record.id);
  }
  if (diagnostics.length) throw new Error(diagnostics.map(formatDiagnostic).join("\n"));
  return records.sort((left, right) => left.id.localeCompare(right.id));
}
