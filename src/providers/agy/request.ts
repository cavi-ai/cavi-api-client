import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import type { RuntimeRunStartBody } from "../../core/runtime/run.js";

/**
 * The standard request payload structure for Antigravity (AGY) orchestration APIs.
 */
export interface AgyRunRequestBody {
  agent_id: string;
  instructions?: string;
  context?: Record<string, unknown>;
  stream?: boolean;
}

/**
 * Builds the Antigravity request body from the universal run-start body.
 * Maps universal concepts (model -> agent_id, instructions -> instructions)
 * to the AGY orchestration surface.
 */
export function buildAgyRequestBody(
  body: RuntimeRunStartBody,
  defaultAgentId?: string,
  stream: boolean = false,
): { agentId: string; payload: AgyRunRequestBody } {
  const agentId = body.model ?? defaultAgentId;
  if (!agentId) {
    throw new ApiClientError("agy: an agent_id (model) is required (pass body.model or defaultModel)", {
      code: ApiClientErrorCode.ValidationFailed,
    });
  }

  const payload: AgyRunRequestBody = {
    agent_id: agentId,
    stream,
  };

  if (body.instructions) {
    payload.instructions = body.instructions;
  }

  // Map input messages to a context dictionary or string for AGY's orchestration
  if (typeof body.input === "string") {
    payload.context = { query: body.input };
  } else if (Array.isArray(body.input)) {
    payload.context = { messages: body.input };
  }

  return { agentId, payload };
}
