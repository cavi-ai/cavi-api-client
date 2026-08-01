import { describe, expect, it } from "vitest";

import {
  createReleaseEnvelope,
  runCreateReleaseEnvelopeCli,
} from "../../scripts/release/create-release-envelope.mjs";

const VERSION = "0.15.0";
const TAG = `v${VERSION}`;
const COMMIT = "a".repeat(40);
const SHA256 = "b".repeat(64);

describe("createReleaseEnvelope", () => {
  it("emits the exact cavi-home package-docs dispatch schema", () => {
    expect(createReleaseEnvelope({
      version: VERSION,
      tag: TAG,
      repository: "cavi-ai/cavi-api-client",
      commit: COMMIT,
      artifactSha256: SHA256,
    })).toEqual({
      schemaVersion: 1,
      slug: "api-client",
      kind: "package-docs",
      version: VERSION,
      tag: TAG,
      repository: "cavi-ai/cavi-api-client",
      commit: COMMIT,
      artifact: {
        url: "https://github.com/cavi-ai/cavi-api-client/releases/download/v0.15.0/cavi-api-client-docs-v0.15.0.tar.gz",
        sha256: SHA256,
        format: "tar.gz",
      },
    });
  });

  it.each([
    ["prerelease version", { version: "0.15.0-rc.1", tag: "v0.15.0-rc.1" }, /stable exact version/u],
    ["mismatched tag", { tag: "v0.15.1" }, /tag.*version/u],
    ["noncanonical repository", { repository: "example/api-client" }, /repository/u],
    ["short commit", { commit: "a".repeat(39) }, /commit/u],
    ["uppercase digest", { artifactSha256: "B".repeat(64) }, /SHA-256/u],
  ])("rejects a %s", (_label, override, expected) => {
    expect(() => createReleaseEnvelope({
      version: VERSION,
      tag: TAG,
      repository: "cavi-ai/cavi-api-client",
      commit: COMMIT,
      artifactSha256: SHA256,
      ...override,
    })).toThrow(expected);
  });

  it("prints the envelope as JSON for repository dispatch", async () => {
    let stdout = "";
    await runCreateReleaseEnvelopeCli([
      "--version", VERSION,
      "--tag", TAG,
      "--repository", "cavi-ai/cavi-api-client",
      "--commit", COMMIT,
      "--artifact-sha256", SHA256,
    ], { stdout: { write: (value: string) => { stdout += value; } } });

    expect(JSON.parse(stdout)).toEqual(createReleaseEnvelope({
      version: VERSION,
      tag: TAG,
      repository: "cavi-ai/cavi-api-client",
      commit: COMMIT,
      artifactSha256: SHA256,
    }));
    expect(stdout.endsWith("\n")).toBe(true);
  });
});
