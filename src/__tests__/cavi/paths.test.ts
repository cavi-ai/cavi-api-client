import { describe, expect, it } from "vitest";
import {
  API_DEB,
  API_OPERATOR,
  CAVI_CONTROL_API_ENDPOINTS,
  DEB_API,
  OPERATOR_API,
  debBacklogItemPath,
  debWorkspaceDiagnosticRouteHint,
  debWorkspaceExpectedContractSummary,
  operatorTaskDiscoursePath,
  resolvePortalApiPath,
} from "../../cavi/paths";
import { describeHttpContract } from "../../core/http/contracts";

describe("api-paths", () => {
  it("keeps DEB_API and OPERATOR_API aligned with base constants", () => {
    expect(DEB_API.root).toBe(API_DEB);
    expect(DEB_API.profile).toBe(`${API_DEB}/profile`);
    expect(DEB_API.sprint).toBe(`${API_DEB}/sprint`);
    expect(DEB_API.backlog).toBe(`${API_DEB}/backlog`);
    expect(DEB_API.call).toBe(`${API_DEB}/call`);

    expect(OPERATOR_API.snapshot).toBe(`${API_OPERATOR}/snapshot`);
    expect(OPERATOR_API.status).toBe(`${API_OPERATOR}/status`);
    expect(OPERATOR_API.registry).toBe(`${API_OPERATOR}/registry`);
    expect(OPERATOR_API.tasks).toBe(`${API_OPERATOR}/tasks`);
    expect(OPERATOR_API.memory).toBe(`${API_OPERATOR}/memory`);
    expect(OPERATOR_API.workerReady).toBe(`${API_OPERATOR}/worker/ready`);
    expect(OPERATOR_API.workerTasks).toBe(`${API_OPERATOR}/worker/tasks`);
  });

  it("stays aligned with the package-level CAVI endpoint owner", () => {
    expect(API_OPERATOR).toBe(CAVI_CONTROL_API_ENDPOINTS.operator.root);
    expect(DEB_API).toEqual({
      root: CAVI_CONTROL_API_ENDPOINTS.deb.root,
      profile: CAVI_CONTROL_API_ENDPOINTS.deb.profile,
      sprint: CAVI_CONTROL_API_ENDPOINTS.deb.sprint,
      backlog: CAVI_CONTROL_API_ENDPOINTS.deb.backlog,
      call: CAVI_CONTROL_API_ENDPOINTS.deb.call,
    });
    expect(OPERATOR_API).toEqual({
      snapshot: CAVI_CONTROL_API_ENDPOINTS.operator.snapshot,
      status: CAVI_CONTROL_API_ENDPOINTS.operator.status,
      registry: CAVI_CONTROL_API_ENDPOINTS.operator.registry,
      tasks: CAVI_CONTROL_API_ENDPOINTS.operator.tasks,
      memory: CAVI_CONTROL_API_ENDPOINTS.operator.memory,
      workerReady: CAVI_CONTROL_API_ENDPOINTS.operator.workerReady,
      workerTasks: CAVI_CONTROL_API_ENDPOINTS.operator.workerTasks,
    });
  });

  it("exposes cost and scoring path constants", () => {
    expect(CAVI_CONTROL_API_ENDPOINTS.costHistory).toBe(
      "/api/plugins/cavi-control/cost/history",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.scoringModel).toBe(
      "/api/plugins/cavi-control/scoring/model",
    );
  });

  it("debBacklogItemPath encodes item ids", () => {
    expect(debBacklogItemPath("abc")).toBe(`${DEB_API.backlog}/abc`);
    expect(debBacklogItemPath("a b")).toBe(`${DEB_API.backlog}/a%20b`);
    expect(debBacklogItemPath("x&y")).toBe(`${DEB_API.backlog}/x%26y`);
  });

  it("operatorTaskDiscoursePath encodes task ids", () => {
    expect(operatorTaskDiscoursePath("task-1")).toBe(
      `${API_OPERATOR}/tasks/task-1/discourse`,
    );
    expect(operatorTaskDiscoursePath("t/x")).toBe(
      `${API_OPERATOR}/tasks/t%2Fx/discourse`,
    );
  });

  it("resolvePortalApiPath keeps dynamic portal routes under the path owner", () => {
    expect(resolvePortalApiPath("martina", "runs")).toBe(
      "/api/plugins/portal/martina/runs",
    );
    expect(resolvePortalApiPath("research team", "/config")).toBe(
      "/api/plugins/portal/research%20team/config",
    );
    expect(resolvePortalApiPath("x/y", "artifacts/docs/a b.md")).toBe(
      "/api/plugins/portal/x%2Fy/artifacts/docs/a b.md",
    );
    expect(resolvePortalApiPath("martina", " ")).toBe("/api/plugins/portal/martina");
    expect(() => resolvePortalApiPath(" ", "runs")).toThrow(/missing portalId/u);
    expect(() => resolvePortalApiPath("martina", "../config")).toThrow(/portal root/u);
    expect(() => resolvePortalApiPath("martina", "%2e%2e/config")).toThrow(/portal root/u);
    expect(() => resolvePortalApiPath("martina", "runs\\latest")).toThrow(/backslashes/u);
  });

  it("describeHttpContract formats with optional body hint", () => {
    expect(describeHttpContract("GET", "/x")).toBe("GET /x");
    expect(describeHttpContract("PUT", "/y", "{ a: 1 }")).toBe(
      "PUT /y { a: 1 }",
    );
  });

  it("debWorkspaceExpectedContractSummary lists split endpoints and aggregate fallback", () => {
    const summary = debWorkspaceExpectedContractSummary();
    expect(summary).toContain(DEB_API.profile);
    expect(summary).toContain(DEB_API.sprint);
    expect(summary).toContain(DEB_API.backlog);
    expect(summary).toContain(`aggregate: GET ${API_DEB}`);
  });

  it("debWorkspaceDiagnosticRouteHint lists deb routes", () => {
    const hint = debWorkspaceDiagnosticRouteHint();
    expect(hint).toContain(DEB_API.profile);
    expect(hint).toContain(DEB_API.sprint);
    expect(hint).toContain(DEB_API.backlog);
  });
});
