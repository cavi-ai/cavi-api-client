import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { inspectRelease } from "./inspect-release.mjs";

const [tarball, destination] = process.argv.slice(2);

if (!tarball || !destination || process.argv.slice(2).length !== 2) {
  throw new Error("usage: node scripts/docs/snapshot-release.mjs <release.tgz> <manifest.json>");
}

const manifest = await inspectRelease(path.resolve(tarball));
const outputPath = path.resolve(destination);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
