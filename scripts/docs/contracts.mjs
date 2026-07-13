import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { CAPABILITY_STATES, DOCUMENTED_VERSION } from "./types.mjs";

const CONTRACTS_DIRECTORY = "docs/api-client/source/contracts";
const REQUIRED_KEYS = ["id", "title", "version", "stability", "sourceOfTruth", "symbols", "capability", "evidence", "summary"];
const SOURCE_OF_TRUTH = "upstream-compatible-mirror";

/** @typedef {{subpath: string, name: string}} ContractSymbol */
/** @typedef {{id: string, title: string, version: string, stability: "stable", sourceOfTruth: "upstream-compatible-mirror", symbols: ContractSymbol[], capability: import("./types.mjs").CapabilityState, evidence: string[], summary: string}} ContractRecord */
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

/** @param {string} root @param {string} relativePath */
function repositoryPath(root, relativePath) {
  if (!nonEmptyString(relativePath) || path.isAbsolute(relativePath)) return undefined;
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  const relative = path.relative(resolvedRoot, resolved);
  return relative.startsWith("..") || path.isAbsolute(relative) ? undefined : resolved;
}

/** @param {string} root @param {import("./types.mjs").ReleaseManifest} manifest @returns {Promise<ContractRecord[]>} */
export async function loadContracts(root, manifest) {
  const directory = path.join(root, CONTRACTS_DIRECTORY);
  const filenames = (await readdir(directory)).filter((name) => name.endsWith(".json")).sort();
  /** @type {ContractDiagnostic[]} */
  const diagnostics = [];
  /** @type {ContractRecord[]} */
  const records = [];

  for (const filename of filenames) {
    const fallbackId = path.basename(filename, ".json");
    let candidate;
    try {
      candidate = JSON.parse(await readFile(path.join(directory, filename), "utf8"));
    } catch (error) {
      diagnostics.push({ contractId: fallbackId, requirement: "valid JSON", observed: error instanceof Error ? error.message : String(error), action: "correct the JSON record" });
      continue;
    }
    const record = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? /** @type {Record<string, unknown>} */ (candidate) : {};
    const id = nonEmptyString(record.id) ? /** @type {string} */ (record.id) : fallbackId;

    for (const key of REQUIRED_KEYS) {
      if (!(key in record)) diagnostics.push({ contractId: id, requirement: `required key ${key}`, observed: "missing", action: `add ${key} to ${filename}` });
    }
    for (const key of ["id", "title", "summary"]) {
      if (!nonEmptyString(record[key])) diagnostics.push({ contractId: id, requirement: `${key} to be a non-empty string`, observed: shown(record[key]), action: `provide a non-empty ${key}` });
    }
    if (record.version !== DOCUMENTED_VERSION || record.version !== manifest.version) diagnostics.push({ contractId: id, requirement: `version to equal ${DOCUMENTED_VERSION}`, observed: shown(record.version), action: `document only ${DOCUMENTED_VERSION} release contracts` });
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

    if (!Array.isArray(record.evidence) || record.evidence.length === 0) {
      diagnostics.push({ contractId: id, requirement: "evidence to be a non-empty array", observed: shown(record.evidence), action: "reference at least one repository evidence file" });
    } else for (const evidence of record.evidence) {
      const evidencePath = typeof evidence === "string" ? repositoryPath(root, evidence) : undefined;
      if (!evidencePath) {
        diagnostics.push({ contractId: id, requirement: "evidence path to be repository-relative", observed: shown(evidence), action: "use a path contained by the repository root" });
        continue;
      }
      try {
        if (!(await lstat(evidencePath)).isFile()) throw new Error("not a file");
      } catch {
        diagnostics.push({ contractId: id, requirement: `evidence file ${evidence} to exist`, observed: "missing", action: "add the evidence file or correct its path" });
      }
    }
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
