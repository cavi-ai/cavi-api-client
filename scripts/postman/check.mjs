#!/usr/bin/env node
/**
 * Fail if committed Postman collection/environment drifted from generation.
 * Requires a build first (generator reads dist/).
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const COMMITTED_COLLECTION = path.join(ROOT, "docs", "postman", "cavi-api-client.postman_collection.json");
const COMMITTED_ENV = path.join(ROOT, "docs", "postman", "cavi-api-client.postman_environment.json");

const scratch = await mkdtemp(path.join(tmpdir(), "postman-check-"));
try {
  const generatedCollection = path.join(scratch, "collection.json");
  const result = spawnSync(
    process.execPath,
    [path.join(HERE, "generate.mjs"), "--out", generatedCollection],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  if (result.status !== 0) {
    process.stderr.write("postman:check — generation failed (did you run `pnpm run build`?)\n");
    process.exit(1);
  }
  const generatedEnv = path.join(scratch, "cavi-api-client.postman_environment.json");
  const pairs = [
    [COMMITTED_COLLECTION, generatedCollection, "collection"],
    [COMMITTED_ENV, generatedEnv, "environment"],
  ];
  for (const [committed, generated, label] of pairs) {
    const [expected, actual] = await Promise.all([
      readFile(committed, "utf8"),
      readFile(generated, "utf8"),
    ]);
    if (expected !== actual) {
      process.stderr.write(
        `postman:check — docs/postman/cavi-api-client.postman_${label === "collection" ? "collection" : "environment"}.json is stale.\n` +
          "Run `pnpm run build && pnpm run postman:generate` and commit the result.\n",
      );
      process.exit(1);
    }
  }
  process.stderr.write("postman:check — collection and environment match the surface contracts.\n");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
