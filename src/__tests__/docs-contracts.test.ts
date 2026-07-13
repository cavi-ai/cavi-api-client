import { execFile } from "node:child_process";
import { cp, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { loadContracts } from "../../scripts/docs/contracts.mjs";
import { inspectRelease } from "../../scripts/docs/inspect-release.mjs";

const root = path.resolve(".");
const contractsDirectory = "docs/api-client/source/contracts";
const releaseFixture = path.resolve("src/__tests__/fixtures/docs-contracts-release/package");
const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];
let manifest: Awaited<ReturnType<typeof inspectRelease>>;

beforeAll(async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-contracts-release-"));
  temporaryDirectories.push(directory);
  await cp(releaseFixture, path.join(directory, "package"), { recursive: true });
  const tarball = path.join(directory, "release.tgz");
  await execFileAsync("tar", ["-czf", tarball, "package"], { cwd: directory });
  manifest = await inspectRelease(tarball);
});

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function mutableRegistry(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-contracts-test-"));
  temporaryDirectories.push(directory);
  await cp(path.join(root, contractsDirectory), path.join(directory, contractsDirectory), {
    recursive: true,
  });
  await cp(path.join(root, "src/__tests__"), path.join(directory, "src/__tests__"), {
    recursive: true,
  });
  return directory;
}

async function mutateRecord(
  registryRoot: string,
  filename: string,
  mutate: (record: Record<string, unknown>) => void,
): Promise<void> {
  const recordPath = path.join(registryRoot, contractsDirectory, filename);
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  mutate(record);
  await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`);
}

describe("loadContracts", () => {
  it("loads the six stable mirrored contract records", async () => {
    const contracts = await loadContracts(root, manifest);

    expect(contracts.map((contract) => contract.id)).toEqual([
      "capabilities",
      "routes",
      "runtime-error",
      "runtime-request",
      "runtime-response",
      "stream-event",
    ]);
  });

  it("rejects an unsupported capability state", async () => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "capabilities.json", (record) => {
      record.capability = "experimental";
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /capabilities: expected capability to be one of supported, unsupported, conditional, unknown; observed experimental; fix:/u,
    );
  });

  it("rejects an absent public symbol", async () => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "runtime-request.json", (record) => {
      record.symbols = [{ subpath: "./core/runtime", name: "CurrentBranchOnlyRequest" }];
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /runtime-request: expected public symbol .*CurrentBranchOnlyRequest.* in @cavi-ai\/api-client@0\.11\.0; observed absent; fix:/u,
    );
  });

  it("rejects a missing evidence file", async () => {
    const registryRoot = await mutableRegistry();
    await unlink(path.join(registryRoot, "src/__tests__/core/runtime/run-types.test.ts"));

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /runtime-request: expected evidence file .*run-types\.test\.ts to exist; observed missing; fix:/u,
    );
  });

  it("rejects duplicate IDs", async () => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "routes.json", (record) => {
      record.id = "capabilities";
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /capabilities: expected contract id to be unique; observed duplicate; fix:/u,
    );
  });

  it("rejects canonical ownership claims", async () => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "stream-event.json", (record) => {
      record.sourceOfTruth = "canonical";
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /stream-event: expected sourceOfTruth to equal upstream-compatible-mirror; observed canonical; fix:/u,
    );
  });
});
