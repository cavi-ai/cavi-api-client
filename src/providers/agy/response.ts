import type { RuntimeRunStatus } from "../../core/runtime/run.js";

/**
 * Standard shape of an Antigravity orchestration synchronous response.
 */
export interface AgyGenerateResponse {
  run_id?: string;
  status?: string;
  result?: {
    output?: string;
    artifacts?: string[];
  };
}

/**
 * Maps an AGY orchestration response back to the universal RuntimeRunStatus contract.
 */
export function mapAgyResponseToRunStatus(
  agentId: string,
  response: AgyGenerateResponse,
  fallbackRunId: string,
): RuntimeRunStatus {
  const runId = response.run_id || fallbackRunId;
  const status = (response.status as RuntimeRunStatus["status"]) || "in_progress";
  
  return {
    run_id: runId,
    status,
    output: response.result?.output,
    model: agentId,
  };
}
