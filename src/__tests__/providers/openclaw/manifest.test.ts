// Drift guards for the OpenClaw provider manifest. These tests fail the build
// when the manifest, its derived constants, the dispatcher classes, or the
// vendored gateway doc fall out of sync. The manifest is the single source of
// truth; everything else here is a check that the rest of the package agrees.

import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import {
  OPENCLAW_CORE_RPC_METHODS,
  OPENCLAW_DEFAULT_CAPABILITIES,
  OPENCLAW_RPC_METHODS,
} from "../../../providers/openclaw/manifest.derive";
import { OPENCLAW_MANIFEST } from "../../../providers/openclaw/manifest";
import { OPENCLAW_VENDORED_RPC_METHODS } from "./openclaw-rpc-methods.fixture";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..", "..");
const CLIENT_FILE = path.join(
  REPO_ROOT,
  "src",
  "providers",
  "openclaw",
  "client.ts",
);
const MEDIA_FILE = path.join(
  REPO_ROOT,
  "src",
  "providers",
  "openclaw",
  "media.ts",
);

describe("OpenClaw manifest conformance", () => {
  it("derives OPENCLAW_RPC_METHODS one-to-one from manifest entries", () => {
    const manifestPairs = Object.entries(OPENCLAW_MANIFEST.rpc).map(
      ([camelKey, entry]) => [camelKey, entry.method] as const,
    );
    const derivedPairs = Object.entries(OPENCLAW_RPC_METHODS) as readonly [
      string,
      string,
    ][];
    expect(derivedPairs.sort()).toEqual(manifestPairs.sort());
  });

  it("derives OPENCLAW_CORE_RPC_METHODS as the advertised-only manifest subset", () => {
    const advertised = Object.values(OPENCLAW_MANIFEST.rpc)
      .filter((entry) => entry.advertised)
      .map((entry) => entry.method)
      .sort();
    expect([...OPENCLAW_CORE_RPC_METHODS].sort()).toEqual(advertised);
  });

  it("seeds OPENCLAW_DEFAULT_CAPABILITIES.rpcMethods from the advertised subset", () => {
    const baseline = (OPENCLAW_DEFAULT_CAPABILITIES.rpcMethods ?? []).slice().sort();
    expect(baseline).toEqual([...OPENCLAW_CORE_RPC_METHODS].sort());
  });

  it("uses unique camel keys with unique wire method names", () => {
    const camelKeys = Object.keys(OPENCLAW_MANIFEST.rpc);
    expect(new Set(camelKeys).size).toBe(camelKeys.length);
    const wireNames = Object.values(OPENCLAW_MANIFEST.rpc).map((entry) => entry.method);
    expect(new Set(wireNames).size).toBe(wireNames.length);
  });

  it("never references operator.* methods (cavi-control plugin territory)", () => {
    const offenders = Object.values(OPENCLAW_MANIFEST.rpc)
      .map((entry) => entry.method)
      .filter((m) => m.startsWith("operator."));
    expect(offenders).toEqual([]);
  });

  it("never re-introduces the fictional `/v1/media/*` or `/v1/wiki/*` aliases for OpenClaw", () => {
    const restPaths = Object.values(OPENCLAW_MANIFEST.rest).map((entry) => entry.path);
    const offenders = restPaths.filter(
      (p) => p.startsWith("/v1/media") || p.startsWith("/v1/wiki"),
    );
    expect(offenders).toEqual([]);
  });

  it("mirrors every manifest RPC method in the vendored gateway method list", () => {
    // The vendored list is a name-only golden snapshot of the gateway's RPC
    // surface (see openclaw-rpc-methods.fixture.ts). A manifest method missing
    // from it means the manifest drifted ahead of the gateway — re-vendor.
    const vendored = new Set(OPENCLAW_VENDORED_RPC_METHODS);
    const missing = Object.values(OPENCLAW_MANIFEST.rpc)
      .map((entry) => entry.method)
      .filter((wire) => !vendored.has(wire));
    expect(missing).toEqual([]);
  });

  it("every RPC method the OpenClaw client issues exists in the manifest", () => {
    const wireNames = new Set(
      Object.values(OPENCLAW_MANIFEST.rpc).map((entry) => entry.method),
    );
    const clientSrc = fs.readFileSync(CLIENT_FILE, "utf8");
    const mediaSrc = fs.readFileSync(MEDIA_FILE, "utf8");
    const refRe = /OPENCLAW_RPC_METHODS\.([a-zA-Z0-9_]+)/g;
    const referencedKeys = new Set<string>();
    for (const match of clientSrc.matchAll(refRe)) referencedKeys.add(match[1]);
    for (const match of mediaSrc.matchAll(refRe)) referencedKeys.add(match[1]);
    expect(referencedKeys.size).toBeGreaterThan(0);
    const unknownKeys = [...referencedKeys].filter(
      (key) => !(key in OPENCLAW_MANIFEST.rpc),
    );
    expect(unknownKeys).toEqual([]);
    // And each referenced key resolves to a wire name the manifest declares.
    for (const key of referencedKeys) {
      const wire = (OPENCLAW_RPC_METHODS as Record<string, string>)[key];
      expect(wireNames.has(wire)).toBe(true);
    }
  });
});
