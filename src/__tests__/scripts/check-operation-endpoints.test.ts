import { describe, expect, it } from "vitest";
import * as openCodePaths from "../../providers/opencode/paths";
import {
  extractHttpPaths,
  findOrphanPaths,
  isKnownPath,
  extractHttpOperations,
  extractSourceHttpOperations,
  findUnknownOperations,
} from "../../../scripts/docs/check-operation-endpoints.mjs";

describe("extractHttpPaths", () => {
  it("pulls path tokens from an HTTP line, ignoring provider labels and n/a", () => {
    const md = "**HTTP** `POST /v1/messages` (Claude) · `n/a (client-side)`\n";
    expect(extractHttpPaths(md)).toEqual(["/v1/messages"]);
  });

  it("reduces dynamic segments to their static prefix", () => {
    const md = "**HTTP** `GET /v1/batches/:id/output`\n";
    expect(extractHttpPaths(md)).toEqual(["/v1/batches"]);
  });

  it("checks routes on wrapped HTTP lines", () => {
    expect(extractHttpPaths("**HTTP** `POST /v1/batches` ·\n`GET /v1/files/:id/content`\n**Capability** `supports.batch`\n")).toEqual(["/v1/batches", "/v1/files"]);
  });
});

describe("exact provider operations", () => {
  const routes = {
    API: { responses: "/v1/responses", batches: "/v1/batches" },
    responsePath: (id: string) => `/v1/responses/${encodeURIComponent(id)}`,
    cancelPath: (id: string) => `/v1/responses/${encodeURIComponent(id)}/cancel`,
  };
  const source = `
    import { API, responsePath as getPath, cancelPath } from "./paths.js";
    class Client {
      start() { return this.request(API.responses, { method: "POST" }); }
      get(id) { return this.request(getPath(id)); }
      cancel(id) { return this.requestRaw(cancelPath(id), { method: "POST" }); }
    }
  `;

  it("retains verbs and full dynamic suffixes across multiline HTTP blocks", () => {
    expect(extractHttpOperations("**HTTP** `POST /v1/responses` ·\n`POST /v1/responses/:id/cancel`\n**Capability** `supports.runs`\n\n`GET /not-an-endpoint`"))
      .toEqual([{ method: "POST", path: "/v1/responses" }, { method: "POST", path: "/v1/responses/:id/cancel" }]);
  });

  it("rejects wrong verbs, suffixes, and routes owned only by another provider", () => {
    const known = extractSourceHttpOperations(source, routes);
    const unknown = extractHttpOperations("**HTTP** `DELETE /v1/responses/:id` · `POST /v1/responses/:id/ghost` · `GET /v1/batches/:id`");
    expect(findUnknownOperations(unknown, known)).toEqual(unknown);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `POST /v1/responses` · `GET /v1/responses/:responseId` · `POST /v1/responses/:runId/cancel`"), known)).toEqual([]);
  });

  it("does not match routes mentioned only in comments, strings, or request bodies", () => {
    const decoys = source + `// GET /v1/batches/:id\n const note = "DELETE /v1/responses";
      this.request(API.responses, { method: "POST", body: { endpoint: API.batches } });`;
    const unknown = extractHttpOperations("**HTTP** `GET /v1/batches/:id` · `POST /v1/batches` · `DELETE /v1/responses`");
    expect(findUnknownOperations(unknown, extractSourceHttpOperations(decoys, routes))).toEqual(unknown);
  });

  it("resolves local query wrappers within each method's lexical scope", () => {
    const scoped = `import { API, responsePath } from "./paths.js";
      import { appendHttpQuery } from "../../contracts/paths.js";
      class Client {
        get(id) { const path = appendHttpQuery(responsePath(id), {}); return this.request(path); }
        list() { const path = include ? appendHttpQuery(API.batches, {}) : API.batches; return this.request(path); }
      }`;
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /v1/responses/:id` · `GET /v1/batches`"), extractSourceHttpOperations(scoped, routes))).toEqual([]);
  });

  it("does not erase version, action, or static route differences", () => {
    const versionedRoutes = { generatePath: (id: string) => `/v1beta/models/${id}:generateContent` };
    const known = extractSourceHttpOperations('import { generatePath } from "./paths.js"; this.request(generatePath(model), { method: "POST" });', versionedRoutes);
    const wrong = extractHttpOperations("**HTTP** `POST /v2/models/:model:generateContent` · `POST /v1beta/:model:generateContent` · `POST /v1beta/models/:model:streamGenerateContent`");
    expect(findUnknownOperations(wrong, known)).toEqual(wrong);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `POST /v1beta/models/:model:generateContent`"), known)).toEqual([]);
  });

  it("accepts signal-only option spreads and rejects ambiguous method overrides", () => {
    const safe = 'import { API } from "./paths.js"; this.requestRaw(API.responses, { method: "GET", ...(signal ? { signal } : {}) });';
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /v1/responses`"), extractSourceHttpOperations(safe, routes))).toEqual([]);
    const unsafe = 'import { API } from "./paths.js"; this.request(API.responses, { method: "GET", ...options });';
    expect(() => extractSourceHttpOperations(unsafe, routes)).toThrow("unresolved HTTP options");
  });

  it("checks scoped OpenCode routes with its validating path helpers", () => {
    const source = `import { opencodeSessionAbortPath } from "./paths.js";
      this.requestChecked(opencodeSessionAbortPath(this.scope, runId), { method: "POST" });`;
    const known = extractSourceHttpOperations(source, openCodePaths);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `POST /session/:id/abort`"), known)).toEqual([]);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /session/:id/abort`"), known)).toHaveLength(1);
  });

  it("ignores HTTP markers inside code fences and rejects malformed declarations", () => {
    expect(extractHttpOperations("```md\n**HTTP** `POST /ghost`\n```\n**HTTP** `GET /v1/responses/:id`")).toEqual([{ method: "GET", path: "/v1/responses/:id" }]);
    expect(() => extractHttpOperations("**HTTP** `get /v1/responses`")).toThrow("malformed HTTP operation");
  });

  it("uses the effective method and rejects computed option keys", () => {
    const known = extractSourceHttpOperations(`import { API } from "./paths.js";
      const method = "POST";
      this.request(API.responses, { method });
      this.request(API.batches, { method: "GET", method: "DELETE" });`, routes);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `POST /v1/responses` · `DELETE /v1/batches`"), known)).toEqual([]);
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /v1/batches`"), known)).toHaveLength(1);
    expect(() => extractSourceHttpOperations('import { API } from "./paths.js"; this.request(API.responses, { [key]: "POST" });', routes)).toThrow("unresolved HTTP options");
  });

  it("does not mistake shadowed locals or parameters for imported route constants", () => {
    const shadowed = `import { API } from "./paths.js";
      class Client {
        one() { const API = { responses: "/other" }; return this.request(API.responses); }
        two(API) { return this.request(API.responses); }
      }`;
    expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /v1/responses`"), extractSourceHttpOperations(shadowed, routes))).toHaveLength(1);
  });
});

