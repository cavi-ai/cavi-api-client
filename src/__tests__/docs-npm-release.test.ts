import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  resolveNpmRelease,
  runResolveNpmReleaseCli,
} from "../../scripts/docs/resolve-npm-release.mjs";

const PACKAGE_NAME = "@cavi-ai/api-client";
const VERSION = "0.15.0";
const TAG = `v${VERSION}`;
const COMMIT = "c".repeat(40);
const TARBALL_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/-/api-client-${VERSION}.tgz`;
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

function registryFetch(metadataOverrides: Record<string, unknown> = {}, bytes = tarballBytes) {
  return async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url === TARBALL_URL) return new Response(bytes, { status: 200 });
    return Response.json({
      name: PACKAGE_NAME,
      version: VERSION,
      gitHead: COMMIT,
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
      outputFile,
      fetchImpl: registryFetch(),
    });

    expect(release).toEqual({
      version: VERSION,
      tag: TAG,
      metadataUrl: "https://registry.npmjs.org/%40cavi-ai%2Fapi-client/0.15.0",
      tarballUrl: TARBALL_URL,
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
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({ dist: { integrity, tarball: mutatedUrl } }),
    })).rejects.toThrow(/canonical npm tarball URL/u);
  });

  it.each([
    ["missing", undefined],
    ["mismatched", "d".repeat(40)],
  ])("rejects %s npm gitHead provenance", async (_label, gitHead) => {
    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      outputFile: path.join(await temporaryDirectory(), "release.tgz"),
      fetchImpl: registryFetch({ gitHead }),
    })).rejects.toThrow(/gitHead.*release commit/u);
  });

  it("prints only public release metadata and digests from the CLI", async () => {
    const outputFile = path.join(await temporaryDirectory(), "release.tgz");
    let stdout = "";

    await runResolveNpmReleaseCli([
      "--version", VERSION,
      "--tag", TAG,
      "--commit", COMMIT,
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
        gitHead: COMMIT,
        dist: { integrity, tarball: TARBALL_URL },
      });
    };

    await expect(resolveNpmRelease({
      packageName: PACKAGE_NAME,
      version: VERSION,
      tag: TAG,
      commit: COMMIT,
      outputFile: path.join(directory, "release.tgz"),
      fetchImpl,
      requestTimeoutMs: 25,
      timeoutSignalFactory,
    })).rejects.toThrow("npm tarball request timed out after 25ms");
  });
});
