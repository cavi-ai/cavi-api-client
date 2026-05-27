import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  LIBRARY_CLIP_DEFAULT_TEAM,
  LIBRARY_CLIP_ENDPOINT,
  LIBRARY_CLIP_SOURCE_TAG,
} from "../../../../extensions/cavi/library/clip";

const contractPath = fileURLToPath(
  new URL("../../../../extensions/cavi/library/clip-contract.json", import.meta.url),
);
const packageJsonPath = fileURLToPath(new URL("../../../../../package.json", import.meta.url));

describe("CaviClip package contract", () => {
  it("keeps the JSON app-config contract aligned with TypeScript constants", () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, "utf8")) as {
      endpoint: string;
      defaultTeam: string;
      sourceTag: string;
    };

    expect(contract).toEqual({
      endpoint: LIBRARY_CLIP_ENDPOINT,
      defaultTeam: LIBRARY_CLIP_DEFAULT_TEAM,
      sourceTag: LIBRARY_CLIP_SOURCE_TAG,
    });
  });

  it("publishes the JSON contract as a package subpath", () => {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      exports: Record<string, unknown>;
    };

    expect(packageJson.exports["./extensions/cavi/library-clip-contract.json"]).toBe(
      "./src/extensions/cavi/library/clip-contract.json",
    );
  });
});