it("checks body-consuming requests against their owning route and method", () => {
  const routes = { API: { files: "/v1/files" } };
  const source = 'import { API } from "./paths.js"; this.requestWithResponse(API.files, { method: "POST" }, response => response.json());';
  const known = extractSourceHttpOperations(source, routes);
  expect(findUnknownOperations(extractHttpOperations("**HTTP** `POST /v1/files`"), known)).toEqual([]);
  expect(findUnknownOperations(extractHttpOperations("**HTTP** `GET /v1/files`"), known)).toHaveLength(1);
});

describe("findOrphanPaths", () => {
  it("flags a path absent from the owner literal corpus", () => {
    const corpus = '"/v1/messages" "/v1/batches"';
    expect(findOrphanPaths(["/v1/messages", "/v1/ghost"], corpus)).toEqual([
      "/v1/ghost",
    ]);
  });

  it("returns empty when every path is present", () => {
    const corpus = '"/v1/messages"';
    expect(findOrphanPaths(["/v1/messages"], corpus)).toEqual([]);
  });

  it("accepts a version-prefixed assembled path via its version-stripped remainder", () => {
    // A versioned provider builds `/${API_VERSION}/models/...`, so `/v1beta/models` is
    // not a contiguous literal but `/models` is.
    const corpus = 'const API_VERSION = "v1beta"; `/models/${x}:generateContent`';
    expect(isKnownPath("/v1beta/models", corpus)).toBe(true);
    expect(findOrphanPaths(["/v1beta/models"], corpus)).toEqual([]);
  });

  it("still flags a version-prefixed path whose remainder is absent", () => {
    const corpus = '`/models/${x}`';
    expect(isKnownPath("/v1beta/wombat", corpus)).toBe(false);
    expect(findOrphanPaths(["/v1beta/wombat"], corpus)).toEqual(["/v1beta/wombat"]);
  });
});
