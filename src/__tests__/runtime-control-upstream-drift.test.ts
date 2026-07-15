import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { compareInventories, materializeInventory, renderDriftReport } from "../../scripts/runtime-control/report-upstream-drift.mjs";

describe("runtime-control upstream drift reporting", () => {
  it("groups wire, transport, and fixture-content schema drift deterministically", () => {
    const directory = mkdtempSync(join(tmpdir(), "runtime-control-drift-"));
    const beforeFixture = join(directory, "before.json");
    const afterFixture = join(directory, "after.json");
    writeFileSync(beforeFixture, '{"sessions":[]}\n');
    writeFileSync(afterFixture, '{"sessions":[{"id":"changed"}]}\n');
    const pinned = [
      { provider: "hermes", canonicalCapability: "controlPlane.models.list", wireOperation: "GET /api/models", transport: "http", fixture: null },
      { provider: "openclaw", canonicalCapability: "controlPlane.sessions.list", wireOperation: "sessions.list", transport: "websocket", fixture: beforeFixture },
    ];
    const captured = [
      { provider: "codex", canonicalCapability: "controlPlane.events.subscribe", wireOperation: "thread/event", transport: "stdio", fixture: null },
      { provider: "openclaw", canonicalCapability: "controlPlane.sessions.list", wireOperation: "sessions.list.v2", transport: "json-rpc", fixture: afterFixture },
    ];

    const report = compareInventories(materializeInventory(pinned), materializeInventory(captured));
    const changed = report.changed[0];
    expect(changed?.key).toBe("openclaw:controlPlane.sessions.list");
    expect(changed?.fields).toMatchObject({
      wireOperation: { from: "sessions.list", to: "sessions.list.v2" },
      transport: { from: "websocket", to: "json-rpc" },
    });
    expect(changed?.fields.schemaFingerprint.from).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(changed?.fields.schemaFingerprint.to).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(changed?.fields.schemaFingerprint.from).not.toBe(changed?.fields.schemaFingerprint.to);
    expect(report).toEqual({
      added: [materializeInventory([captured[0]])[0]],
      removed: [materializeInventory([pinned[0]])[0]],
      changed: [changed],
    });
    expect(renderDriftReport(report)).toContain("wireOperation sessions.list -> sessions.list.v2; schemaFingerprint sha256:");
  });

  it("sorts unsorted inputs and reports no drift deterministically", () => {
    const rows = [
      { provider: "openclaw", canonicalCapability: "controlPlane.sessions.list", wireOperation: "sessions.list", transport: "websocket", fixture: null },
      { provider: "codex", canonicalCapability: "controlPlane.events.subscribe", wireOperation: "unavailable", transport: "stdio", fixture: null },
    ];
    expect(compareInventories(rows, [...rows].reverse())).toEqual({ added: [], removed: [], changed: [] });
    expect(renderDriftReport({ added: [...rows].reverse(), removed: [], changed: [] }))
      .toMatch(/codex:controlPlane.events.subscribe[\s\S]*openclaw:controlPlane.sessions.list/u);
  });

  it("detects schema content drift when the fixture pathname is unchanged", () => {
    const row = { provider: "openclaw", canonicalCapability: "controlPlane.sessions.list", wireOperation: "sessions.list", transport: "websocket", fixture: "same.json" };
    const pinned = materializeInventory([row], () => Buffer.from('{"sessions":[]}'));
    const captured = materializeInventory([row], () => Buffer.from('{"sessions":[{"id":"new"}]}'));
    expect(compareInventories(pinned, captured).changed[0]?.fields).toEqual({
      schemaFingerprint: {
        from: pinned[0]?.schemaFingerprint,
        to: captured[0]?.schemaFingerprint,
      },
    });
  });

  it("uses CLI exit 0 for no drift, 1 for drift, and 2 for missing input", () => {
    const directory = mkdtempSync(join(tmpdir(), "runtime-control-cli-"));
    const ledger = JSON.parse(readFileSync("docs/compatibility/runtime-control-ledger.json", "utf8"));
    const noDrift = join(directory, "no-drift.json");
    const drift = join(directory, "drift.json");
    writeFileSync(noDrift, JSON.stringify(ledger));
    writeFileSync(drift, JSON.stringify(ledger.map((row: Record<string, unknown>, index: number) => index === 0 ? { ...row, wireOperation: "changed.operation" } : row)));
    const command = "scripts/runtime-control/report-upstream-drift.mjs";
    expect(spawnSync(process.execPath, [command, noDrift]).status).toBe(0);
    expect(spawnSync(process.execPath, [command, drift]).status).toBe(1);
    expect(spawnSync(process.execPath, [command]).status).toBe(2);
  });
});
