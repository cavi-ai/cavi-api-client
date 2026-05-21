import { describe, expect, it } from "vitest";
import { API_DEB, API_OPERATOR } from "./constants";
import {
  API_COST_HISTORY,
  API_SCORING_MODEL,
  DEB_API,
  OPERATOR_API,
  debBacklogItemPath,
  debWorkspaceDiagnosticRouteHint,
  debWorkspaceExpectedContractSummary,
  describeHttpContract,
  operatorTaskDiscoursePath,
} from "./api-paths";

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

  it("exposes cost and scoring path constants", () => {
    expect(API_COST_HISTORY).toBe("/cavi-control/api/cost/history");
    expect(API_SCORING_MODEL).toBe("/cavi-control/api/scoring/model");
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

  it("describeHttpContract formats with optional body hint", () => {
    expect(describeHttpContract("GET", "/x")).toBe("GET /x");
    expect(describeHttpContract("PUT", "/y", "{ a: 1 }")).toBe(
      "PUT /y { a: 1 }",
    );
  });

  it("debWorkspaceExpectedContractSummary lists split endpoints and compat", () => {
    const summary = debWorkspaceExpectedContractSummary();
    expect(summary).toContain(DEB_API.profile);
    expect(summary).toContain(DEB_API.sprint);
    expect(summary).toContain(DEB_API.backlog);
    expect(summary).toContain(`compat: GET ${API_DEB}`);
  });

  it("debWorkspaceDiagnosticRouteHint lists deb routes", () => {
    const hint = debWorkspaceDiagnosticRouteHint();
    expect(hint).toContain(DEB_API.profile);
    expect(hint).toContain(DEB_API.sprint);
    expect(hint).toContain(DEB_API.backlog);
  });
});
