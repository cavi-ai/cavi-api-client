import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const comparedFields = ["wireOperation", "schemaFingerprint", "transport"];
const rowKey = (row) => `${row.provider}:${row.canonicalCapability}`;
const sortedRows = (rows) => [...rows].sort((left, right) => rowKey(left).localeCompare(rowKey(right)));
const fingerprint = (contents) => `sha256:${createHash("sha256").update(contents).digest("hex")}`;

export function materializeInventory(rows, readFixture = readFileSync) {
  return rows.map((row) => ({
    ...row,
    schemaFingerprint: row.fixture === null ? null : fingerprint(readFixture(row.fixture)),
  }));
}

export function compareInventories(pinnedRows, capturedRows) {
  const pinned = new Map(pinnedRows.map((row) => [rowKey(row), row]));
  const captured = new Map(capturedRows.map((row) => [rowKey(row), row]));
  const added = sortedRows(capturedRows.filter((row) => !pinned.has(rowKey(row))));
  const removed = sortedRows(pinnedRows.filter((row) => !captured.has(rowKey(row))));
  const changed = [];
  for (const [key, before] of [...pinned.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const after = captured.get(key);
    if (!after) continue;
    const fields = {};
    for (const field of comparedFields) {
      const from = before[field] ?? null;
      const to = after[field] ?? null;
      if (from !== to) fields[field] = { from, to };
    }
    if (Object.keys(fields).length > 0) changed.push({ key, fields });
  }
  return { added, removed, changed };
}

const evidence = (row) => `${rowKey(row)}: wire=${row.wireOperation}; schema=${row.schemaFingerprint ?? "unavailable"}; transport=${row.transport}`;

export function renderDriftReport(report) {
  const section = (title, lines) => [`## ${title}`, "", ...(lines.length ? [...lines].sort().map((line) => `- ${line}`) : ["- None"]), ""];
  return ["# Runtime-control upstream drift", "", ...section("Added", report.added.map(evidence)),
    ...section("Removed", report.removed.map(evidence)),
    ...section("Changed", report.changed.map((change) => {
      const details = Object.entries(change.fields).map(([field, values]) => `${field} ${values.from ?? "unavailable"} -> ${values.to ?? "unavailable"}`).join("; ");
      return `${change.key}: ${details}`;
    }))].join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inventoryPath = process.argv[2];
  if (!inventoryPath) {
    console.error("usage: report-upstream-drift.mjs <captured-inventory.json>");
    process.exitCode = 2;
  } else {
    const ledger = JSON.parse(readFileSync("docs/compatibility/runtime-control-ledger.json", "utf8"));
    // The ledger and its fixtures are one evidence revision. Reading the ledger
    // from the worktree but fixtures from HEAD makes every legitimate fixture
    // update look like drift and prevents the update from being committed.
    const pinned = materializeInventory(ledger);
    const captured = materializeInventory(JSON.parse(readFileSync(inventoryPath, "utf8")));
    const report = compareInventories(pinned, captured);
    process.stdout.write(renderDriftReport(report));
    if (report.added.length || report.removed.length || report.changed.length) process.exitCode = 1;
  }
}
