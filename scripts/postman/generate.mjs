#!/usr/bin/env node
/**
 * Generate a Postman v2.1 collection from the package's own surface contracts.
 *
 * CODE IS LAW: the collection is derived from SURFACE_CONTRACTS (global) and
 * CAVI_SURFACE_CONTRACTS by executing each contract's real `path()` resolver.
 * Never hand-edit the generated collection — change the contracts and rerun.
 *
 * Each request carries a test that operationalizes the contract's `degradation`:
 *   hard  → the endpoint MUST exist. 404/5xx fail the run.
 *   gap   → the endpoint MAY not exist yet. The test never fails; it records
 *           whether the surface is PROVEN (2xx) or still UNPROVEN (404), so a
 *           full run turns the gap/hard table into observed reality.
 *
 * Usage: pnpm run build && node scripts/postman/generate.mjs [--out <file>]
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const DIST = (rel) => path.join(ROOT, "dist", rel);
const { SURFACE_CONTRACTS } = await import(DIST("contracts/surfaces.js"));
const { CAVI_SURFACE_CONTRACTS } = await import(DIST("extensions/cavi/contracts/surfaces.js"));

// Globally-unique sentinels so a resolved path can be reverse-mapped back to
// Postman {{variables}} without ambiguity. Realistic defaults ship in the
// environment template.
const PARAMS = {
  portal: { sentinel: "__PORTAL__", sample: "martina" },
  teamId: { sentinel: "__TEAMID__", sample: "research" },
  agentId: { sentinel: "__AGENTID__", sample: "analyst" },
  taskId: { sentinel: "__TASKID__", sample: "t_1" },
  memberId: { sentinel: "__MEMBERID__", sample: "analyst" },
  teamSlug: { sentinel: "__TEAMSLUG__", sample: "research" },
  memoryKey: { sentinel: "__MEMORYKEY__", sample: "scratch" },
  workspacePath: { sentinel: "__WORKSPACEPATH__", sample: "research/complete" },
  assetId: { sentinel: "__ASSETID__", sample: "asset-1" },
  jobId: { sentinel: "__JOBID__", sample: "job-1" },
  vaultId: { sentinel: "__VAULTID__", sample: "vault-1" },
  artifactId: { sentinel: "__ARTIFACTID__", sample: "artifact-1" },
  runId: { sentinel: "__RUNID__", sample: "run-1" },
  kind: { sentinel: "__KIND__", sample: "image" },
  actionId: { sentinel: "__ACTIONID__", sample: "action-1" },
  path: { sentinel: "__PATH__", sample: "notes/example.md" },
};
const SENTINEL_PARAMS = Object.fromEntries(
  Object.entries(PARAMS).map(([name, { sentinel }]) => [name, sentinel]),
);

/** Replace every sentinel in a resolved path with its {{param}} and record use. */
function toTemplate(resolved, used) {
  let out = resolved;
  for (const [name, { sentinel }] of Object.entries(PARAMS)) {
    if (out.includes(sentinel)) {
      out = out.split(sentinel).join(`{{${name}}}`);
      used.add(name);
    }
  }
  return out;
}

function testScript(key, degradation) {
  if (degradation === "hard") {
    return [
      `pm.test("${key} — endpoint exists (hard)", function () {`,
      "  var c = pm.response.code;",
      "  pm.expect(c, 'status ' + c).to.not.be.oneOf([404]);",
      "  pm.expect(c, 'status ' + c).to.be.below(500);",
      "});",
    ];
  }
  // gap: never fails; reports proven vs unproven.
  return [
    `// ${key} is declared "gap": it may not exist on this backend yet.`,
    "var c = pm.response.code;",
    "var proven = c >= 200 && c < 300;",
    `pm.test("${key} — " + (proven ? "PROVEN (" + c + ")" : "unproven (" + c + ")"), function () {`,
    "  pm.expect(true).to.be.true; // informational: gap surfaces never fail the run",
    "});",
  ];
}

function requestItem(contract) {
  const used = new Set();
  const resolved = contract.path(SENTINEL_PARAMS);
  const template = toTemplate(resolved, used);
  const rawUrl = `{{baseUrl}}${template}`;
  const segments = template.split("/").filter(Boolean);
  const hasBody = contract.method === "POST" || contract.method === "PUT" || contract.method === "PATCH";
  return {
    name: `${contract.key} — ${contract.method} ${template}`,
    request: {
      method: contract.method,
      header: [{ key: "Accept", value: "application/json" }],
      ...(hasBody
        ? {
          body: {
            mode: "raw",
            raw: "{}",
            options: { raw: { language: "json" } },
          },
        }
        : {}),
      url: { raw: rawUrl, host: ["{{baseUrl}}"], path: segments },
      description: `${contract.note}\n\nOwner: ${contract.owner}\nDegradation: ${contract.degradation}`,
    },
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: testScript(contract.key, contract.degradation) },
      },
    ],
    _params: [...used],
  };
}

// Group by owner into folders.
const all = { ...SURFACE_CONTRACTS, ...CAVI_SURFACE_CONTRACTS };
const folders = new Map();
const usedParams = new Set();
for (const contract of Object.values(all)) {
  const item = requestItem(contract);
  item._params.forEach((p) => usedParams.add(p));
  delete item._params;
  const owner = contract.owner;
  if (!folders.has(owner)) folders.set(owner, []);
  folders.get(owner).push(item);
}

const items = [...folders.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([owner, requests]) => ({
    name: owner,
    item: requests.sort((a, b) => a.name.localeCompare(b.name)),
  }));

const variables = [
  { key: "baseUrl", value: "http://localhost:8080", type: "string" },
  { key: "token", value: "", type: "string" },
  ...[...usedParams]
    .sort()
    .map((name) => ({ key: name, value: PARAMS[name].sample, type: "string" })),
];

// Stable id so re-generation does not churn the diff.
const collection = {
  info: {
    // eslint-disable-next-line camelcase
    _postman_id: "cavi-api-client-surfaces",
    name: "@cavi-ai/api-client — surface contracts",
    description:
      "Generated from SURFACE_CONTRACTS + CAVI_SURFACE_CONTRACTS by scripts/postman/generate.mjs. " +
      "Do not hand-edit. Set {{baseUrl}} and {{token}}, then run to verify every declared endpoint. " +
      "`hard` requests fail on 404/5xx; `gap` requests report PROVEN vs unproven without failing.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  variable: variables,
  item: items,
};

const outArg = process.argv.indexOf("--out");
const outFile =
  outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1])
    : path.join(ROOT, "docs", "postman", "cavi-api-client.postman_collection.json");

await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, `${JSON.stringify(collection, null, 2)}\n`, "utf8");

const total = items.reduce((n, f) => n + f.item.length, 0);
process.stderr.write(
  `postman:generate — ${total} requests in ${items.length} folders -> ${path.relative(ROOT, outFile)}\n`,
);
