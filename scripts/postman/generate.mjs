#!/usr/bin/env node
/**
 * Generate Postman v2.1 collection + environment from surface contracts.
 *
 * CODE IS LAW: derived from SURFACE_CONTRACTS + CAVI_SURFACE_CONTRACTS by
 * executing each contract's real `path()` resolver. Do not hand-edit the
 * generated JSON — change contracts or this generator, then regenerate.
 *
 * Placeholders are intentionally agnostic (no fleet / personal / host names).
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

/**
 * Path-param catalog. Samples must stay provider-agnostic and free of private
 * fleet/personal identifiers. Descriptions surface in Postman as first-class
 * variable docs.
 */
const PARAMS = {
  portal: {
    sentinel: "__PORTAL__",
    sample: "example-portal",
    description: "Portal slug for CAVI portal surfaces. Replace with a portal your gateway serves.",
  },
  teamId: {
    sentinel: "__TEAMID__",
    sample: "example-team",
    description: "Team id for gateway team routes.",
  },
  agentId: {
    sentinel: "__AGENTID__",
    sample: "example-agent",
    description: "Agent id within a team.",
  },
  taskId: {
    sentinel: "__TASKID__",
    sample: "task-1",
    description: "Operator / kanban task id.",
  },
  memberId: {
    sentinel: "__MEMBERID__",
    sample: "example-member",
    description: "Team member id.",
  },
  teamSlug: {
    sentinel: "__TEAMSLUG__",
    sample: "example-team",
    description: "URL slug for a team (often same as teamId).",
  },
  memoryKey: {
    sentinel: "__MEMORYKEY__",
    sample: "example-key",
    description: "Memory entry key for portal-memory surfaces.",
  },
  workspacePath: {
    sentinel: "__WORKSPACEPATH__",
    sample: "docs/readme.md",
    description: "Relative workspace file path (no leading slash).",
  },
  assetId: {
    sentinel: "__ASSETID__",
    sample: "asset-1",
    description: "Media asset id.",
  },
  jobId: {
    sentinel: "__JOBID__",
    sample: "job-1",
    description: "Async media / generation job id.",
  },
  vaultId: {
    sentinel: "__VAULTID__",
    sample: "vault-1",
    description: "Vault id.",
  },
  artifactId: {
    sentinel: "__ARTIFACTID__",
    sample: "artifact-1",
    description: "Artifact id within a vault or run.",
  },
  runId: {
    sentinel: "__RUNID__",
    sample: "run-1",
    description: "Agent run id.",
  },
  kind: {
    sentinel: "__KIND__",
    sample: "image",
    description: "Media kind query value (for example: image, audio, video).",
  },
  actionId: {
    sentinel: "__ACTIONID__",
    sample: "action-1",
    description: "Pending action id for approval flows.",
  },
  path: {
    sentinel: "__PATH__",
    sample: "notes/example.md",
    description: "Relative wiki / workspace path.",
  },
};

/** Names that must never appear as default samples (fleet / personal). */
const FORBIDDEN_SAMPLE_RE =
  /\b(?:martina|scout|angela|machine|trading|wu-tang|front-door|deb|tony|method-man|franco|mirza)\b/iu;

for (const [name, meta] of Object.entries(PARAMS)) {
  if (FORBIDDEN_SAMPLE_RE.test(meta.sample)) {
    throw new Error(`postman:generate — sample for ${name} is not agnostic: ${meta.sample}`);
  }
}

const SENTINEL_PARAMS = Object.fromEntries(
  Object.entries(PARAMS).map(([name, { sentinel }]) => [name, sentinel]),
);

const OWNER_BLURBS = {
  "extensions/cavi": "CAVI extension surfaces (cost, control adapters).",
  "extensions/cavi/discourse": "Task discourse threads for operator control.",
  "extensions/cavi/library": "Library clip / catalog surfaces.",
  "extensions/cavi/operator-control": "Operator control plane (tasks, memory, registry, status).",
  "extensions/cavi/portal": "Portal config and dashboard surfaces.",
  "extensions/cavi/portal-memory": "Portal-scoped memory surfaces.",
  "gateway/core contract": "Core gateway HTTP surfaces (auth proof, sessions, agents).",
  "gateway/media contract": "Gateway media generate / asset surfaces.",
  "gateway/team contract": "Team, member, and workspace surfaces.",
  "gateway/wiki contract": "Wiki read/write surfaces.",
  "providers/hermes": "Hermes-owned gateway plugin surfaces.",
  "providers/hermes (kanban plugin)": "Hermes kanban plugin surfaces.",
  "vault/gateway owner": "Vault surfaces owned by the gateway.",
};

