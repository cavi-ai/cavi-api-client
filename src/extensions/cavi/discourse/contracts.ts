import {
  CAVI_CONTROL_OPERATOR_API,
  CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS,
  CAVI_CONTROL_OPERATOR_RPC_METHODS,
} from "../contracts/paths.js";

export const GATEWAY_RPC_METHODS = {
  discourseTree: CAVI_CONTROL_OPERATOR_RPC_METHODS.discourseTree,
} as const;

export function taskDiscourseExpectedContractSummary(): string {
  return `WS ${GATEWAY_RPC_METHODS.discourseTree} (fallback: GET ${CAVI_CONTROL_OPERATOR_API.root}/tasks/:taskId/discourse or ${CAVI_CONTROL_OPERATOR_API_PLUGIN_ALIAS.root}/tasks/:taskId/discourse)`;
}
