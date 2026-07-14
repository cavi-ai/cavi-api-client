import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  HERMES_DASHBOARD_REST_FALLBACKS,
  createHermesDashboardRestClient,
} from "../../../../../extensions/cavi/providers/hermes/dashboard-rest.js";

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(fileURLToPath(
    new URL(`../../../../fixtures/hermes/dashboard/rest/${name}.json`, import.meta.url),
  ), "utf8")) as unknown;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Hermes dashboard REST client", () => {
  it("uses the exact session methods, encoded paths, and joined base URL", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(fixture("sessions")))
      .mockResolvedValueOnce(json(fixture("session-detail")))
      .mockResolvedValueOnce(json({ deleted: true }));
    const client = createHermesDashboardRestClient({
      baseUrl: "https://hermes.example/root/",
      authToken: null,
      fetchImpl,
    });

    await expect(client.listSessions()).resolves.toEqual(fixture("sessions"));
    await expect(client.getSession("session /?#")).resolves.toEqual(fixture("session-detail"));
    await expect(client.deleteSession("session /?#")).resolves.toEqual({ deleted: true });

    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["https://hermes.example/root/api/sessions", "GET"],
      ["https://hermes.example/root/api/sessions/session%20%2F%3F%23", "GET"],
      ["https://hermes.example/root/api/sessions/session%20%2F%3F%23", "DELETE"],
    ]);
  });

  it("uses exact GET routes and validates upstream analytics, models, and auth fixtures", async () => {
    const responses = [
      fixture("analytics-usage"), fixture("models"), fixture("provider-auth"),
      { name: "Fixture User" }, { theme: "dark" },
    ];
    const fetchImpl = vi.fn<typeof fetch>();
    for (const response of responses) fetchImpl.mockResolvedValueOnce(json(response));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl });

    await expect(client.getUsage()).resolves.toEqual(responses[0]);
    await expect(client.getModels()).resolves.toEqual(responses[1]);
    await expect(client.getProviderAuth()).resolves.toEqual(responses[2]);
    await expect(client.getProfile()).resolves.toEqual(responses[3]);
    await expect(client.getConfig()).resolves.toEqual(responses[4]);
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/analytics/usage", "GET"],
      ["/api/models", "GET"],
      ["/api/provider-auth", "GET"],
      ["/api/profile", "GET"],
      ["/api/config", "GET"],
    ]);
  });

  it("gives resolved credential headers precedence over bearer and default headers", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(fixture("models")));
    const client = createHermesDashboardRestClient({
      baseUrl: "https://hermes.example",
      authToken: "bearer-secret",
      defaultHeaders: { Authorization: "Default secret", "X-Default": "yes" },
      resolveAuthHeaders: () => ({ Authorization: "Session session-secret", "X-Auth": "yes" }),
      fetchImpl,
    });
    await client.getModels();
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Session session-secret",
      "X-Auth": "yes",
      "X-Default": "yes",
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).not.toHaveProperty("X-Portal-Client-Id");
  });

  it("forwards abort without wrapping or falling back", async () => {
    const fallback = { request: vi.fn() };
    const fetchImpl = vi.fn<typeof fetch>(async (_url, init) => await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl, fallback });
    const controller = new AbortController();
    const pending = client.listSessions({ signal: controller.signal });
    controller.abort(new DOMException("stopped", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "HttpApiError", status: 0 });
    expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    expect(fallback.request).not.toHaveBeenCalled();
  });

  it("rejects non-2xx, malformed JSON, and schema-invalid success without empty success", async () => {
    const hugeSecret = `token=${"x".repeat(2_000)}`;
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: hugeSecret }), { status: 500 }))
      .mockResolvedValueOnce(new Response(`{"token":"json-secret","padding":"${"y".repeat(2_000)}"`))
      .mockResolvedValueOnce(json(fixture("malformed")));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl });

    for (const operation of [() => client.getModels(), () => client.listSessions(), () => client.listSessions()]) {
      const error = await operation().catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain("x".repeat(20));
      expect(JSON.stringify(error)).not.toMatch(/json-secret|y{20}/u);
      expect(String(error).length).toBeLessThan(800);
    }
  });

  it("falls back only for explicitly equivalent list and usage operations", async () => {
    expect(HERMES_DASHBOARD_REST_FALLBACKS).toEqual({
      listSessions: "session.list",
      getUsage: "session.usage",
    });
    const fallback = { request: vi.fn()
      .mockResolvedValueOnce(fixture("sessions"))
      .mockResolvedValueOnce(fixture("analytics-usage")) };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response("missing", { status: 404 }));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl, fallback });
    await expect(client.listSessions()).resolves.toEqual(fixture("sessions"));
    await expect(client.getUsage()).resolves.toEqual(fixture("analytics-usage"));
    await expect(client.deleteSession("one")).rejects.toThrow();
    expect(fallback.request.mock.calls).toEqual([
      ["session.list", undefined, undefined],
      ["session.usage", undefined, undefined],
    ]);
  });

  it("never falls back for auth failures, malformed/schema responses, or invalid fallback data", async () => {
    const fallback = { request: vi.fn().mockResolvedValue(fixture("malformed")) };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unauthorized", { status: 401 }))
      .mockResolvedValueOnce(json(fixture("malformed")))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl, fallback });
    await expect(client.listSessions()).rejects.toThrow();
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
    expect(fallback.request).toHaveBeenCalledTimes(1);
  });
});
