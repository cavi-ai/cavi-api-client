import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = mkdtempSync(path.join(tmpdir(), "cavi-python-consumer-"));
try {
  execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", temporary], {
    cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, npm_config_cache: path.join(temporary, "npm-cache") },
  });
  const archives = readdirSync(temporary).filter((name) => name.endsWith(".tgz"));
  if (archives.length !== 1) throw new Error("npm pack must create exactly one archive");
  const archive = archives[0];
  execFileSync("tar", ["-xzf", path.join(temporary, archive), "-C", temporary]);
  const packed = path.join(temporary, "package");
  const manifest = JSON.parse(readFileSync(path.join(packed, "package.json"), "utf8"));
  for (const entry of [manifest.bin["cavi-runtime-bridge"], "python/cavi_runtime/client.py", "python/cavi_runtime/py.typed", "examples/runtime-bridge/claude.mjs"]) {
    if (!existsSync(path.join(packed, entry))) throw new Error(`Missing packed entry: ${entry}`);
  }
  if (existsSync(path.join(packed, "python/tests")) || existsSync(path.join(packed, "python/cavi_runtime/__pycache__"))) {
    throw new Error("Python tests or bytecode leaked into package");
  }
  cpSync(path.join(root, "python/tests"), path.join(packed, "python/tests"), {
    recursive: true, filter: (entry) => !entry.includes("__pycache__"),
  });
  execFileSync(process.env.PYTHON ?? "python3", ["-m", "unittest", "discover", "-s", "python/tests", "-v"], {
    cwd: packed, stdio: "inherit", env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  process.stdout.write(`Packed Python runtime consumer passed for ${manifest.name}@${manifest.version}\n`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
