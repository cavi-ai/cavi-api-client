import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveNpmRelease,
  runResolveNpmReleaseCli,
} from "../../scripts/release/resolve-npm-release.mjs";

const PACKAGE_NAME = "@cavi-ai/api-client";
const VERSION = "0.15.0";
const TAG = `v${VERSION}`;
const COMMIT = "c".repeat(40);
const REPOSITORY = "cavi-ai/cavi-api-client";
const TARBALL_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/-/api-client-${VERSION}.tgz`;
const ATTESTATIONS_URL =
  `https://registry.npmjs.org/-/npm/v1/attestations/%40cavi-ai%2Fapi-client@${VERSION}`;
const SLSA_PROVENANCE_PREDICATE = "https://slsa.dev/provenance/v1";
const tarballBytes = Buffer.from("exact published npm tarball bytes\n", "utf8");
const integrity = `sha512-${createHash("sha512").update(tarballBytes).digest("base64")}`;
const sha256 = createHash("sha256").update(tarballBytes).digest("hex");
const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "cavi-docs-npm-release-"));
  temporaryDirectories.push(directory);
  return directory;
}

function timedOutSignal(): AbortSignal {
  const controller = new AbortController();
  controller.abort(new DOMException("deadline exceeded", "TimeoutError"));
  return controller.signal;
}

function provenanceStatement(
  bytes = tarballBytes,
  subjectName = `pkg:npm/%40cavi-ai/api-client@${VERSION}`,
) {
  return {
    predicateType: SLSA_PROVENANCE_PREDICATE,
    subject: [{
      name: subjectName,
      digest: { sha512: createHash("sha512").update(bytes).digest("hex") },
    }],
    predicate: {
      buildDefinition: {
        externalParameters: {
          workflow: {
            ref: `refs/tags/${TAG}`,
            repository: `https://github.com/${REPOSITORY}`,
            path: ".github/workflows/publish.yml",
          },
        },
        resolvedDependencies: [{
          uri: `git+https://github.com/${REPOSITORY}@refs/tags/${TAG}`,
          digest: { gitCommit: COMMIT },
        }],
      },
    },
  };
}

function attestationsDocument(statements: Array<Record<string, unknown>>) {
  return {
    attestations: statements.map((statement) => ({
      predicateType: statement.predicateType,
      bundle: {
        dsseEnvelope: {
          payload: Buffer.from(JSON.stringify(statement), "utf8").toString("base64"),
        },
      },
    })),
  };
}

function registryFetch(
  metadataOverrides: Record<string, unknown> = {},
  bytes = tarballBytes,
  attestations: unknown = attestationsDocument([provenanceStatement(bytes)]),
) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url === TARBALL_URL) return new Response(bytes, { status: 200 });
    if (url === ATTESTATIONS_URL) return Response.json(attestations);
    return Response.json({
      name: PACKAGE_NAME,
      version: VERSION,
      dist: { integrity, tarball: TARBALL_URL },
      ...metadataOverrides,
    });
  };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true, force: true }),
  ));
});

