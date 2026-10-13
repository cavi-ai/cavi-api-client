import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("packs Python sources and typing without interpreter bytecode", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cavi-python-pack-"));
  try {
    const manifest = JSON.parse(readFileSync("package.json", "utf8"));
    delete manifest.scripts;
    writeFileSync(path.join(root, "package.json"), JSON.stringify(manifest));
    cpSync("python/cavi_runtime", path.join(root, "python/cavi_runtime"), { recursive: true });
    const cache = path.join(root, "python/cavi_runtime/__pycache__");
    mkdirSync(cache, { recursive: true });
    writeFileSync(path.join(cache, "native.cpython-999.pyc"), "interpreter-specific bytecode");
    const output = path.join(root, "packed");
    mkdirSync(output);
    execFileSync("pnpm", ["pack", "--pack-destination", output], {
      cwd: root, stdio: "pipe", timeout: 30_000,
    });
    const archives = readdirSync(output).filter((name) => name.endsWith(".tgz"));
    expect(archives).toHaveLength(1);
    const files = execFileSync("tar", ["-tzf", path.join(output, archives[0]!)], {
      encoding: "utf8",
    }).trim().split("\n");
    expect(files.filter((name) => /__pycache__|\.py[cod]$/u.test(name))).toEqual([]);
    for (const name of ["__init__.py", "__init__.pyi", "native.py", "openclaw.py", "opencode.py", "py.typed"]) {
      expect(files).toContain(`package/python/cavi_runtime/${name}`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);
