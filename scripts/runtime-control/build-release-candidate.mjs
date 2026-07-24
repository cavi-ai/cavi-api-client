import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateProductionSbom } from "./generate-production-sbom.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactDirectory = path.join(packageRoot, ".artifacts/runtime-control");
const evidencePath = path.join(packageRoot, "docs/release-evidence/runtime-control-release-candidate.json");
const expectedScannerVersion = "2.4.0";

const blockedPathPatterns = [
  /(^|\/)\.superpowers(?:\/|$)/u,
  /(^|\/)docs\/superpowers(?:\/|$)/u,
  /(^|\/)\.agents(?:\/|$)/u,
  /(^|\/)\.codex(?:\/|$)/u,
  /(^|\/)(?:__tests__|tests?)(?:\/|$)/u,
  /(?:^|\/)test-support(?:\/|$)/u,
  /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/u,
  /(?:^|\/)(?:credentials?|secrets?)(?:\.(?:json|ya?ml|toml|ini|txt|pem|key))?$/iu,
  /(?:^|\/)(?:auth|token)(?:\.(?:json|ya?ml|toml|ini|txt))$/iu,
  /(?:^|\/)(?:service[-_.]?account|client[-_.]?secret|auth[-_.]?config)(?:\.[^/]*)?$/iu,
  /(?:^|\/)id_(?:rsa|dsa|ecdsa|ed25519)(?:\.[^/]*)?$/iu,
  /(?:^|\/)[^/]+\.(?:key|pem|p12|pfx)$/iu,
  /(?:^|\/)\.(?:env|npmrc|pypirc|netrc)(?:\.[^/]*)?$/iu,
  /(?:^|\/)\.(?!well-known(?:\/|$))[^/]+/u,
];

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgh[oprsu]_[A-Za-z0-9]{20,}\b/u,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
  /\bBearer[ \t]+[A-Za-z0-9._~-]{16,}\b/iu,
];

const safeCredentialValues = new Set(["placeholder", "redacted", "example-value", "your-token-here"]);
const allowedBinaryExtensions = new Set([".gif", ".ico", ".jpeg", ".jpg", ".png", ".webp", ".woff", ".woff2"]);
const allowedTextExtensions = new Set([".cjs", ".css", ".d.ts", ".html", ".js", ".json", ".jsx", ".mjs", ".md", ".map", ".svg", ".ts", ".tsx", ".txt"]);
const credentialAssignment = /["']?\b(?:api[_-]?key|password|client[_-]?secret|private[_-]?key)["']?[ \t]*[:=][ \t]*(["']?)([A-Za-z0-9._~+\/-]{12,})\1/iu;

function run(command, args, options = {}) {
  return execFileSync(command, args, { cwd: packageRoot, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...options });
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  }
  return value;
}

function upstreamPins() {
  const rows = JSON.parse(readFileSync(path.join(packageRoot, "docs/compatibility/runtime-control-ledger.json"), "utf8"));
  const pins = {};
  for (const provider of ["openclaw", "hermes", "codex"]) {
    const revisions = [...new Set(rows.filter((row) => row.provider === provider).map((row) => row.upstreamRevision))];
    if (revisions.length !== 1 || !/^[0-9a-f]{40}$/u.test(revisions[0])) {
      throw new Error(`runtime-control ledger must contain exactly one valid ${provider} upstream revision`);
    }
    pins[provider] = revisions[0];
  }
  return pins;
}

function recordedAuditEvidence() {
  const manifest = JSON.parse(readFileSync(evidencePath, "utf8"));
  const audit = manifest.audit;
  if (audit === null || typeof audit !== "object"
    || audit.command !== "pnpm audit --prod --registry=https://registry.npmjs.org/"
    || !["passed", "unavailable", "failed"].includes(audit.status)
    || !Number.isInteger(audit.exitCode)
    || typeof audit.category !== "string"
    || typeof audit.summary !== "string") {
    throw new Error("existing release evidence must contain a sanitized production audit result");
  }
  return audit;
}

