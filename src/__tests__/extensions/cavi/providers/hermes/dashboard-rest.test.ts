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
      .mockResolvedValueOnce(json(fixture("session-delete")));
    const client = createHermesDashboardRestClient({
      baseUrl: "https://hermes.example/root/",
      authToken: null,
      fetchImpl,
    });

    await expect(client.listSessions()).resolves.toEqual(fixture("sessions"));
    await expect(client.getSession("session /?#")).resolves.toEqual(fixture("session-detail"));
    await expect(client.deleteSession("session /?#")).resolves.toEqual(fixture("session-delete"));

    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["https://hermes.example/root/api/sessions", "GET"],
      ["https://hermes.example/root/api/sessions/session%20%2F%3F%23", "GET"],
      ["https://hermes.example/root/api/sessions/session%20%2F%3F%23", "DELETE"],
    ]);
  });

  it("rejects blank ids but preserves nonblank opaque ids byte-for-byte before encoding", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(json(fixture("session-detail")));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl });
    expect(() => client.getSession("  ")).toThrow(/id is required/i);
    await client.getSession(" session-id ");
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("/api/sessions/%20session-id%20");
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

  it.each([
    ["session row", "sessions", { ...fixture("sessions") as object, sessions: [{}] }],
    ["negative total", "sessions", { ...fixture("sessions") as object, total: -1 }],
    ["fractional limit", "sessions", { ...fixture("sessions") as object, limit: 1.5 }],
    ["negative offset", "sessions", { ...fixture("sessions") as object, offset: -1 }],
    ["daily row", "usage", { ...fixture("analytics-usage") as object, daily: [{}] }],
    ["model row", "usage", { ...fixture("analytics-usage") as object, by_model: [{}] }],
    ["usage totals", "usage", { ...fixture("analytics-usage") as object, totals: {} }],
    ["skills summary", "usage", {
      ...fixture("analytics-usage") as object,
      skills: { summary: {}, top_skills: [] },
    }],
    ["model provider", "models", { providers: [{}], model: "m", provider: "p" }],
    ["model names", "models", {
      ...fixture("models") as object,
      providers: [{ ...(fixture("models") as { providers: object[] }).providers[0], models: [1] }],
    }],
    ["provider auth status", "auth", {
      providers: [{ id: "p", name: "P", flow: "pkce", cli_command: "x", docs_url: "x", status: {} }],
    }],
  ])("rejects malformed nested %s DTO fields", async (_name, operation, payload) => {
    const client = createHermesDashboardRestClient({
      baseUrl: "", authToken: null, fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(json(payload)),
    });
    const call = operation === "sessions" ? client.listSessions()
      : operation === "usage" ? client.getUsage()
      : operation === "models" ? client.getModels()
      : client.getProviderAuth();
    await expect(call).rejects.toThrow(/schema/i);
  });

  it("rejects prototype, class, inherited, and accessor-backed fallback values without invoking getters", async () => {
    let getterCalls = 0;
    const accessor = Object.defineProperty({}, "sessions", {
      enumerable: true,
      get() { getterCalls += 1; return []; },
    });
    class SessionsPayload {
      sessions: object[] = [];
      total = 0;
      limit = 20;
      offset = 0;
    }
    const inherited = Object.create({ sessions: [], total: 0, limit: 20, offset: 0 }) as object;
    const fallback = { request: vi.fn()
      .mockResolvedValueOnce(new SessionsPayload())
      .mockResolvedValueOnce(inherited)
      .mockResolvedValueOnce(accessor) };
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => new Response("missing", { status: 405 }));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl, fallback });
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
    expect(getterCalls).toBe(0);
  });

  it("strictly validates delete and recursively safe config/profile JSON objects", async () => {
    const validConfig = fixture("config");
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json(validConfig))
      .mockResolvedValueOnce(json({ display_name: "Fixture", preferences: { compact: true } }))
      .mockResolvedValueOnce(json({ ok: false }))
      .mockResolvedValueOnce(json({ deleted: true }))
      .mockResolvedValueOnce(json({ ok: true, extra: true }))
      .mockResolvedValueOnce(json([]))
      .mockResolvedValueOnce(new Response(`{"preferences":{"__proto__":{"polluted":true}}}`));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl });
    await expect(client.getConfig()).resolves.toEqual(validConfig);
    await expect(client.getProfile()).resolves.toEqual({ display_name: "Fixture", preferences: { compact: true } });
    await expect(client.deleteSession("one")).rejects.toThrow(/schema/i);
    await expect(client.deleteSession("one")).rejects.toThrow(/schema/i);
    await expect(client.deleteSession("one")).rejects.toThrow(/schema/i);
    await expect(client.getConfig()).rejects.toThrow(/schema/i);
    await expect(client.getProfile()).rejects.toThrow(/schema/i);

    const unsafe = Object.create(null) as Record<string, unknown>;
    unsafe.safe = Object.defineProperty({}, "secret", { get: () => "leak", enumerable: true });
    const fallback = { request: vi.fn().mockResolvedValue(unsafe) };
    const missing = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    const fallbackClient = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl: missing, fallback });
    await expect(fallbackClient.listSessions()).rejects.toThrow(/schema/i);
  });

  it("handles 405 fallback and fails closed for 500, pre-abort, fallback reject, and fallback abort", async () => {
    const fallback = { request: vi.fn()
      .mockResolvedValueOnce(fixture("sessions"))
      .mockRejectedValueOnce(new Error("fallback rejected"))
      .mockRejectedValueOnce(new DOMException("fallback stopped", "AbortError")) };
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("missing", { status: 405 }))
      .mockResolvedValueOnce(new Response("server", { status: 500 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }))
      .mockResolvedValueOnce(new Response("missing", { status: 404 }));
    const client = createHermesDashboardRestClient({ baseUrl: "", authToken: null, fetchImpl, fallback });
    await expect(client.listSessions()).resolves.toEqual(fixture("sessions"));
    await expect(client.listSessions()).rejects.toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(client.listSessions({ signal: controller.signal })).rejects.toThrow();
    await expect(client.listSessions()).rejects.toThrow("fallback rejected");
    await expect(client.listSessions()).rejects.toMatchObject({ name: "AbortError" });
    expect(fallback.request).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["nested accessor", () => {
      const payload = structuredClone(fixture("sessions")) as Record<string, unknown>;
      payload.unknown = Object.defineProperty({}, "secret", {
        enumerable: true,
        get() { throw new Error("unsafe getter was invoked"); },
      });
      return payload;
    }],
    ["nested class", () => {
      class UnknownMetadata { value = "unsafe"; }
      return { ...structuredClone(fixture("sessions")) as object, unknown: new UnknownMetadata() };
    }],
    ["nested cycle", () => {
      const cycle: Record<string, unknown> = {};
      cycle.self = cycle;
      return { ...structuredClone(fixture("sessions")) as object, unknown: cycle };
    }],
    ["array string property", () => {
      const payload = structuredClone(fixture("sessions")) as { sessions: unknown[] };
      Object.defineProperty(payload.sessions, "extra", { value: true, enumerable: true });
      return payload;
    }],
    ["array symbol property", () => {
      const payload = structuredClone(fixture("sessions")) as { sessions: unknown[] };
      Object.defineProperty(payload.sessions, Symbol("extra"), { value: true, enumerable: true });
      return payload;
    }],
    ["array accessor property", () => {
      const payload = structuredClone(fixture("sessions")) as { sessions: unknown[] };
      Object.defineProperty(payload.sessions, "extra", {
        enumerable: true,
        get() { throw new Error("unsafe array getter was invoked"); },
      });
      return payload;
    }],
    ["array cycle", () => {
      const cycle: unknown[] = [];
      cycle.push(cycle);
      return { ...structuredClone(fixture("sessions")) as object, unknown: cycle };
    }],
  ])("rejects otherwise valid plugin fallback DTOs with unsafe %s augmentation", async (_name, makePayload) => {
    const fallback = { request: vi.fn().mockResolvedValue(makePayload()) };
    const client = createHermesDashboardRestClient({
      baseUrl: "",
      authToken: null,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 })),
      fallback,
    });
    await expect(client.listSessions()).rejects.toThrow(/schema/i);
  });

  it("preserves recursively safe unknown upstream fields", async () => {
    const payload = {
      ...structuredClone(fixture("sessions")) as object,
      upstream_extension: { enabled: true, labels: ["one", null, 2] },
    };
    const fallback = { request: vi.fn().mockResolvedValue(payload) };
    const client = createHermesDashboardRestClient({
      baseUrl: "",
      authToken: null,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 })),
      fallback,
    });
    await expect(client.listSessions()).resolves.toBe(payload);
  });
});
