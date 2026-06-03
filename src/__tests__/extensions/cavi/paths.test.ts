import { describe, expect, it } from "vitest";
import {
  CAVI_CONTROL_API_ENDPOINTS,
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  projectBoardBacklogItemPath,
  projectBoardWorkspaceDiagnosticRouteHint,
  projectBoardWorkspaceExpectedContractSummary,
  operatorControlExpectedContractSummary,
  operatorTaskDiscoursePluginAliasPath,
  operatorTaskDiscoursePath,
  resolvePortalApiPath,
} from "../../../extensions/cavi/contracts/paths";
import { describeHttpContract } from "../../../core/http/contracts";

const projectBoard = CAVI_CONTROL_API_ENDPOINTS.projectBoard;
const operator = CAVI_CONTROL_OPERATOR_API;

describe("api-paths", () => {
  it("keeps operator HTTP routes and RPC methods explicit", () => {
    expect(operator.root).toBe("/cavi-control/api/operator");
    expect(operator.snapshot).toBe(`${operator.root}/snapshot`);
    expect(operator.workerReady).toBe(`${operator.root}/worker/ready`);
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

  it("operator and project-board routes resolve from the canonical endpoint owner", () => {
    expect(operator).toBe(CAVI_CONTROL_API_ENDPOINTS.operator);
    expect(projectBoard.root).toBe("/api/plugins/cavi-control/kanban");
    expect(projectBoard.profile).toBe(`${projectBoard.root}/profile`);
    expect(projectBoard.sprint).toBe(`${projectBoard.root}/sprint`);
    expect(projectBoard.backlog).toBe(`${projectBoard.root}/backlog`);
    expect(projectBoard.call).toBe(`${projectBoard.root}/call`);
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
    expect(projectBoardBacklogItemPath("abc")).toBe(`${projectBoard.backlog}/abc`);
    expect(projectBoardBacklogItemPath("a b")).toBe(`${projectBoard.backlog}/a%20b`);
    expect(projectBoardBacklogItemPath("x&y")).toBe(`${projectBoard.backlog}/x%26y`);
  });

  it("operatorTaskDiscoursePath encodes task ids", () => {
    expect(operatorTaskDiscoursePath("task-1")).toBe(
      `${operator.root}/tasks/task-1/discourse`,
    );
    expect(operatorTaskDiscoursePluginAliasPath("task-1")).toBe(
      `${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.root}/tasks/task-1/discourse`,
    );
    expect(operatorTaskDiscoursePath("t/x")).toBe(
      `${operator.root}/tasks/t%2Fx/discourse`,
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
    expect(summary).toContain(projectBoard.profile);
    expect(summary).toContain(projectBoard.sprint);
    expect(summary).toContain(projectBoard.backlog);
    expect(summary).toContain(`aggregate: GET ${projectBoard.root}`);
  });

  it("projectBoardWorkspaceDiagnosticRouteHint lists project board routes", () => {
    const hint = projectBoardWorkspaceDiagnosticRouteHint();
    expect(hint).toContain(projectBoard.profile);
    expect(hint).toContain(projectBoard.sprint);
    expect(hint).toContain(projectBoard.backlog);
  });
});
