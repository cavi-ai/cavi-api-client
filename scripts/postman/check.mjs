#!/usr/bin/env node
/**
 * Fail if the committed Postman collection has drifted from what the current
 * surface contracts would generate. Regenerates to a temp file and diffs.
 *
 * Requires a build first (the generator reads dist/). Run out of band, like
 * docs:check — not part of `pnpm test`, which has the fast in-source guard
 * (src/__tests__/postman-collection.test.ts).
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const COMMITTED = path.join(ROOT, "docs", "postman", "cavi-api-client.postman_collection.json");

const scratch = await mkdtemp(path.join(tmpdir(), "postman-check-"));
try {
  const generated = path.join(scratch, "collection.json");
  const result = spawnSync(
    process.execPath,
    [path.join(HERE, "generate.mjs"), "--out", generated],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (result.status !== 0) {
    process.stderr.write("postman:check — generation failed (did you run `pnpm run build`?)\n");
    process.exit(1);
  }
  const [expected, actual] = await Promise.all([
    readFile(COMMITTED, "utf8"),
    readFile(generated, "utf8"),
  ]);
  if (expected !== actual) {
    process.stderr.write(
      "postman:check — docs/postman/cavi-api-client.postman_collection.json is stale.\n" +
        "Run `pnpm run build && pnpm run postman:generate` and commit the result.\n",
    );
    process.exit(1);
  }
  process.stderr.write("postman:check — collection matches the surface contracts.\n");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
