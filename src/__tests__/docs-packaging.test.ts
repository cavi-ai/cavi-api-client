import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it("packs only the documented snapshot when archived versions exist", () => {
  const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("../../package.json", import.meta.url)), "utf8"));
  const root = mkdtempSync(path.join(tmpdir(), "api-client-docs-pack-"));
  try {
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ ...manifest, scripts: {} }));
    for (const version of [manifest.documentation.version, "0.0.1", "99.0.0"]) {
      const directory = path.join(root, "docs/api-client", `v${version}`);
      mkdirSync(directory, { recursive: true });
      writeFileSync(path.join(directory, "overview.md"), "# Documentation\n");
    }
    const [packed] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--ignore-scripts", "--json"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }));
    const snapshots = packed.files
      .map((file: { path: string }) => /^docs\/api-client\/(v[^/]+)\//u.exec(file.path)?.[1])
      .filter(Boolean);
    expect([...new Set(snapshots)]).toEqual([`v${manifest.documentation.version}`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
