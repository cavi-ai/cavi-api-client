import { API_OPERATOR } from "../data/cavi-control/constants.js";

export const GATEWAY_RPC_METHODS = {
  discourseTree: "discourse.tree",
} as const;

export function taskDiscourseExpectedContractSummary(): string {
  return `WS ${GATEWAY_RPC_METHODS.discourseTree} (fallback: GET ${API_OPERATOR}/tasks/:taskId/discourse)`;
}
