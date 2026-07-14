import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { inspectRelease } from "./inspect-release.mjs";

const [tarball, destination, expectedSha256] = process.argv.slice(2);

if (!tarball || !destination) {
  throw new Error("usage: node scripts/docs/snapshot-release.mjs <release.tgz> <manifest.json>");
}

const manifest = await inspectRelease(path.resolve(tarball), expectedSha256 ? { expectedSha256 } : undefined);
const outputPath = path.resolve(destination);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
