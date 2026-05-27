import { describe, expect, it } from "vitest";
import {
  API_PROJECT_BOARD,
  API_OPERATOR,
  API_OPERATOR_PLUGIN_ALIAS,
  CAVI_CONTROL_API_ENDPOINTS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  PROJECT_BOARD_API,
  OPERATOR_API,
  OPERATOR_API_PLUGIN_ALIAS,
  projectBoardBacklogItemPath,
  projectBoardWorkspaceDiagnosticRouteHint,
  projectBoardWorkspaceExpectedContractSummary,
  operatorControlExpectedContractSummary,
  operatorTaskDiscoursePluginAliasPath,
  operatorTaskDiscoursePath,
  resolvePortalApiPath,
} from "../../../extensions/cavi/contracts/paths";
import { describeHttpContract } from "../../../core/http/contracts";

describe("api-paths", () => {
  it("keeps PROJECT_BOARD_API and OPERATOR_API aligned with base constants", () => {
    expect(PROJECT_BOARD_API.root).toBe(API_PROJECT_BOARD);
    expect(PROJECT_BOARD_API.profile).toBe(`${API_PROJECT_BOARD}/profile`);
    expect(PROJECT_BOARD_API.sprint).toBe(`${API_PROJECT_BOARD}/sprint`);
    expect(PROJECT_BOARD_API.backlog).toBe(`${API_PROJECT_BOARD}/backlog`);
    expect(PROJECT_BOARD_API.call).toBe(`${API_PROJECT_BOARD}/call`);

    expect(OPERATOR_API.snapshot).toBe(`${API_OPERATOR}/snapshot`);
    expect(OPERATOR_API.status).toBe(`${API_OPERATOR}/status`);
    expect(OPERATOR_API.registry).toBe(`${API_OPERATOR}/registry`);
    expect(OPERATOR_API.tasks).toBe(`${API_OPERATOR}/tasks`);
    expect(OPERATOR_API.memory).toBe(`${API_OPERATOR}/memory`);
    expect(OPERATOR_API.workerReady).toBe(`${API_OPERATOR}/worker/ready`);
    expect(OPERATOR_API.workerTasks).toBe(`${API_OPERATOR}/worker/tasks`);
    expect(OPERATOR_API_PLUGIN_ALIAS.snapshot).toBe(
      `${API_OPERATOR_PLUGIN_ALIAS}/snapshot`,
    );
  });

  it("keeps Caviclaw operator HTTP aliases and RPC methods explicit", () => {
    expect(API_OPERATOR).toBe("/cavi-control/api/operator");
    expect(CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.snapshot).toBe(
      "/api/plugins/cavi-control/operator/snapshot",
    );
    expect(CAVI_CONTROL_OPERATOR_RPC_METHODS.snapshot).toBe("operator.snapshot");
    expect(CAVI_CONTROL_OPERATOR_RPC_METHODS.tasksList).toBe("operator.tasks.list");
    expect(CAVI_CONTROL_OPERATOR_RPC_METHODS.discourseTree).toBe("discourse.tree");
    expect(operatorControlExpectedContractSummary()).toContain(
      CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.snapshot,
    );
  });

  it("stays aligned with the package-level CAVI endpoint owner", () => {
    expect(API_OPERATOR).toBe(CAVI_CONTROL_API_ENDPOINTS.operator.root);
    expect(PROJECT_BOARD_API).toEqual({
      root: CAVI_CONTROL_API_ENDPOINTS.projectBoard.root,
      profile: CAVI_CONTROL_API_ENDPOINTS.projectBoard.profile,
      sprint: CAVI_CONTROL_API_ENDPOINTS.projectBoard.sprint,
      backlog: CAVI_CONTROL_API_ENDPOINTS.projectBoard.backlog,
      call: CAVI_CONTROL_API_ENDPOINTS.projectBoard.call,
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
    expect(OPERATOR_API_PLUGIN_ALIAS.snapshot).toBe(
      CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.snapshot,
    );
  });

  it("exposes cost and scoring path constants", () => {
    expect(CAVI_CONTROL_API_ENDPOINTS.costHistory).toBe(
      "/api/plugins/cavi-control/cost/history",
    );
    expect(CAVI_CONTROL_API_ENDPOINTS.scoringModel).toBe(
      "/api/plugins/cavi-control/scoring/model",
    );
  });

  it("projectBoardBacklogItemPath encodes item ids", () => {
    expect(projectBoardBacklogItemPath("abc")).toBe(`${PROJECT_BOARD_API.backlog}/abc`);
    expect(projectBoardBacklogItemPath("a b")).toBe(`${PROJECT_BOARD_API.backlog}/a%20b`);
    expect(projectBoardBacklogItemPath("x&y")).toBe(`${PROJECT_BOARD_API.backlog}/x%26y`);
  });

  it("operatorTaskDiscoursePath encodes task ids", () => {
    expect(operatorTaskDiscoursePath("task-1")).toBe(
      `${API_OPERATOR}/tasks/task-1/discourse`,
    );
    expect(operatorTaskDiscoursePluginAliasPath("task-1")).toBe(
      `${API_OPERATOR_PLUGIN_ALIAS}/tasks/task-1/discourse`,
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

  it("projectBoardWorkspaceExpectedContractSummary lists split endpoints and aggregate fallback", () => {
    const summary = projectBoardWorkspaceExpectedContractSummary();
    expect(summary).toContain(PROJECT_BOARD_API.profile);
    expect(summary).toContain(PROJECT_BOARD_API.sprint);
    expect(summary).toContain(PROJECT_BOARD_API.backlog);
    expect(summary).toContain(`aggregate: GET ${API_PROJECT_BOARD}`);
  });

  it("projectBoardWorkspaceDiagnosticRouteHint lists project board routes", () => {
    const hint = projectBoardWorkspaceDiagnosticRouteHint();
    expect(hint).toContain(PROJECT_BOARD_API.profile);
    expect(hint).toContain(PROJECT_BOARD_API.sprint);
    expect(hint).toContain(PROJECT_BOARD_API.backlog);
  });
});
