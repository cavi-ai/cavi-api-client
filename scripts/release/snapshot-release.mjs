import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { inspectRelease } from "./inspect-release.mjs";
import { DOCUMENTED_SOURCE_DATE_EPOCH } from "../docs/types.mjs";

const [tarball, destination] = process.argv.slice(2);

if (!tarball || !destination || process.argv.slice(2).length !== 2) {
  throw new Error("usage: node scripts/release/snapshot-release.mjs <release.tgz> <manifest.json>");
}

const manifest = await inspectRelease(path.resolve(tarball));
const outputPath = path.resolve(destination);
const previous = existsSync(outputPath) ? JSON.parse(await readFile(outputPath, "utf8")) : {};
const sourceDateEpoch = Number.isSafeInteger(Number(previous.sourceDateEpoch)) && Number(previous.sourceDateEpoch) > 0
  ? Number(previous.sourceDateEpoch)
  : DOCUMENTED_SOURCE_DATE_EPOCH;
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ ...manifest, sourceDateEpoch }, null, 2)}
`);