function offlineDatabaseEvidence() {
  const candidates = [
    path.join(homedir(), "Library/Caches/osv-scanner/npm/all.zip"),
    path.join(process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"), "osv-scanner/npm/all.zip"),
  ];
  for (const candidate of candidates) {
    try {
      const stats = statSync(candidate);
      return { acquisitionDate: stats.mtime.toISOString(), acquisitionStatus: "available" };
    } catch {
      // Continue through platform cache conventions without exposing their paths.
    }
  }
  return { acquisitionStatus: "unavailable" };
}

export function parseScannerVersion(output) {
  const match = output.match(/^osv-scanner version: (\d+\.\d+\.\d+)$/mu);
  if (!match) throw new Error("unable to parse osv-scanner version output");
  if (match[1] !== expectedScannerVersion) throw new Error(`expected ${expectedScannerVersion}, observed ${match[1]}`);
  return match[1];
}

export function requireCleanReplacementAudit(result) {
  if (result?.status !== "passed" || result?.exitCode !== 0 || result?.vulnerabilities !== 0) {
    throw new Error("release candidate requires a clean offline OSV audit");
  }
  return result;
}

function runOfflineAudit(sbomPath, componentCount) {
  const observedVersionOutput = execFileSync("osv-scanner", ["--version"], { cwd: packageRoot, encoding: "utf8" }).trim();
  const observedVersion = parseScannerVersion(observedVersionOutput);
  const command = `osv-scanner scan source --offline --offline-vulnerabilities --sbom ${path.relative(packageRoot, sbomPath)} --format table --verbosity error .`;
  const result = spawnSync("osv-scanner", [
    "scan", "source", "--offline", "--offline-vulnerabilities", "--sbom", sbomPath,
    "--format", "table", "--verbosity", "error", ".",
  ], { cwd: packageRoot, encoding: "utf8" });
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const noIssues = result.status === 0 && /No issues found/u.test(output);
  const countMatch = output.match(/by (\d+) known vulnerabilities/u);
  const vulnerabilities = noIssues ? 0 : countMatch ? Number(countMatch[1]) : null;
  return {
    command,
    componentCount,
    database: offlineDatabaseEvidence(),
    exitCode: result.status ?? 1,
    mode: "offline-sbom",
    observedVersion,
    observedVersionOutput,
    scanner: `osv-scanner ${expectedScannerVersion}`,
    status: noIssues ? "passed" : vulnerabilities !== null ? "vulnerabilities-found" : "failed",
    vulnerabilities,
    summary: noIssues ? "No issues found." : "Offline OSV scan did not produce a clean result.",
  };
}

export function isBlockedArchivePath(entry) {
  const relative = entry.replace(/^package\/?/u, "");
  if (!relative || entry !== `package/${relative}` || relative.includes("../") || path.posix.isAbsolute(relative)) return true;
  return blockedPathPatterns.some((pattern) => pattern.test(relative));
}

export function contentRisk(entry, contents) {
  const text = contents.toString("utf8");
  for (const pattern of secretPatterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    return "secret-pattern";
  }
  const assignment = credentialAssignment.exec(text);
  if (assignment) {
    const value = assignment[2].toLowerCase();
    const quoted = assignment[1].length > 0;
    const codeOrDocs = /\.(?:[cm]?[jt]sx?|md)$/iu.test(entry);
    if (!safeCredentialValues.has(value) && (quoted || !codeOrDocs)) return "secret-pattern";
  }
  const extension = entry.toLowerCase().endsWith(".d.ts") ? ".d.ts" : path.extname(entry).toLowerCase();
  if (contents.includes(0) && !allowedBinaryExtensions.has(extension) && !allowedTextExtensions.has(extension)) return "unrecognized-binary";
  return null;
}

export function parsePackOutput(packOutput) {
  for (let index = packOutput.length - 1; index >= 0; index -= 1) {
    if (packOutput[index] !== "{" && packOutput[index] !== "[") continue;
    try {
      const packResult = JSON.parse(packOutput.slice(index).trim());
      const packedName = Array.isArray(packResult) ? packResult[0]?.filename : packResult.filename;
      if (typeof packedName === "string") return path.resolve(packageRoot, packedName);
    } catch {
      // Continue backwards until the outermost valid JSON payload is found.
    }
  }
  throw new Error("pnpm pack did not emit JSON metadata");
}

export function buildPackageTarball(destination, { ignoreScripts = false } = {}) {
  mkdirSync(destination, { recursive: true });
  // `pnpm pack` runs `prepack` (a full `tsc` build) by default. Callers that
  // have already built `dist/` can skip it with `ignoreScripts` to pack the
  // existing output directly — the reproducibility check does this so it packs
  // the SAME dist twice instead of paying for two sequential builds.
  const args = ["pack", "--json", "--pack-destination", destination];
  if (ignoreScripts) args.push("--config.ignore-scripts=true");
  return parsePackOutput(run("pnpm", args));
}

export function scanArchive(tarball) {
  const entries = run("tar", ["-tzf", tarball]).split("\n").filter(Boolean).sort();
  const privateFiles = [];
  for (const entry of entries) {
    if (isBlockedArchivePath(entry)) privateFiles.push(entry.replace(/^package\//u, ""));
  }

  for (const entry of entries) {
    if (entry.endsWith("/") || privateFiles.includes(entry) || privateFiles.includes(entry.replace(/^package\//u, ""))) continue;
    let contents;
    try {
      contents = execFileSync("tar", ["-xOzf", tarball, entry], { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 });
    } catch {
      privateFiles.push(`${entry.replace(/^package\//u, "")}:unreadable`);
      continue;
    }
    const risk = contentRisk(entry, contents);
    if (risk) privateFiles.push(`${entry.replace(/^package\//u, "")}:${risk}`);
  }
  return { entries, privateFiles: [...new Set(privateFiles)].sort() };
}

export function buildReleaseCandidate() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (!sourceDateEpoch || !/^\d+$/u.test(sourceDateEpoch)) throw new Error("SOURCE_DATE_EPOCH is required and must be integer seconds");
  const audit = recordedAuditEvidence();

  run("pnpm", ["run", "verify"], { stdio: "inherit" });
  run("pnpm", ["run", "coverage"], { stdio: "inherit" });
  rmSync(artifactDirectory, { recursive: true, force: true });

  // The candidate is named after whatever version is being built. This used to
  // hardcode 0.11.0 (both the filename and a guard that threw on anything else),
  // so the 0.12.0 release broke this script the moment package.json moved.
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(pkg.version)) {
    throw new Error(`package version must be a semantic version, observed ${String(pkg.version)}`);
  }

  const packedPath = buildPackageTarball(artifactDirectory);
  const canonicalName = `cavi-ai-api-client-${pkg.version}-runtime-control.tgz`;
  const tarballPath = path.join(artifactDirectory, canonicalName);
  if (packedPath !== tarballPath) renameSync(packedPath, tarballPath);

  const { entries, privateFiles } = scanArchive(tarballPath);
  if (privateFiles.length > 0) throw new Error(`private or unsafe package files detected:\n${privateFiles.join("\n")}`);
  const sha256 = createHash("sha256").update(readFileSync(tarballPath)).digest("hex");
  const sbom = generateProductionSbom(path.join(artifactDirectory, "production.cdx.json"));
  const sbomSha256 = createHash("sha256").update(readFileSync(sbom.path)).digest("hex");
  const replacement = { ...runOfflineAudit(sbom.path, sbom.componentCount), sbomSha256 };
  requireCleanReplacementAudit(replacement);
  const manifest = sorted({
    audit: { ...audit, replacement },
    coverage: { command: "pnpm run coverage", status: "passed" },
    packageVersion: pkg.version,
    privateFiles,
    scan: { archiveEntries: entries.length, status: "passed" },
    schemaVersion: 1,
    sourceDateEpoch: Number(sourceDateEpoch),
    tarball: { path: path.relative(packageRoot, tarballPath), sha256 },
    testSummary: { command: "pnpm run verify", status: "passed" },
    upstream: upstreamPins(),
  });
  mkdirSync(path.dirname(evidencePath), { recursive: true });
  writeFileSync(evidencePath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildReleaseCandidate();
