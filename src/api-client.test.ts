import { describe, expect, it, vi } from "vitest";
import { BaseHttpApiClient } from "./base-client";
import { resolveHttpApiConfigFromEnv } from "./config";
import {
  appendHttpQuery,
  CAVI_CONTROL_API_ENDPOINTS,
  HERMES_API_ENDPOINTS,
  HERMES_API_ENDPOINT_TEMPLATES,
  LIBRARY_API_ENDPOINTS,
  resolveLibraryApiPath,
} from "./paths";
import {
  MOBILE_GATEWAY_ENDPOINT_CONTRACTS,
  PORTAL_DASHBOARD_IDS,
  createContractGap,
  getMobileGatewayEndpointPath,
  portalDashboardPath,
  resolveOperatorTaskDispatchPath,
  SURFACE_CONTRACTS,
  resolvePath,
} from "./index";
import { LibraryApiClient } from "./library-client";
import type { HttpApiClientOptions, HttpApiRequestInit } from "./types";

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
  it("resolves canonical env values before aliases and falls back library config to CAVI", () => {
    const config = resolveHttpApiConfigFromEnv({
      CAVI_API_BASE_URL: " https://canonical.example ",
      EXPO_PUBLIC_CAVI_API_BASE_URL: "https://alias.example",
      CAVI_API_AUTH_TOKEN: " token-value ",
      CAVI_API_CLIENT_ID: " cavi-client ",
      HERMES_API_BASE_URL: "https://hermes.example",
    });

    expect(config.cavi).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
    expect(config.hermes.baseUrl).toBe("https://hermes.example");
    expect(config.library).toEqual({
      baseUrl: "https://canonical.example",
      authToken: "token-value",
      clientId: "cavi-client",
    });
  });

  it("keeps extracted endpoint builders encoded and aligned", () => {
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
    expect(resolvePath("cavi.deb.profile", "canonical")).toBe("/cavi-control/api/deb/profile");
    expect(resolvePath("cavi.deb.sprint", "legacy")).toBe("/cavi-control/api/deb/sprint");
    expect(resolvePath("cavi.deb.backlog", "canonical")).toBe("/cavi-control/api/deb/backlog");
    expect(resolvePath("cavi.deb.call", "canonical")).toBe("/cavi-control/api/deb/call");
    expect(resolvePath("cavi.operator.registry", "legacy")).toBe(
      "/cavi-control/api/operator/registry",
    );
    expect(resolvePath("cavi.operator.snapshot", "canonical")).toBe(
      "/cavi-control/api/operator/snapshot",
    );
    expect(resolvePath("kanban.board", "canonical")).toBe("/api/plugins/kanban/board");
    expect(resolvePath("cavi.operator.memory", "canonical")).toBe(
      "/cavi-control/api/operator/memory",
    );
    expect(resolvePath("cavi.operator.workerReady", "legacy")).toBe(
      "/cavi-control/api/operator/worker/ready",
    );
    expect(resolvePath("cavi.operator.workerTasks", "canonical")).toBe(
      "/cavi-control/api/operator/worker/tasks",
    );
    expect(resolvePath("cavi.operator.task", "legacy", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b",
    );
    expect(resolvePath("cavi.operator.taskDiscourse", "canonical", { taskId: "task/a b" })).toBe(
      "/cavi-control/api/operator/tasks/task%2Fa%20b/discourse",
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

    expect(resolvePath("frontDoor.ideaList", "canonical")).toBe("/front-door/api/ideas");
    expect(resolvePath("frontDoor.ideaDetail", "canonical", { id: "idea/a b" })).toBe(
      "/front-door/api/ideas/idea%2Fa%20b",
    );
    expect(resolvePath("frontDoor.projectDetail", "legacy", { id: "proj/a b" })).toBe(
      "/front-door/api/projects/proj%2Fa%20b",
    );
    expect(resolvePath("frontDoor.articleList", "legacy")).toBe("/front-door/api/articles");
    expect(resolvePath("frontDoor.memoryList", "canonical")).toBe("/front-door/api/memory");
    expect(resolvePath("frontDoor.inboxUpload", "legacy")).toBe("/front-door/api/inbox");

    expect(resolvePath("trading.dashboard", "legacy")).toBe("/trading/api/dashboard");
    expect(resolvePath("trading.dashboard", "canonical")).toBe("/trading/api/dashboard");
    expect(resolvePath("trading.researchPackets", "legacy")).toBe("/trading/api/research-packets");
    expect(resolvePath("trading.researchPackets", "canonical")).toBe("/trading/api/research-packets");
    expect(resolvePath("trading.sourceRegistry", "legacy")).toBe("/trading/api/source-registry");
    expect(resolvePath("trading.sourceRegistry", "canonical")).toBe("/trading/api/source-registry");
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

  it("uses inherited transport for library search", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ results: [] }), { status: 200 }));
    const client = new LibraryApiClient({ baseUrl: "https://api.example", fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.search({ q: "research", archived: false })).resolves.toEqual({ results: [] });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example/library/api/search?q=research&archived=false");
  });
});
