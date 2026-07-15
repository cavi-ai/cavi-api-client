import { existsSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const ledgerPath = "docs/compatibility/runtime-control-ledger.json";
const markdownPath = "docs/compatibility/runtime-control-ledger.md";
const requiredKeys = ["domain", "operation", "canonicalCapability", "provider", "status", "transport", "upstreamRevision", "wireOperation", "fixture", "liveProof"];
const allowed = {
  domain: new Set(["auth", "sessions", "models", "usage", "cost", "tasks", "workspace", "events"]),
  provider: new Set(["openclaw", "hermes", "codex"]),
  status: new Set(["core", "extension", "unavailable", "deferred"]),
  transport: new Set(["http", "sse", "websocket", "json-rpc", "stdio", "unix-socket"]),
  liveProof: new Set(["required", "package-only", "not-applicable"]),
};

const nonempty = (value) => typeof value === "string" && value.length > 0;

export function validateLedgerRows(rows, fixtureExists = existsSync) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("ledger must be a non-empty array");
  const keys = new Set();
  for (const [index, row] of rows.entries()) {
    if (row === null || typeof row !== "object" || Array.isArray(row)) throw new Error(`invalid ledger row: ${index}`);
    for (const key of requiredKeys) if (!Object.hasOwn(row, key)) throw new Error(`missing key: ${key}`);
    for (const key of Object.keys(row)) if (!requiredKeys.includes(key)) throw new Error(`unexpected key: ${key}`);
    for (const key of ["domain", "provider", "status", "transport", "liveProof"]) {
      if (!allowed[key].has(row[key])) throw new Error(`invalid ${key}: ${String(row[key])}`);
    }
    for (const key of ["operation", "canonicalCapability", "wireOperation"]) {
      if (!nonempty(row[key])) throw new Error(`invalid ${key}`);
    }
    if (!/^[0-9a-f]{40}$/u.test(row.upstreamRevision)) throw new Error(`invalid upstream revision: ${index}`);
    if (row.fixture !== null && !nonempty(row.fixture)) throw new Error(`invalid fixture: ${index}`);
    const implemented = row.status === "core" || row.status === "extension";
    if (implemented && row.fixture === null) throw new Error(`${row.status} row requires a fixture`);
    if (implemented && row.liveProof === "not-applicable") throw new Error(`${row.status} row requires applicable live proof`);
    if (!implemented && row.fixture !== null) throw new Error(`${row.status} row must not pin a fixture`);
    if (!implemented && row.liveProof !== "not-applicable") throw new Error(`${row.status} row must use not-applicable live proof`);
    if (row.fixture !== null && !fixtureExists(row.fixture)) throw new Error(`missing fixture: ${row.fixture}`);
    const key = `${row.provider}:${row.canonicalCapability}`;
    if (keys.has(key)) throw new Error(`duplicate ledger row: ${key}`);
    keys.add(key);
  }
  return rows;
}

export function renderLedgerMarkdown(rows) {
  const domains = [...allowed.domain];
  const sorted = [...rows].sort((left, right) => domains.indexOf(left.domain) - domains.indexOf(right.domain)
    || left.operation.localeCompare(right.operation) || left.provider.localeCompare(right.provider));
  return [
    "# Runtime-control compatibility ledger", "",
    "> Generated from `runtime-control-ledger.json` by `pnpm run check:runtime-control-ledger`. Do not edit by hand.", "",
    "| Domain | Operation | Canonical capability | Provider | Status | Transport | Wire operation | Upstream revision | Fixture | Live proof |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...sorted.map((row) => `| ${row.domain} | ${row.operation} | \`${row.canonicalCapability}\` | ${row.provider} | ${row.status} | ${row.transport} | \`${row.wireOperation}\` | \`${row.upstreamRevision}\` | ${row.fixture === null ? "—" : `\`${row.fixture}\``} | ${row.liveProof} |`), "",
  ].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const rows = validateLedgerRows(JSON.parse(readFileSync(ledgerPath, "utf8")));
  const rendered = renderLedgerMarkdown(rows);
  if (!existsSync(markdownPath) || readFileSync(markdownPath, "utf8") !== rendered) {
    throw new Error(`runtime-control ledger Markdown drift: regenerate ${markdownPath}`);
  }
  console.log(`runtime-control ledger valid: ${rows.length} rows`);
}
