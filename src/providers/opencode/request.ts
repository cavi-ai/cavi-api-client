import { ApiClientError, ApiClientErrorCode, ApiClientErrorType } from "../../core/errors.js";
import type { RuntimeRunStartBody } from "../../core/runtime/run.js";

export type OpenCodeModel = {
  providerID: string;
  modelID: string;
};

export type OpenCodePromptBody = {
  parts: [{ type: "text"; text: string }];
  model?: OpenCodeModel;
  system?: string;
};

function validationError(message: string): ApiClientError {
  return new ApiClientError(`opencode: ${message}`, {
    type: ApiClientErrorType.Validation,
    code: ApiClientErrorCode.ValidationFailed,
  });
}

function parseModel(value: unknown, field: string): OpenCodeModel {
  if (typeof value !== "string" || !value.trim()) {
    throw validationError(`${field} must be a nonblank providerID/modelID string`);
  }
  const slash = value.indexOf("/");
  if (slash <= 0 || slash === value.length - 1) {
    throw validationError(`${field} must use providerID/modelID syntax`);
  }
  const providerID = value.slice(0, slash);
  const modelID = value.slice(slash + 1);
  if (!providerID.trim() || !modelID.trim()) {
    throw validationError(`${field} must include nonblank providerID and modelID`);
  }
  return { providerID, modelID };
}

/** Build the legacy OpenCode prompt body from a universal run request. */
export function buildOpenCodePromptBody(
  request: RuntimeRunStartBody,
  defaultModel?: string,
): OpenCodePromptBody {
  if (typeof request !== "object" || request === null || Array.isArray(request)) {
    throw validationError("request must be an object");
  }

  const candidate = request as unknown as Record<string, unknown>;
  if (typeof candidate.input !== "string" || !candidate.input.trim()) {
    throw validationError("input must be a nonblank string");
  }
  if (Array.isArray(candidate.input)) {
    throw validationError("message-array input is not supported");
  }
  if (candidate.tools !== undefined) {
    if (!Array.isArray(candidate.tools) || candidate.tools.length > 0) {
      throw validationError("tools are not supported");
    }
  }
  if (candidate.metadata !== undefined) {
    if (typeof candidate.metadata !== "object" || candidate.metadata === null || Array.isArray(candidate.metadata)) {
      throw validationError("metadata is not supported");
    }
    if (Object.keys(candidate.metadata as Record<string, unknown>).length > 0) {
      throw validationError("metadata is not supported");
    }
  }
  if (candidate.instructions !== undefined && typeof candidate.instructions !== "string") {
    throw validationError("instructions must be a string when supplied");
  }

  const payload: OpenCodePromptBody = {
    parts: [{ type: "text", text: candidate.input }],
  };
  if (typeof candidate.instructions === "string" && candidate.instructions.trim()) {
    payload.system = candidate.instructions;
  }
  if (candidate.model !== undefined) {
    payload.model = parseModel(candidate.model, "model");
  } else if (defaultModel !== undefined) {
    payload.model = parseModel(defaultModel, "defaultModel");
  }
  return payload;
}

// Provider-local aliases make the mapper usable by later client orchestration
// without changing the package's public exports in this foundation phase.
export const mapOpenCodeRequest = buildOpenCodePromptBody;
export const buildOpenCodeRequestBody = buildOpenCodePromptBody;
