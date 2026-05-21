import { afterEach, describe, expect, it, vi } from "vitest";
import { BaseHttpApiClient } from "./core/http/client";
import { resolveHttpApiConfigFromEnv } from "./core/env/config";
import { resolveHermesHttpApiConfigFromEnv } from "./providers/hermes/env-config";
import {
  appendHttpQuery,
  CAVI_CONTROL_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  LIBRARY_API_ENDPOINTS,
  OPERATOR_DISPATCH_ENDPOINTS,
  resolveLibraryApiPath,
} from "./contracts/paths";
import {
  GatewayApiClient,
  MOBILE_GATEWAY_ENDPOINT_CONTRACTS,
  PORTAL_DASHBOARD_IDS,
  createContractGap,
  getMobileGatewayEndpointPath,
  portalDashboardPath,
  resolveOperatorTaskDispatchPath,
  SURFACE_CONTRACTS,
  resolvePath,
} from "./index";
import { LibraryApiClient } from "./cavi/library/client";
import type { HttpApiClientOptions, HttpApiRequestInit } from "./core/http/types";

class TestApiClient extends BaseHttpApiClient {
  constructor(options: HttpApiClientOptions) {
    super("test-api", options);
  }

  get<T = unknown>(path: string, init?: HttpApiRequestInit): Promise<T> {
    return this.requestJson<T>(path, init);
  }
}

class HeaderOverrideClient extends TestApiClient {
  protected override buildHeaders(init?: HttpApiRequestInit): Record<string, string> {
    return { ...super.buildHeaders(init), "X-Override": "yes" };
  }
}

