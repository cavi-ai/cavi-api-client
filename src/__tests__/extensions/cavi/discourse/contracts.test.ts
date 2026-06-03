import { describe, expect, it } from "vitest";
import {
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
} from "../../../../extensions/cavi/contracts/paths";
import {
  GATEWAY_RPC_METHODS,
  taskDiscourseExpectedContractSummary,
} from "../../../../extensions/cavi/discourse/contracts";

const API_OPERATOR = CAVI_CONTROL_OPERATOR_API.root;
const API_OPERATOR_PLUGIN_ALIAS = CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.root;

describe("gateway-rpc", () => {
  it("exposes discourse.tree RPC name", () => {
    expect(GATEWAY_RPC_METHODS.discourseTree).toBe(
      CAVI_CONTROL_OPERATOR_RPC_METHODS.discourseTree,
    );
  });

  it("taskDiscourseExpectedContractSummary references WS and HTTP fallback", () => {
    const summary = taskDiscourseExpectedContractSummary();
    expect(summary).toContain("discourse.tree");
    expect(summary).toContain("WS");
    expect(summary).toContain("fallback:");
    expect(summary).toContain(`${API_OPERATOR}/tasks/:taskId/discourse`);
    expect(summary).toContain(
      `${API_OPERATOR_PLUGIN_ALIAS}/tasks/:taskId/discourse`,
    );
  });
});
