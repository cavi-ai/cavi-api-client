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
  const status = response.status === "failed" ? "failed" : "completed";
  
  // Format AGY output into standard universal message format
  const outputText = response.result?.output ?? "Antigravity task executed successfully.";
  
  return {
    run_id: runId,
    status,
    output: outputText,
  };
}
