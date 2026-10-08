import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, it, expect } from "vitest";
import { validateMarkdownLinks } from "../../scripts/docs/links.mjs";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });
async function fixture(text: string) {
  const root = await mkdtemp(path.join(tmpdir(), "docs-links-"));
  roots.push(root);
  await writeFile(path.join(root, "index.md"), text);
  return root;
}
it("rejects missing local files", async () => {
  const root = await fixture("[setup](missing.md)");
  await expect(validateMarkdownLinks(root, ["index.md"])).rejects.toThrow("index.md -> missing.md");
});
it("rejects missing heading anchors", async () => {
  const root = await fixture("# Setup\n[go](#missing)");
  await expect(validateMarkdownLinks(root, ["index.md"])).rejects.toThrow("invalid Markdown anchor");
});
it("rejects an existing target excluded from a generated artifact", async () => {
  const root = await fixture("[extra](extra.md)");
  await writeFile(path.join(root, "extra.md"), "# Extra\n");
  await expect(validateMarkdownLinks(root, ["index.md"], { requireListedTargets: true })).rejects.toThrow("index.md -> extra.md");
});
it("accepts duplicate heading slugs and explicit symbol anchors", async () => {
  const root = await fixture('# Setup\n## Setup\n<a id="symbol-runtime"></a>\n[second](#setup-1)\n[symbol](#symbol-runtime)');
  await expect(validateMarkdownLinks(root, ["index.md"])).resolves.toBeUndefined();
});
it("ignores example links inside code fences and external links", async () => {
  const root = await fixture("```md\n[placeholder](absent.md)\n```\n[site](https://example.com)");
  await expect(validateMarkdownLinks(root, ["index.md"])).resolves.toBeUndefined();
});
it("rejects a target escaping the documentation root", async () => {
  const root = await fixture("[escape](../index.md)");
  await expect(validateMarkdownLinks(root, ["index.md"])).rejects.toThrow("invalid relative Markdown link");
});