function exampleBody(contract) {
  const key = contract.key;
  if (key.includes("tasks") && contract.method === "POST") {
    return '{\n  "title": "Example task",\n  "body": "Replace with your task payload."\n}';
  }
  if (key.includes("clip") && contract.method === "POST") {
    return '{\n  "url": "https://example.com/resource",\n  "title": "Example clip"\n}';
  }
  if (key.includes("config") && contract.method === "POST") {
    return '{\n  "patch": {}\n}';
  }
  if (key.includes("media") || key.includes("Image") || key.includes("Audio") || key.includes("Video") || key.includes("Music")) {
    return '{\n  "prompt": "Example generation prompt"\n}';
  }
  if (key.includes("wiki") && (contract.method === "PUT" || contract.method === "POST")) {
    return '{\n  "content": "# Example\\n\\nReplace with wiki markdown."\n}';
  }
  if (key.includes("kanban") && contract.method === "POST") {
    return '{\n  "title": "Example card",\n  "column": "backlog"\n}';
  }
  return '{\n  "example": true\n}';
}

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
  const degradationHint =
    contract.degradation === "hard"
      ? "This surface is **hard**: 404/5xx fail the collection run."
      : "This surface is **gap**: missing endpoints are reported as unproven and do not fail the run.";

  return {
    name: `${contract.key} — ${contract.method} ${template}`,
    request: {
      method: contract.method,
      header: [
        { key: "Accept", value: "application/json" },
        ...(hasBody ? [{ key: "Content-Type", value: "application/json" }] : []),
      ],
      ...(hasBody
        ? {
            body: {
              mode: "raw",
              raw: exampleBody(contract),
              options: { raw: { language: "json" } },
            },
          }
        : {}),
      url: { raw: rawUrl, host: ["{{baseUrl}}"], path: segments },
      description: [
        contract.note,
        "",
        degradationHint,
        "",
        `| | |`,
        `| --- | --- |`,
        `| Contract key | \`${contract.key}\` |`,
        `| Owner | \`${contract.owner}\` |`,
        `| Degradation | \`${contract.degradation}\` |`,
        "",
        "Auth: collection-level Bearer `{{token}}`. Override path params on the **environment** (preferred) or collection variables.",
      ].join("\n"),
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
    description: OWNER_BLURBS[owner] ?? `Surfaces owned by \`${owner}\`.`,
    item: requests.sort((a, b) => a.name.localeCompare(b.name)),
  }));

const collectionVariables = [
  {
    key: "baseUrl",
    value: "http://localhost:18789",
    type: "string",
    description:
      "Gateway origin only (scheme + host + port). No trailing slash. Prefer setting this on the environment.",
  },
  {
    key: "token",
    value: "",
    type: "string",
    description: "Bearer token for the gateway. Leave empty in git; set on the environment (secret).",
  },
  ...[...usedParams]
    .sort()
    .map((name) => ({
      key: name,
      value: PARAMS[name].sample,
      type: "string",
      description: PARAMS[name].description,
    })),
];

const collectionDescription = [
  "# @cavi-ai/api-client — gateway surface verification",
  "",
  "Generated from `SURFACE_CONTRACTS` + `CAVI_SURFACE_CONTRACTS`. **Do not hand-edit** this file.",
  "",
  "## Quick start",
  "",
  "1. Import `cavi-api-client.postman_collection.json` and `cavi-api-client.postman_environment.json`.",
  "2. Select the **cavi-api-client — local gateway** environment.",
  "3. Set `baseUrl` to your gateway origin and `token` to a bearer credential (environment only).",
  "4. Replace example path params (`example-team`, `example-portal`, …) with ids your backend knows.",
  "5. Run Collection.",
  "",
  "## Variables",
  "",
  "| Variable | Where to set | Purpose |",
  "| --- | --- | --- |",
  "| `baseUrl` | Environment | Gateway origin |",
  "| `token` | Environment (secret) | Bearer auth |",
  "| path params | Environment (override collection defaults) | Agnostic placeholders until you substitute real ids |",
  "",
  "Collection variables ship safe example defaults. **Environment values win** in Postman — keep secrets and host-specific ids there, never in the committed collection.",
  "",
  "## Degradation",
  "",
  "| Kind | Test behavior |",
  "| --- | --- |",
  "| `hard` | Fails on 404 or 5xx |",
  "| `gap` | Never fails; reports PROVEN (2xx) vs unproven |",
  "",
  "## Out of scope",
  "",
  "Claude / Codex / Gemini HTTP APIs are not included (separate hosts and auth). Use the package provider conformance tests for those.",
  "",
  "Regenerate: `pnpm run build && pnpm run postman:generate`",
].join("\n");

const collection = {
  info: {
    // eslint-disable-next-line camelcase
    _postman_id: "cavi-api-client-surfaces",
    name: "@cavi-ai/api-client — gateway surfaces",
    description: collectionDescription,
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}", type: "string" }] },
  variable: collectionVariables,
  item: items,
};

const environment = {
  id: "cavi-api-client-local",
  name: "cavi-api-client — local gateway",
  values: [
    {
      key: "baseUrl",
      value: "http://localhost:18789",
      enabled: true,
      type: "default",
      description: "Gateway origin (no trailing slash). Example OpenClaw/Hermes local port shown; change to match yours.",
    },
    {
      key: "token",
      value: "",
      enabled: true,
      type: "secret",
      description: "Bearer token. Never commit a real value.",
    },
    ...[...usedParams]
      .sort()
      .map((name) => ({
        key: name,
        value: PARAMS[name].sample,
        enabled: true,
        type: "default",
        description: PARAMS[name].description,
      })),
  ],
  // eslint-disable-next-line camelcase
  _postman_variable_scope: "environment",
};

const serializedEnv = JSON.stringify(environment);
if (FORBIDDEN_SAMPLE_RE.test(serializedEnv) || FORBIDDEN_SAMPLE_RE.test(JSON.stringify(collection))) {
  throw new Error("postman:generate — forbidden private/fleet identifier leaked into output");
}

const outArg = process.argv.indexOf("--out");
const collectionOut =
  outArg !== -1 && process.argv[outArg + 1]
    ? path.resolve(process.argv[outArg + 1])
    : path.join(ROOT, "docs", "postman", "cavi-api-client.postman_collection.json");
const envOut = path.join(path.dirname(collectionOut), "cavi-api-client.postman_environment.json");

await mkdir(path.dirname(collectionOut), { recursive: true });
await writeFile(collectionOut, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
await writeFile(envOut, `${JSON.stringify(environment, null, 2)}\n`, "utf8");

const total = items.reduce((n, f) => n + f.item.length, 0);
process.stderr.write(
  `postman:generate — ${total} requests in ${items.length} folders -> ${path.relative(ROOT, collectionOut)}\n` +
    `postman:generate — environment -> ${path.relative(ROOT, envOut)}\n`,
);
