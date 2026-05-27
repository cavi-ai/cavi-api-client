import {
  API_OPERATOR,
  API_OPERATOR_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
} from "../contracts/paths.js";

export const GATEWAY_RPC_METHODS = {
  discourseTree: CAVI_CONTROL_OPERATOR_RPC_METHODS.discourseTree,
} as const;

export function taskDiscourseExpectedContractSummary(): string {
  return `WS ${GATEWAY_RPC_METHODS.discourseTree} (fallback: GET ${API_OPERATOR}/tasks/:taskId/discourse or ${API_OPERATOR_PLUGIN_ALIAS}/tasks/:taskId/discourse)`;
}
