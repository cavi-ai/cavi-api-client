import { describe, expect, it } from "vitest";
import {
  assertSafeRelativePath,
  normalizeTeamManifest,
  findTeamManifestTeam,
  resolveTeamWorkspacePath,
} from "../../contracts/index.js";

// Traversal / smuggling vectors that BOTH the opt-in `assertSafeRelativePath`
// helper and the manifest workspace whitelist must reject. Keeping them in one
// list guards against the two implementations drifting apart (the helper is the
// public companion to the whitelist; see contracts/paths.ts).
const UNSAFE_RELATIVE_PATHS = [
  "",
  "   ",
  "/etc/passwd",
  "//evil.example/path",
  "file:///etc/passwd",
  "http://evil.example/x",
  "..",
  "../secret",
  "a/../b",
  "a/./b",
  "%2e%2e/secret",
  "a/%2e%2e/b",
  "media\\images",
] as const;

describe("assertSafeRelativePath", () => {
  it("accepts and normalizes safe relative paths", () => {
    expect(assertSafeRelativePath("research/complete")).toBe("research/complete");
    expect(assertSafeRelativePath("media/images")).toBe("media/images");
    expect(assertSafeRelativePath("folder/note.md")).toBe("folder/note.md");
    // Interior empty segments / duplicate slashes are collapsed.
    expect(assertSafeRelativePath("a//b")).toBe("a/b");
    expect(assertSafeRelativePath(" a/b ")).toBe("a/b");
  });

  it("rejects traversal and query/scheme smuggling", () => {
    for (const value of UNSAFE_RELATIVE_PATHS) {
      expect(
        () => assertSafeRelativePath(value),
        `expected assertSafeRelativePath(${JSON.stringify(value)}) to throw`,
      ).toThrow(/assertSafeRelativePath/u);
    }
  });

  it("does not URL-encode its result (encoding is appendHttpQuery's job)", () => {
    expect(assertSafeRelativePath("a/b c")).toBe("a/b c");
  });
});

describe("manifest workspace whitelist rejects the same vectors", () => {
  // A team whose whitelist nominally contains a `docs` entry. Even though `docs`
  // is allowed, an unsafe key/path must never resolve.
  const team = (() => {
    const manifest = normalizeTeamManifest({
      version: 1,
      teams: [
        {
          id: "research",
          workspace: { rootPath: "/teams/research/workspace", paths: ["docs"] },
        },
      ],
    });
    const found = findTeamManifestTeam(manifest, "research");
    if (!found) throw new Error("fixture team missing");
    return found;
  })();

  it("resolves a whitelisted path", () => {
    expect(resolveTeamWorkspacePath(team, "docs")).toBe(
      "/teams/research/workspace/docs",
    );
  });

  it("throws for every unsafe relative path", () => {
    for (const value of UNSAFE_RELATIVE_PATHS) {
      expect(
        () => resolveTeamWorkspacePath(team, value),
        `expected resolveTeamWorkspacePath(team, ${JSON.stringify(value)}) to throw`,
      ).toThrow();
    }
  });
});
