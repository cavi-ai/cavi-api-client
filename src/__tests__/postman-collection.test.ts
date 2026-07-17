import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SURFACE_CONTRACTS } from "../contracts/surfaces.js";
import { CAVI_SURFACE_CONTRACTS } from "../extensions/cavi/contracts/surfaces.js";

const ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const COLLECTION = path.join(ROOT, "docs", "postman", "cavi-api-client.postman_collection.json");

// Must match scripts/postman/generate.mjs. Kept here so the guard needs no
// build step and runs in the fast suite.
const SENTINELS: Record<string, string> = {
  portal: "__PORTAL__", teamId: "__TEAMID__", agentId: "__AGENTID__", taskId: "__TASKID__",
  memberId: "__MEMBERID__", teamSlug: "__TEAMSLUG__", memoryKey: "__MEMORYKEY__",
  workspacePath: "__WORKSPACEPATH__", assetId: "__ASSETID__", jobId: "__JOBID__",
  vaultId: "__VAULTID__", artifactId: "__ARTIFACTID__", runId: "__RUNID__", kind: "__KIND__",
  actionId: "__ACTIONID__", path: "__PATH__",
};

function templatePath(resolve: (params?: Record<string, string>) => string): string {
  let out = resolve(SENTINELS);
  for (const [name, sentinel] of Object.entries(SENTINELS)) {
    out = out.split(sentinel).join(`{{${name}}}`);
  }
  return out;
}

type PostmanRequest = {
  name: string;
  request: { method: string; url: { raw: string } };
  event: { listen: string; script: { exec: string[] } }[];
};
type PostmanFolder = { name: string; item: PostmanRequest[] };

describe("postman collection stays in sync with the surface contracts", () => {
  const collection = JSON.parse(readFileSync(COLLECTION, "utf8")) as {
    item: PostmanFolder[];
    variable: { key: string }[];
  };
  const requestsByName = new Map<string, PostmanRequest>();
  for (const folder of collection.item) {
    for (const request of folder.item) requestsByName.set(request.name, request);
  }
  const allContracts = { ...SURFACE_CONTRACTS, ...CAVI_SURFACE_CONTRACTS };

  it("has exactly one request per surface contract — no missing, no extra", () => {
    const expected = Object.values(allContracts)
      .map((c) => `${c.key} — ${c.method} ${templatePath(c.path)}`)
      .sort();
    expect([...requestsByName.keys()].sort()).toEqual(expected);
  });

  it("uses each contract's real method and resolved path", () => {
    for (const contract of Object.values(allContracts)) {
      const name = `${contract.key} — ${contract.method} ${templatePath(contract.path)}`;
      const request = requestsByName.get(name);
      expect(request, `missing request for ${contract.key}`).toBeDefined();
      expect(request?.request.method).toBe(contract.method);
      expect(request?.request.url.raw).toBe(`{{baseUrl}}${templatePath(contract.path)}`);
    }
  });

  it("encodes the degradation policy in every request test", () => {
    for (const contract of Object.values(allContracts)) {
      const name = `${contract.key} — ${contract.method} ${templatePath(contract.path)}`;
      const exec = requestsByName.get(name)?.event[0]?.script.exec.join("\n") ?? "";
      if (contract.degradation === "hard") {
        expect(exec, `${contract.key} hard test`).toContain("endpoint exists (hard)");
        expect(exec).toContain("below(500)");
      } else {
        expect(exec, `${contract.key} gap test`).toContain("gap surfaces never fail");
      }
    }
  });

  it("registers a collection variable for every path param the surfaces use", () => {
    const usedParams = new Set<string>();
    for (const contract of Object.values(allContracts)) {
      const resolved = contract.path(SENTINELS);
      for (const [name, sentinel] of Object.entries(SENTINELS)) {
        if (resolved.includes(sentinel)) usedParams.add(name);
      }
    }
    const declared = new Set(collection.variable.map((v) => v.key));
    for (const param of usedParams) {
      expect(declared, `collection variable {{${param}}}`).toContain(param);
    }
    expect(declared).toContain("baseUrl");
    expect(declared).toContain("token");
  });
});
