import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateLedgerRows } from "../../scripts/runtime-control/check-ledger.mjs";

type Entry = Readonly<{
  domain: "auth" | "sessions" | "models" | "usage" | "cost" | "tasks" | "workspace" | "events";
  operation: string;
  canonicalCapability: string;
  provider: "openclaw" | "hermes" | "codex";
  status: "core" | "extension" | "unavailable" | "deferred";
  transport: "http" | "sse" | "websocket" | "json-rpc" | "stdio" | "unix-socket";
  upstreamRevision: string;
  wireOperation: string;
  fixture: string | null;
  liveProof: "required" | "package-only" | "not-applicable";
}>;

describe("runtime-control compatibility ledger", () => {
  it("pins every row to an upstream revision and explicit ownership", () => {
    const entries = JSON.parse(readFileSync(
      "docs/compatibility/runtime-control-ledger.json",
      "utf8",
    )) as Entry[];
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.upstreamRevision).toMatch(/^[0-9a-f]{40}$/u);
      expect(entry.canonicalCapability.length).toBeGreaterThan(0);
      expect(entry.wireOperation.length).toBeGreaterThan(0);
      if (entry.status === "core" || entry.status === "extension") {
        expect(entry.fixture).not.toBeNull();
      }
    }
  });

  it("rejects missing, extra, invalid, and inconsistent properties", () => {
    const valid = {
      domain: "sessions",
      operation: "listSessions",
      canonicalCapability: "controlPlane.sessions.list",
      provider: "openclaw",
      status: "core",
      transport: "websocket",
      upstreamRevision: "4583102e29175a35815ea8031d6a0f254f7b4514",
      wireOperation: "sessions.list",
      fixture: "src/__tests__/fixtures/openclaw/control-plane/sessions-list.json",
      liveProof: "required",
    };
    expect(() => validateLedgerRows([{ ...valid, extra: true }])).toThrow(/unexpected key: extra/u);
    const { operation: _operation, ...missing } = valid;
    expect(() => validateLedgerRows([missing])).toThrow(/missing key: operation/u);
    expect(() => validateLedgerRows([{ ...valid, domain: "chat" }])).toThrow(/invalid domain/u);
    expect(() => validateLedgerRows([{ ...valid, operation: "" }])).toThrow(/invalid operation/u);
    expect(() => validateLedgerRows([{ ...valid, fixture: null }])).toThrow(/requires a fixture/u);
    expect(() => validateLedgerRows([{ ...valid, status: "unavailable", fixture: valid.fixture }])).toThrow(/must not pin a fixture/u);
    expect(() => validateLedgerRows([{ ...valid, status: "deferred", fixture: null, liveProof: "required" }])).toThrow(/must use not-applicable live proof/u);
  });
});
