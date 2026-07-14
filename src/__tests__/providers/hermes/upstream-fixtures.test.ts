import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

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

describe("sanitized Hermes upstream fixtures", () => {
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
    const corpus = (await Promise.all(paths.map(readFixture))).join("\n");
    expect(corpus).not.toMatch(/\/(?:Users|Volumes|home)\//);
    expect(corpus).not.toMatch(/Bearer\s|token=|api[_-]?key/i);
    expect(corpus).not.toMatch(/sk-[A-Za-z0-9_-]{16,}/);
  });
});
