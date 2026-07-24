import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildPackageTarball,
  contentRisk,
  isBlockedArchivePath,
  parsePackOutput,
  parseScannerVersion,
  requireCleanReplacementAudit,
} from "../../scripts/runtime-control/build-release-candidate.mjs";

const digest = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("runtime-control release candidate evidence", () => {
  it("parses pnpm pack JSON with or without preceding lifecycle output", () => {
    const payload = JSON.stringify({ filename: "/tmp/cavi-ai-api-client-0.11.0.tgz" });

    expect(parsePackOutput(payload)).toBe("/tmp/cavi-ai-api-client-0.11.0.tgz");
    expect(parsePackOutput(`lifecycle output\n${payload}`)).toBe("/tmp/cavi-ai-api-client-0.11.0.tgz");
  });

  it("records the deterministic package artifact and pinned upstreams", () => {
    const manifest = JSON.parse(readFileSync(
      "docs/release-evidence/runtime-control-release-candidate.json",
      "utf8",
    ));

    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.packageVersion).toBe("0.11.0");
    expect(manifest.tarball.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.upstream.openclaw).toMatch(/^[0-9a-f]{40}$/u);
    expect(manifest.upstream.hermes).toMatch(/^[0-9a-f]{40}$/u);
    expect(manifest.upstream.codex).toMatch(/^[0-9a-f]{40}$/u);
    expect(manifest.privateFiles).toEqual([]);
    expect(manifest.coverage).toMatchObject({
      command: "pnpm run coverage",
      status: "passed",
    });
    expect(manifest.audit).toMatchObject({
      command: "pnpm audit --prod --registry=https://registry.npmjs.org/",
      category: "service-unavailable",
      exitCode: 1,
      status: "unavailable",
    });
    expect(manifest.audit.summary).toMatch(/HTTP 410/u);
    expect(manifest.audit.replacement).toMatchObject({
      command: expect.stringContaining("osv-scanner scan source --offline --offline-vulnerabilities --sbom"),
      componentCount: expect.any(Number),
      database: expect.objectContaining({ acquisitionStatus: expect.any(String) }),
      exitCode: 0,
      mode: "offline-sbom",
      scanner: "osv-scanner 2.4.0",
      status: "passed",
      vulnerabilities: 0,
    });
    expect(manifest.audit.replacement.sbomSha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(manifest.audit.replacement.observedVersionOutput).toContain("osv-scanner version: 2.4.0");
  });

  it("rejects vulnerability-bearing or malformed replacement audits", () => {
    const clean = { exitCode: 0, status: "passed", vulnerabilities: 0 };
    expect(requireCleanReplacementAudit(clean)).toBe(clean);
    expect(() => requireCleanReplacementAudit({ ...clean, status: "vulnerabilities-found", vulnerabilities: 1 })).toThrow(/clean offline OSV audit/u);
    expect(() => requireCleanReplacementAudit({ ...clean, exitCode: 1 })).toThrow(/clean offline OSV audit/u);
    expect(() => requireCleanReplacementAudit({ ...clean, vulnerabilities: null })).toThrow(/clean offline OSV audit/u);
  });

  it("requires parseable pinned osv-scanner 2.4.0 provenance", () => {
    expect(parseScannerVersion("osv-scanner version: 2.4.0\nosv-scalibr version: 0.4.5")).toBe("2.4.0");
    expect(() => parseScannerVersion("osv-scanner version: 2.5.0")).toThrow(/expected 2\.4\.0/u);
    expect(() => parseScannerVersion("unknown scanner")).toThrow(/parse osv-scanner version/u);
  });

  it.each([
    "package/id_rsa",
    "package/id_ed25519.pub",
    "package/token.json",
    "package/service-account.json",
    "package/account.private.key",
    "package/client-certificate.pem",
    "package/signing.p12",
    "package/auth.pfx",
    "package/config/credentials.yaml",
    "package/config/auth.json",
  ])("rejects credential artifact path %s", (entry) => {
    expect(isBlockedArchivePath(entry)).toBe(true);
  });

  it.each([
    "package/src/core/http/credentials.ts",
    "package/docs/authentication.md",
    "package/dist/client.js",
  ])("allows public source lookalike %s", (entry) => {
    expect(isBlockedArchivePath(entry)).toBe(false);
  });

  it.each([
    Buffer.from("prefix\0-----BEGIN PRIVATE KEY-----synthetic-marker"),
    Buffer.from("eyJhbGciOiJIUzI1NiJ9.c3ludGhldGljLXBheWxvYWQ.c3ludGhldGljLXNpZ25hdHVyZQ"),
    Buffer.from("Authorization: Bearer synthetic_credential_value_123"),
    Buffer.from("api_key = synthetic_credential_value_123"),
    Buffer.from("apiKey: synthetic_credential_value_123"),
    Buffer.from("password=synthetic_credential_value_123"),
    Buffer.from("client_secret: synthetic_credential_value_123"),
    Buffer.from("private-key = synthetic_credential_value_123"),
  ])("rejects blocked content without a binary bypass", (contents) => {
    expect(contentRisk("package/data.bin", contents)).toBe("secret-pattern");
  });

  it.each([
    "password field is optional",
    "apiKey?: string",
    "Authorization: Bearer <token>",
    "client_secret = redacted",
    "eyJhbGciOiJIUzI1NiJ9.not-a-complete-token",
    "const request = { password: params.authToken };",
  ])("allows safe content lookalike %s", (contents) => {
    expect(contentRisk("package/docs/example.md", Buffer.from(contents))).toBeNull();
  });

  it("fails closed on unrecognized binary content", () => {
    expect(contentRisk("package/data.unknown", Buffer.from([0, 1, 2, 3]))).toBe("unrecognized-binary");
    expect(contentRisk("package/docs/logo.png", Buffer.from([0, 1, 2, 3]))).toBeNull();
  });

  it("packs identical bytes twice with the same source epoch and toolchain", () => {
    const packageRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
    // Build once, then pack the SAME dist twice with scripts disabled — this
    // isolates pack determinism (build reproducibility is pinned separately) and
    // avoids two sequential `tsc` builds that overran CI's per-test timeout.
    execFileSync("pnpm", ["run", "build"], { cwd: packageRoot, stdio: "ignore" });
    const first = mkdtempSync(path.join(tmpdir(), "runtime-control-pack-a-"));
    const second = mkdtempSync(path.join(tmpdir(), "runtime-control-pack-b-"));
    try {
      const firstTarball = buildPackageTarball(first, { ignoreScripts: true });
      const secondTarball = buildPackageTarball(second, { ignoreScripts: true });
      expect(digest(firstTarball)).toBe(digest(secondTarball));
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  }, 60_000);
});
