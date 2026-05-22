import { describe, expect, it } from "vitest";
import { API_OPERATOR } from "../../../../cavi/data/cavi-control/constants";
import {
  GATEWAY_RPC_METHODS,
  taskDiscourseExpectedContractSummary,
} from "../../../../cavi/data/cavi-control/gateway-rpc";

describe("gateway-rpc", () => {
  it("exposes discourse.tree RPC name", () => {
    expect(GATEWAY_RPC_METHODS.discourseTree).toBe("discourse.tree");
  });

  it("taskDiscourseExpectedContractSummary references WS and HTTP fallback", () => {
    const summary = taskDiscourseExpectedContractSummary();
    expect(summary).toContain("discourse.tree");
    expect(summary).toContain("WS");
    expect(summary).toContain("fallback:");
    expect(summary).toContain(`${API_OPERATOR}/tasks/:taskId/discourse`);
  });
});
