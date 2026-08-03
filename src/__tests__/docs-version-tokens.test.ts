import { describe, expect, it } from "vitest";

import {
  DOCUMENTED_VERSION_TOKEN,
  resolveDocumentedVersionToken,
} from "../../scripts/docs/version-tokens.mjs";

describe("documentation version tokens", () => {
  it("resolves the canonical documented version", () => {
    expect(resolveDocumentedVersionToken(
      `documentedVersion: ${DOCUMENTED_VERSION_TOKEN}\nInstall @cavi-ai/api-client@${DOCUMENTED_VERSION_TOKEN}.\n`,
      "9.8.7",
      "curated page introduction/version.md",
    )).toBe("documentedVersion: 9.8.7\nInstall @cavi-ai/api-client@9.8.7.\n");
  });

  it("rejects hard-coded semantic versions", () => {
    expect(() => resolveDocumentedVersionToken(
      "Install @cavi-ai/api-client@0.12.0.\n",
      "9.8.7",
      "curated page introduction/version.md",
    )).toThrow(
      "curated page introduction/version.md contains hard-coded semantic version 0.12.0; use {{documentedVersion}}",
    );
  });

  it("rejects misspelled documented-version tokens without consuming example variables", () => {
    expect(() => resolveDocumentedVersionToken(
      "{{gatewayUrl}}/{{documentedVerson}}",
      "9.8.7",
      "curated page introduction/version.md",
    )).toThrow(
      "curated page introduction/version.md contains unknown token {{documentedVerson}}",
    );
  });
});
