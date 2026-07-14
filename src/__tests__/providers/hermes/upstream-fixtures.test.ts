import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSensitiveKey } from "../../../core/http/redaction.js";

const fixtureRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../fixtures/hermes",
);

async function fixtureNames(): Promise<string[]> {
  const inventory = async (directory = ""): Promise<string[]> => {
    const entries = await readdir(join(fixtureRoot, directory), { withFileTypes: true });
    return (await Promise.all(entries.map(async (entry) => {
      const relative = join(directory, entry.name);
      return entry.isDirectory() ? inventory(relative) : [relative];
    }))).flat().sort();
  };
  return inventory();
}

async function readFixture(path: string): Promise<string> {
  return readFile(join(fixtureRoot, path), "utf8");
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFixture(path)) as Record<string, unknown>;
}

const credentialTextPatterns = [
  ["authorization", /\bauthorization\s*[:=]\s*(?:bearer\s+)?[A-Za-z0-9._~+/=-]{8,}/iu],
  ["password", /\b(?:password|passwd|pwd)\s*[:=]\s*[^\s"']{6,}/iu],
  ["client_secret", /\bclient[_-]?secret\s*[:=]\s*[^\s"']{6,}/iu],
  ["cookie", /\b(?:set-cookie|cookie)\s*[:=]\s*[^\s"']{6,}/iu],
  ["api-key", /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*[^\s"']{6,}/iu],
  ["private-key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ["provider-key", /\bsk-[A-Za-z0-9_-]{16,}\b/u],
  ["jwt", /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u],
] as const;

function credentialLeakPaths(path: string, text: string): string[] {
  const leaks: string[] = [];
  if (path.endsWith(".json")) {
    const visit = (value: unknown, location = ""): void => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
        return;
      }
      if (value === null || typeof value !== "object") return;
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        const child = location.length === 0 ? key : `${location}.${key}`;
        const schemaOnly = /^(?:has[_-]|is[_-])|(?:[_-](?:scheme|policy|count|present))$/iu.test(key);
        if (isSensitiveKey(key) && !schemaOnly && typeof entry === "string"
          && entry.length > 0 && entry !== "[REDACTED]") leaks.push(child);
        visit(entry, child);
      }
    };
    visit(JSON.parse(text) as unknown);
  }
  for (const [label, pattern] of credentialTextPatterns) {
    if (pattern.test(text)) leaks.push(`text:${label}`);
  }
  return [...new Set(leaks)];
}

describe("sanitized Hermes upstream fixtures", () => {
  it("detects structured and textual credentials without flagging schema vocabulary", () => {
    expect(credentialLeakPaths("fixture.json", JSON.stringify({
      auth: { client_secret: "hunter2", nested: [{ session_token: "opaque" }] },
    }))).toEqual(["auth.client_secret", "auth.nested[0].session_token"]);
    expect(credentialLeakPaths("fixture.txt", [
      "Authorization: Bearer abc.def.ghi",
      "password=hunter2",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature",
    ].join("\n"))).toEqual(expect.arrayContaining(["text:authorization", "text:password", "text:jwt"]));
    expect(credentialLeakPaths("schema.json", JSON.stringify({
      session: { id: "session-1" },
      total_tokens: 150,
      has_refresh_token: false,
      authorization_scheme: "Bearer",
      cookie_policy: "same-site",
    }))).toEqual([]);
  });

  it("includes every required protocol fixture", async () => {
    await expect(fixtureNames()).resolves.toEqual(
      expect.arrayContaining([
        "dashboard/json-rpc/session-list-request.json",
        "dashboard/json-rpc/session-list-result.json",
        "dashboard/json-rpc/session-usage-result.json",
        "dashboard/json-rpc/session-interrupt-result.json",
        "dashboard/json-rpc/error-response.json",
        "dashboard/json-rpc/event-notification.json",
        "dashboard/rest/sessions.json",
        "dashboard/rest/session-detail.json",
        "dashboard/rest/session-delete.json",
        "dashboard/rest/analytics-usage.json",
        "dashboard/rest/config.json",
        "dashboard/rest/models.json",
        "dashboard/rest/provider-auth.json",
        "dashboard/rest/malformed.json",
        "runtime/events/run-events.txt",
      ]),
    );
  });

  it("parses JSON fixtures and preserves authoritative envelope shapes", async () => {
    const request = await readJson("dashboard/json-rpc/session-list-request.json");
    expect(request).toEqual({
      jsonrpc: "2.0",
      id: "rpc-001",
      method: "session.list",
      params: { limit: 20 },
    });

    const list = await readJson("dashboard/json-rpc/session-list-result.json");
    expect(list).toMatchObject({ jsonrpc: "2.0", id: "rpc-001" });
    expect((list.result as { sessions: unknown[] }).sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          title: expect.any(String),
          preview: expect.any(String),
          source: expect.any(String),
        }),
      ]),
    );

    const usage = await readJson("dashboard/json-rpc/session-usage-result.json");
    expect(usage).toMatchObject({
      jsonrpc: "2.0",
      result: { calls: 2, input: 120, output: 30, total: 150 },
    });

    const interrupt = await readJson(
      "dashboard/json-rpc/session-interrupt-result.json",
    );
    expect(interrupt).toMatchObject({
      jsonrpc: "2.0",
      result: { status: "interrupted" },
    });

    const error = await readJson("dashboard/json-rpc/error-response.json");
    expect(error).toMatchObject({
      jsonrpc: "2.0",
      error: { code: -32601, message: expect.any(String) },
    });

    const event = await readJson("dashboard/json-rpc/event-notification.json");
    expect(event).toEqual({
      jsonrpc: "2.0",
      method: "event",
      params: {
        type: "gateway.ready",
        payload: { skin: "hermes" },
      },
    });
  });

  it("preserves dashboard REST response structures and a malformed payload", async () => {
    const sessions = await readJson("dashboard/rest/sessions.json");
    expect(sessions).toMatchObject({
      sessions: expect.any(Array),
      total: expect.any(Number),
      limit: expect.any(Number),
      offset: expect.any(Number),
    });

    const detail = await readJson("dashboard/rest/session-detail.json");
    expect(detail).toMatchObject({
      id: expect.any(String),
      source: expect.any(String),
      model: expect.any(String),
    });

    await expect(readJson("dashboard/rest/session-delete.json")).resolves.toEqual({ ok: true });
    await expect(readJson("dashboard/rest/config.json")).resolves.toMatchObject({
      model: expect.any(String),
      model_context_length: expect.any(Number),
      toolsets: expect.any(Array),
    });

    const analytics = await readJson("dashboard/rest/analytics-usage.json");
    expect(analytics).toMatchObject({
      daily: expect.any(Array),
      by_model: expect.any(Array),
      totals: expect.any(Object),
      period_days: expect.any(Number),
      skills: expect.any(Object),
    });

    const models = await readJson("dashboard/rest/models.json");
    expect(models).toMatchObject({ providers: expect.any(Array) });

    const auth = await readJson("dashboard/rest/provider-auth.json");
    expect(auth).toMatchObject({ providers: expect.any(Array) });
    const provider = (auth.providers as Array<Record<string, unknown>>)[0];
    expect(provider).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      flow: expect.any(String),
      status: expect.objectContaining({ logged_in: expect.any(Boolean) }),
    });

    const malformed = await readJson("dashboard/rest/malformed.json");
    expect(malformed).toEqual({ sessions: "not-an-array" });
  });

  it("parses each data frame in the run SSE fixture", async () => {
    const stream = await readFixture("runtime/events/run-events.txt");
    const dataFrames = stream
      .split("\n\n")
      .filter((frame) => frame.startsWith("data: "))
      .map((frame) => JSON.parse(frame.slice("data: ".length)) as Record<string, unknown>);

    expect(dataFrames.map((frame) => frame.event)).toEqual([
      "message.delta",
      "tool.started",
      "tool.completed",
      "run.completed",
    ]);
    for (const frame of dataFrames) {
      expect(frame).toMatchObject({
        event: expect.any(String),
        run_id: "run_fixture_001",
        timestamp: expect.any(Number),
      });
    }
    expect(stream).toContain(": stream closed\n");
  });

  it("documents exact upstream source and commit for every fixture", async () => {
    const readme = await readFixture("README.md");
    const names = (await fixtureNames()).filter((name) => name !== "README.md");
    for (const path of names) {
      const name = path.split("/").at(-1)!;
      expect(readme).toContain(`\`${name}\``);
      const row = readme.split("\n").find((line) => line.includes(`\`${name}\``));
      expect(row).toContain("de1950c24b214d0127dc72eeb73fdcd90d841d14");
      expect(row).toMatch(/`(?:tui_gateway|hermes_cli|gateway)\/[\w./-]+`/);
    }
  });

  it("contains no host paths or credential material", async () => {
    const paths = await fixtureNames();
    const contents = await Promise.all(paths.map(async (path) => [path, await readFixture(path)] as const));
    const corpus = contents.map(([, content]) => content).join("\n");
    expect(corpus).not.toMatch(/\/(?:Users|Volumes|home)\//);
    expect(contents.flatMap(([path, content]) => credentialLeakPaths(path, content))).toEqual([]);
  });
});
