import { cp, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { loadContracts } from "../../scripts/docs/contracts.mjs";

const root = path.resolve(".");
const contractsDirectory = "docs/api-client/source/contracts";
const manifestSnapshotPath = path.resolve(
  "docs/api-client/source/releases/0.11.0-manifest.json",
);
const temporaryDirectories: string[] = [];
let manifest: import("../../scripts/docs/types.mjs").ReleaseManifest;

beforeAll(async () => {
  manifest = JSON.parse(await readFile(manifestSnapshotPath, "utf8"));
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
  await cp(path.join(root, "docs/api-client/source/releases"), path.join(directory, "docs/api-client/source/releases"), { recursive: true });
  await cp(path.join(root, "docs/examples"), path.join(directory, "docs/examples"), {
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
    expect(manifest.sha256).toBe(
      "3379cd47b4890d0e00f5949583f90a83367705878b16141e825f66ef5d8819e5",
    );
    expect(manifest.symbols).toEqual(expect.arrayContaining([
      expect.objectContaining({
        subpath: "./core/errors",
        name: "ApiClientError",
        kind: "class",
        signature: expect.stringContaining("constructor(message: string"),
      }),
    ]));
  });

  it("rejects a manifest for a different package", async () => {
    await expect(
      loadContracts(root, { ...manifest, package: "@cavi-ai/not-the-api-client" }),
    ).rejects.toThrow(
      /registry: expected manifest package to equal @cavi-ai\/api-client; observed @cavi-ai\/not-the-api-client; fix:/u,
    );
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

  it("rejects fixture evidence that does not reference the declared contract symbol", async () => {
    const registryRoot = await mutableRegistry();
    await writeFile(
      path.join(registryRoot, "docs/examples/contracts/runtime-error.ts"),
      'export const unrelatedFixture = "present but semantically unrelated";\n',
    );

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /runtime-error: expected fixture evidence .* to reference declared symbol ApiClientError; observed symbol absent; fix:/u,
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

  it("rejects traversal-like contract identifiers", async () => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "runtime-error.json", (record) => { record.id = "../runtime-error"; });
    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(/id to be a safe lowercase slug/u);
  });

  it.each([
    ["version", "0.11.1", /version to equal 0\.11\.0/u],
    ["stability", "experimental", /stability to equal stable/u],
    ["summary", "   ", /summary to be a non-empty string/u],
    ["purpose", "", /purpose to be a non-empty string/u],
    ["fieldConstraints", [], /fieldConstraints to contain structured non-empty entries/u],
    ["behavior", {}, /behavior to be complete and structured/u],
    ["examples", {}, /valid and invalid examples with expected outcomes/u],
    ["symbols", [{ subpath: "", name: "ApiClientError" }], /each symbol to contain non-empty subpath and name/u],
    ["symbols", "not-an-array", /symbols to be a non-empty array/u],
    ["evidence", [42], /evidence path to be repository-relative/u],
    ["evidence", [], /evidence to be a non-empty array/u],
    ["evidence", ["../outside.test.ts"], /evidence path to be repository-relative/u],
    ["evidence", [path.resolve("outside.test.ts")], /evidence path to be repository-relative/u],
  ])("rejects malformed %s fields", async (field, value, diagnostic) => {
    const registryRoot = await mutableRegistry();
    await mutateRecord(registryRoot, "runtime-error.json", (record) => {
      record[field] = value;
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(diagnostic);
  });

  it("rejects an evidence symlink whose target escapes the repository", async () => {
    const registryRoot = await mutableRegistry();
    const externalDirectory = await mkdtemp(path.join(tmpdir(), "cavi-docs-external-"));
    temporaryDirectories.push(externalDirectory);
    const externalEvidence = path.join(externalDirectory, "evidence.test.ts");
    await writeFile(externalEvidence, "// external\n");
    const linkPath = path.join(registryRoot, "escaped-evidence.test.ts");
    await symlink(externalEvidence, linkPath);
    await mutateRecord(registryRoot, "runtime-error.json", (record) => {
      record.evidence = [{ type: "fixture", path: "escaped-evidence.test.ts" }];
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /runtime-error: expected evidence path to be contained by the repository root; observed escaped-evidence\.test\.ts; fix:/u,
    );
  });

  it("rejects an intermediate evidence symlink that escapes the repository", async () => {
    const registryRoot = await mutableRegistry();
    const externalDirectory = await mkdtemp(path.join(tmpdir(), "cavi-docs-external-"));
    temporaryDirectories.push(externalDirectory);
    await writeFile(path.join(externalDirectory, "evidence.test.ts"), "// external\n");
    await symlink(externalDirectory, path.join(registryRoot, "linked-directory"));
    await mutateRecord(registryRoot, "runtime-error.json", (record) => {
      record.evidence = [{ type: "fixture", path: "linked-directory/evidence.test.ts" }];
    });

    await expect(loadContracts(registryRoot, manifest)).rejects.toThrow(
      /runtime-error: expected evidence path to be contained by the repository root; observed linked-directory\/evidence\.test\.ts; fix:/u,
    );
  });
});