describe("agnostic HTTP API client package", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves canonical env values before aliases and falls back library config to CAVI", () => {
    const config = resolveHttpApiConfigFromEnv({
      CAVI_API_BASE_URL: " https://canonical.example ",
      EXPO_PUBLIC_CAVI_API_BASE_URL: "https://alias.example",
      CAVI_API_AUTH_TOKEN: " token-value ",
      CAVI_API_CLIENT_ID: " cavi-client ",
      GATEWAY_API_BASE_URL: "https://gateway.example",
    });

    expect(config.cavi).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
    expect(config.gateway).toEqual({
      baseUrl: "https://gateway.example",
      authToken: null,
      clientId: "cavi-api-client",
    });
    expect(config.library).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
  });

  it("keeps Hermes env compatibility behind the Hermes provider resolver", () => {
    const config = resolveHermesHttpApiConfigFromEnv({
      HERMES_API_BASE_URL: " https://hermes.example ",
      EXPO_PUBLIC_HERMES_API_BASE_URL: "https://alias.example",
      HERMES_API_AUTH_TOKEN: " hermes-token ",
      HERMES_API_CLIENT_ID: " hermes-client ",
    });

    expect(config).toEqual({
      baseUrl: "https://hermes.example",
      authToken: "hermes-token",
      clientId: "hermes-client",
    });
  });

  it("keeps extracted endpoint builders encoded and aligned", () => {
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.root).toBe(
      "/cavi-control/api/operator",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.task("task/a b")).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.operator.taskDiscourse("task/a b")).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b/discourse",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.portals.martina.artifactPreview("docs", "a b.md")).toBe(
      "/martina/api/artifacts/docs/a%20b.md/preview",
    );
    expect(HERMES_API_ENDPOINTS.runApproval("run/1")).toBe("/v1/runs/run%2F1/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.runApproval).toBe("/v1/runs/{run_id}/approval");
    expect(HERMES_API_ENDPOINT_TEMPLATES.ecgSharedFiles).toBe("/api/v1/files?agent={agent}&folder={folder}");
    expect(OPERATOR_DISPATCH_ENDPOINTS.operatorEvents).toBe("/operator/events");
    expect(OPERATOR_DISPATCH_ENDPOINTS.taskReceiptsTemplate).toBe(
      "/cavi-control/api/tasks/{taskId}/receipts",
    );
    expect(LIBRARY_API_ENDPOINTS.document("doc/1")).toBe("/library/api/documents/doc%2F1");
    expect(LIBRARY_API_ENDPOINTS.fleetStatus).toBe("/library/api/fleet-status");
    expect(LIBRARY_API_ENDPOINTS.status).toBe("/library/api/status");
    expect(LIBRARY_API_ENDPOINTS.inbox).toBe("/library/api/inbox");
    expect(LIBRARY_API_ENDPOINTS.promotable).toBe("/library/api/promotable");
    expect(LIBRARY_API_ENDPOINTS.reviewRequests).toBe("/library/api/review-requests");
    expect(resolveLibraryApiPath("search")).toBe("/library/api/search");
    expect(resolveLibraryApiPath("/library/api/search")).toBe("/library/api/search");
    expect(appendHttpQuery("/library/api/search", { q: "top 10", page: 2, skip: undefined })).toBe(
      "/library/api/search?q=top+10&page=2",
    );
  });

  it("resolves surface paths in legacy and canonical modes", () => {
    expect(SURFACE_CONTRACTS["portal.dashboard"]?.method).toBe("GET");
    expect(resolvePath("portal.dashboard", "legacy", { portal: "martina" })).toBe(
      "/martina/api/dashboard",
    );
    expect(resolvePath("portal.dashboard", "canonical", { portal: "martina" })).toBe(
      "/api/plugins/portal/martina/dashboard",
    );
    expect(resolvePath("machine.media", "legacy", { filename: "a/b c.png" })).toBe(
      "/machine/api/media?name=a%2Fb%20c.png",
    );
    expect(resolvePath("cavi.deb.root", "legacy")).toBe("/cavi-control/api/deb");
    expect(resolvePath("cavi.deb.profile", "canonical")).toBe("/api/plugins/cavi-control/deb/profile");
    expect(resolvePath("cavi.deb.sprint", "legacy")).toBe("/cavi-control/api/deb/sprint");
    expect(resolvePath("cavi.deb.backlog", "canonical")).toBe("/api/plugins/cavi-control/deb/backlog");
    expect(resolvePath("cavi.deb.call", "canonical")).toBe("/api/plugins/cavi-control/deb/call");
    expect(resolvePath("cavi.operator.registry", "legacy")).toBe(
      "/cavi-control/api/operator/registry",
    );
    expect(resolvePath("cavi.operator.snapshot", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/snapshot",
    );
    expect(resolvePath("kanban.board", "canonical")).toBe("/api/plugins/kanban/board");
    expect(resolvePath("cavi.operator.memory", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/memory",
    );
    expect(resolvePath("cavi.operator.workerReady", "legacy")).toBe(
      "/cavi-control/api/operator/worker/ready",
    );
    expect(resolvePath("cavi.operator.workerTasks", "canonical")).toBe(
      "/api/plugins/cavi-control/operator/worker/tasks",
    );
    expect(resolvePath("cavi.operator.task", "legacy", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(resolvePath("cavi.operator.taskDiscourse", "canonical", { taskId: "task/a b" })).toBe(
      "/api/plugins/cavi-control/operator/tasks/task%2Fa%20b/discourse",
    );

    expect(SURFACE_CONTRACTS["frontDoor.ideaList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.ideaCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.ideaDetail"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.ideaPatch"]?.method).toBe("PATCH");
    expect(SURFACE_CONTRACTS["frontDoor.ideaPromote"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.projectList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.projectDetail"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.articleList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.articleCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.memoryList"]?.method).toBe("GET");
    expect(SURFACE_CONTRACTS["frontDoor.memoryCreate"]?.method).toBe("POST");
    expect(SURFACE_CONTRACTS["frontDoor.inboxUpload"]?.method).toBe("POST");

    expect(resolvePath("frontDoor.ideaList", "canonical")).toBe("/api/plugins/front-door/ideas");
    expect(resolvePath("frontDoor.ideaDetail", "canonical", { id: "idea/a b" })).toBe(
      "/api/plugins/front-door/ideas/idea%2Fa%20b",
    );
    expect(resolvePath("frontDoor.projectDetail", "legacy", { id: "proj/a b" })).toBe(
      "/front-door/api/projects/proj%2Fa%20b",
    );
    expect(resolvePath("frontDoor.articleList", "legacy")).toBe("/front-door/api/articles");
    expect(resolvePath("frontDoor.memoryList", "canonical")).toBe("/api/plugins/front-door/memory");
    expect(resolvePath("frontDoor.inboxUpload", "legacy")).toBe("/front-door/api/inbox");

    expect(resolvePath("trading.dashboard", "legacy")).toBe("/trading/api/dashboard");
    expect(resolvePath("trading.dashboard", "canonical")).toBe("/api/plugins/trading/dashboard");
    expect(resolvePath("trading.researchPackets", "legacy")).toBe("/trading/api/research-packets");
    expect(resolvePath("trading.researchPackets", "canonical")).toBe("/api/plugins/trading/research-packets");
    expect(resolvePath("trading.sourceRegistry", "legacy")).toBe("/trading/api/source-registry");
    expect(resolvePath("trading.sourceRegistry", "canonical")).toBe("/api/plugins/trading/source-registry");
  });

  it("keeps mobile portal/workspace contracts in the shared package", () => {
    expect(PORTAL_DASHBOARD_IDS).toEqual(["martina", "scout", "angela", "machine"]);
    expect(portalDashboardPath("martina")).toBe("/martina/api/dashboard");
    expect(portalDashboardPath("martina", "canonical")).toBe(
      "/api/plugins/portal/martina/dashboard",
    );
    for (const portal of PORTAL_DASHBOARD_IDS) {
      expect(portalDashboardPath(portal, "canonical")).toBe(
        `/api/plugins/portal/${portal}/dashboard`,
      );
    }
    expect(portalDashboardPath("front-door")).toBeNull();

    expect(getMobileGatewayEndpointPath("preflightCapabilities", "canonical")).toBe(
      "/v1/capabilities",
    );
    expect(getMobileGatewayEndpointPath("operatorTaskDispatch", "legacy")).toBe(
      "/cavi-control/api/operator/tasks",
    );
    expect(getMobileGatewayEndpointPath("operatorTaskDispatch", "canonical")).toBe(
      "/api/plugins/kanban/tasks",
    );
    expect(resolveOperatorTaskDispatchPath("kanban-native")).toBe("/api/plugins/kanban/tasks");
    expect(MOBILE_GATEWAY_ENDPOINT_CONTRACTS.machineComedyRun.hermesPath).toBe("/v1/runs");
    expect(createContractGap("preflightCapabilities", "missing auth")).toEqual({
      area: "preflight-capabilities",
      expectedContract: "/v1/capabilities",
      note: "missing auth",
      reason: "unknown",
    });
  });

  it("throws for unknown surface and missing required path params", () => {
    expect(() => resolvePath("nope.surface")).toThrow('resolvePath: unknown surface "nope.surface"');
    expect(() => resolvePath("frontDoor.idea", "legacy")).toThrow(
      'SURFACE_CONTRACTS: missing path param "id"',
    );
    expect(() => resolvePath("portal.dashboard", "canonical", { portal: "" })).toThrow(
      'SURFACE_CONTRACTS: missing path param "portal"',
    );
    expect(() => resolvePath("cavi.operator.task", "legacy")).toThrow(
      'SURFACE_CONTRACTS: missing path param "taskId"',
    );
  });

  it("centralizes auth, client id, idempotency, credentials, and subclass header overrides", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const trace = vi.fn();
    const client = new HeaderOverrideClient({
      baseUrl: "https://api.example/",
      auth: { bearerToken: "test-token", clientId: "client-1" },
      credentials: "include",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onTrace: trace,
    });

    await expect(client.get("items", { method: "POST", body: { a: 1 }, idempotencyKey: "idem-1" })).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/items");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ a: 1 }),
      cache: "no-store",
      credentials: "include",
    });
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "Idempotency-Key": "idem-1",
      "X-Override": "yes",
      "X-Portal-Client-Id": "client-1",
    });
    expect(trace).toHaveBeenCalledWith(expect.objectContaining({ ok: true, path: "/items" }));
  });

  it("keeps request timeouts active when callers pass their own abort signal", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );
    const trace = vi.fn();
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      defaultTimeoutMs: 50,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      onTrace: trace,
    });

    const assertion = expect(
      client.get("/slow", { signal: callerController.signal }),
    ).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/slow",
      status: 0,
    });
    await vi.advanceTimersByTimeAsync(51);

    await assertion;
    expect(callerController.signal.aborted).toBe(false);
    expect(fetchImpl.mock.calls[0]?.[1]?.signal).not.toBe(callerController.signal);
    expect(trace).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: false,
        path: "/slow",
      }),
    );
  });

  it("honors caller abort signals before the package timeout fires", async () => {
    vi.useFakeTimers();
    const callerController = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("caller cancelled", "AbortError"));
          });
        }),
    );
    const client = new TestApiClient({
      baseUrl: "https://api.example",
      defaultTimeoutMs: 10_000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const assertion = expect(
      client.get("/cancelled", { signal: callerController.signal }),
    ).rejects.toMatchObject({
      name: "HttpApiError",
      path: "/cancelled",
      status: 0,
    });
    callerController.abort("caller cancelled");
    await vi.advanceTimersByTimeAsync(0);

    await assertion;
  });

  it("uses inherited transport for library search", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = new LibraryApiClient({ baseUrl: "https://api.example", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.search({ q: "research", archived: false })).resolves.toEqual({ results: [] });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/library/api/search?q=research&archived=false");
  });

  it("keeps targeted fleet-router chat runs on the gateway run surface", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            run_id: "run_1",
            status: "started",
            routing: {
              targetProfile: "martina",
              taskId: "task_1",
              workerEventStream: true,
            },
          }),
          { status: 202 },
        ),
    );
    const client = new GatewayApiClient({
      baseUrl: "https://gateway.example",
      auth: { bearerToken: "test-token", clientId: "cavi-control-mobile" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(
      client.startRun({
        input: "show my workspace queue",
        session_id: "mobile-session-1",
        targetProfile: "martina",
        target_agent: "martina",
        source: {
          platform: "mobile_app",
          app_env: "cavi-control-mobile",
          conversation_id: "thread-1",
        },
        metadata: { mobileMessageId: "msg-1" },
        attachments: [{ name: "note.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
      }),
    ).resolves.toMatchObject({
      run_id: "run_1",
      routing: {
        targetProfile: "martina",
        taskId: "task_1",
        workerEventStream: true,
      },
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://gateway.example/v1/runs");
    expect(fetchImpl.mock.calls[0]?.[1]?.method).toBe("POST");
    expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "X-Portal-Client-Id": "cavi-control-mobile",
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      input: "show my workspace queue",
      session_id: "mobile-session-1",
      targetProfile: "martina",
      target_agent: "martina",
      source: {
        platform: "mobile_app",
        app_env: "cavi-control-mobile",
        conversation_id: "thread-1",
      },
      metadata: { mobileMessageId: "msg-1" },
      attachments: [{ name: "note.txt", mimeType: "text/plain", dataBase64: "aGVsbG8=" }],
    });
  });
});