describe("resolveNpmRelease", () => {
  it("downloads the canonical exact-version tarball and verifies its npm integrity", async () => {
    const directory = await temporaryDirectory();
    const outputFile = path.join(directory, "release.tgz");

    const release = await resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile,
      fetchImpl: registryFetch(),
    });

    expect(release).toEqual({
      version: VERSION,
      tag: TAG,
      metadataUrl: "https://registry.npmjs.org/%40cavi-ai%2Fapi-client/0.15.0",
      tarballUrl: TARBALL_URL,
      attestationsUrl: ATTESTATIONS_URL,
      integrity,
      tarballSha256: sha256,
    });
    await expect(readFile(outputFile)).resolves.toEqual(tarballBytes);
  });

  it.each([
    ["a prerelease", "0.15.0-rc.1", "v0.15.0-rc.1", /stable exact version/u],
    ["a version range", "^0.15.0", "v^0.15.0", /stable exact version/u],
    ["a mismatched tag", VERSION, "v0.15.1", /tag.*version/u],
  ])("rejects %s", async (_label, version, tag, expected) => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version,
      tag,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch(),
    })).rejects.toThrow(expected);
  });

  it("rejects package metadata whose version differs from the requested exact version", async () => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({ version: "0.15.1" }),
    })).rejects.toThrow(/metadata version.*0\.15\.0.*0\.15\.1/u);
  });

  it("rejects metadata without npm integrity", async () => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({ dist: { tarball: TARBALL_URL } }),
    })).rejects.toThrow(/integrity/u);
  });

  it("rejects tarball bytes that no longer match the registry integrity", async () => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, Buffer.from("mutated registry bytes\n", "utf8")),
    })).rejects.toThrow(/integrity mismatch/u);
  });

  it("rejects registry metadata that redirects the tarball to a noncanonical location", async () => {
    const mutatedUrl = "https://packages.example.invalid/api-client-0.15.0.tgz";
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({ dist: { integrity, tarball: mutatedUrl } }),
    })).rejects.toThrow(/canonical npm tarball URL/u);
  });

  it("rejects a release without exactly one SLSA provenance attestation", async () => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, { attestations: [] }),
    })).rejects.toThrow(/exactly one https:\/\/slsa\.dev\/provenance\/v1 attestation/u);
  });

  it("accepts a fully percent-encoded provenance subject name", async () => {
    const statement = provenanceStatement(
      tarballBytes,
      `pkg:npm/%40cavi-ai%2Fapi-client@${VERSION}`,
    );
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, attestationsDocument([statement])),
    })).resolves.toMatchObject({ tarballSha256: sha256 });
  });

  it("rejects provenance published under a different package name", async () => {
    const statement = provenanceStatement(tarballBytes, `pkg:npm/%40attacker/api-client@${VERSION}`);
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, attestationsDocument([statement])),
    })).rejects.toThrow(/provenance subject/u);
  });

  it("rejects provenance whose subject digest is not the published tarball", async () => {
    const statement = provenanceStatement(Buffer.from("other bytes\n", "utf8"));
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, attestationsDocument([statement])),
    })).rejects.toThrow(/provenance subject.*tarball digest/u);
  });

  it.each([
    [
      "a foreign repository",
      { repository: "https://github.com/attacker/cavi-api-client" },
      /provenance repository/u,
    ],
    ["a branch ref", { ref: "refs/heads/main" }, /provenance ref/u],
    ["a foreign workflow", { path: ".github/workflows/attack.yml" }, /provenance workflow/u],
  ])("rejects provenance built from %s", async (_label, workflowOverrides, expected) => {
    const base = provenanceStatement();
    const statement = {
      ...base,
      predicate: {
        buildDefinition: {
          ...base.predicate.buildDefinition,
          externalParameters: {
            workflow: {
              ...base.predicate.buildDefinition.externalParameters.workflow,
              ...workflowOverrides,
            },
          },
        },
      },
    };
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, attestationsDocument([statement])),
    })).rejects.toThrow(expected);
  });

  it("rejects provenance that does not resolve to the release commit", async () => {
    const base = provenanceStatement();
    const statement = {
      ...base,
      predicate: {
        buildDefinition: {
          ...base.predicate.buildDefinition,
          resolvedDependencies: [{ digest: { gitCommit: "d".repeat(40) } }],
        },
      },
    };
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({}, tarballBytes, attestationsDocument([statement])),
    })).rejects.toThrow(/does not resolve to release commit/u);
  });

  it("rejects a repository that is not an owner/name slug", async () => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: "https://github.com/cavi-ai/cavi-api-client",
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch(),
    })).rejects.toThrow(/owner\/name slug/u);
  });

  it("prints only public release metadata and digests from the CLI", async () => {
    const outputFile = path.join(await temporaryDirectory(), "release.tgz");
    let stdout = "";

    await runResolveNpmReleaseCli([
      "--version", VERSION,
      "--tag", TAG,
      "--commit", COMMIT,
      "--repository", REPOSITORY,
      "--output", outputFile,
    ], {
      fetchImpl: registryFetch(),
      stdout: { write: (value: string) => { stdout += value; } },
    });

    expect(JSON.parse(stdout)).toEqual({
      version: VERSION,
      tag: TAG,
      metadataUrl: "https://registry.npmjs.org/%40cavi-ai%2Fapi-client/0.15.0",
      tarballUrl: TARBALL_URL,
      attestationsUrl: ATTESTATIONS_URL,
      integrity,
      tarballSha256: sha256,
    });
    expect(stdout).not.toContain(outputFile);
  });

  it("bounds the npm metadata request with an injected abort timeout", async () => {
    const directory = await temporaryDirectory();
    const fetchImpl = async (
      _input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      if (!init?.signal) throw new Error("metadata request did not receive a timeout signal");
      if (init.signal.aborted) throw init.signal.reason;
      return await new Promise<Response>((_resolve, reject) =>
        init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true })
      );
    };

    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(directory, "release.tgz"),
      fetchImpl,
      requestTimeoutMs: 25,
      timeoutSignalFactory: () => timedOutSignal(),
    })).rejects.toThrow("npm metadata request timed out after 25ms");
  });

  it("gives the npm tarball request its own injected abort timeout", async () => {
    const directory = await temporaryDirectory();
    let signalIndex = 0;
    const timeoutSignalFactory = () =>
      signalIndex++ === 0 ? new AbortController().signal : timedOutSignal();
    const fetchImpl = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      if (!init?.signal) throw new Error("request did not receive a timeout signal");
      if (String(input) === TARBALL_URL) {
        if (init.signal.aborted) throw init.signal.reason;
        throw new Error("tarball request did not receive its own timeout signal");
      }
      return Response.json({
        name: PACKAGE_NAME,
        version: VERSION,
        dist: { integrity, tarball: TARBALL_URL },
      });
    };

    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(directory, "release.tgz"),
      fetchImpl,
      requestTimeoutMs: 25,
      timeoutSignalFactory,
    })).rejects.toThrow("npm tarball request timed out after 25ms");
  });

  it("gives the npm attestation request its own injected abort timeout", async () => {
    const directory = await temporaryDirectory();
    let signalIndex = 0;
    const timeoutSignalFactory = () =>
      signalIndex++ < 2 ? new AbortController().signal : timedOutSignal();
    const registry = registryFetch();
    const fetchImpl = async (
      input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      if (!init?.signal) throw new Error("request did not receive a timeout signal");
      if (String(input) === ATTESTATIONS_URL) {
        if (init.signal.aborted) throw init.signal.reason;
        throw new Error("attestation request did not receive its own timeout signal");
      }
      return await registry(input);
    };

    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      repository: REPOSITORY,
      outputFile: path.join(directory, "release.tgz"),
      fetchImpl,
      requestTimeoutMs: 25,
      timeoutSignalFactory,
    })).rejects.toThrow("npm attestation request timed out after 25ms");
  });
});
