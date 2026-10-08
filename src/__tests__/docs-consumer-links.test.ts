import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateMarkdownLinks } from "../../scripts/docs/links.mjs";

describe("consumer documentation links", () => {
  it("keeps repository entry points and provider guides navigable", async () => {
    const files = ["README.md", "API.md", "ARCHITECTURE.md", "MIGRATION.md",
      ...readdirSync("docs/guides").filter((name) => name.endsWith(".md")).map((name) => `docs/guides/${name}`)];
    await expect(validateMarkdownLinks(".", files, { allowDirectories: true })).resolves.toBeUndefined();
  });
});
