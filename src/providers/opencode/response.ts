import { ApiClientError, ApiClientErrorCode, ApiClientErrorType, stringifyUnknownError } from "../../core/errors.js";
import type { RuntimeRunStatus } from "../../core/runtime/run.js";
import { normalizeRuntimeUsage } from "../../core/runtime/usage.js";
import { OPENCODE_SERVER_VERSION } from "./protocol.js";

export type OpenCodeHealthResponse = { healthy: true; version: typeof OPENCODE_SERVER_VERSION };
export type OpenCodeSessionResponse = { id: string; directory: string; version: typeof OPENCODE_SERVER_VERSION };

function protocolError(message: string): ApiClientError {
  return new ApiClientError(`opencode: ${message}`, {
    type: ApiClientErrorType.Transport,
    code: ApiClientErrorCode.ProtocolMismatch,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw protocolError(`${key} must be a nonblank string`);
  }
  return value;
}

function sessionDirectory(expected: string | { directory: string }): string {
  if (typeof expected === "string") return expected;
  if (isRecord(expected) && typeof expected.directory === "string") return expected.directory;
  throw protocolError("requested directory is invalid");
}

function assertSessionId(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || !value.startsWith("ses_")) {
    throw protocolError("session id must be a nonblank ses_ identifier");
  }
  return value;
}

export function parseOpenCodeHealthResponse(value: unknown): OpenCodeHealthResponse {
  if (!isRecord(value) || Object.keys(value).some((key) => key !== "healthy" && key !== "version")) {
    throw protocolError("health response must be a strict record");
  }
  if (value.healthy !== true || value.version !== OPENCODE_SERVER_VERSION) {
    throw protocolError(`health response must report healthy=true and version ${OPENCODE_SERVER_VERSION}`);
  }
  return { healthy: true, version: OPENCODE_SERVER_VERSION };
}

export function parseOpenCodeSessionResponse(
  value: unknown,
  requestedDirectory: string | { directory: string },
): OpenCodeSessionResponse {
  if (!isRecord(value)) throw protocolError("session response must be a record");
  const id = assertSessionId(value.id);
  const directory = requiredString(value, "directory");
  const version = requiredString(value, "version");
  const expectedDirectory = sessionDirectory(requestedDirectory);
  if (directory !== expectedDirectory) {
    throw protocolError("session directory does not match the requested directory");
  }
  if (version !== OPENCODE_SERVER_VERSION) {
    throw protocolError(`session version must be ${OPENCODE_SERVER_VERSION}`);
  }
  return { id, directory, version: OPENCODE_SERVER_VERSION };
}

function errorMessage(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value)) {
    for (const candidate of [value.message, value.reason, isRecord(value.data) ? value.data.message : undefined]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  const serialized = stringifyUnknownError(value).trim();
  return serialized || "opencode response failed";
}

function readUsage(info: Record<string, unknown>): Record<string, number> | undefined {
  const tokens = info.tokens;
  if (!isRecord(tokens)) {
    if (tokens !== undefined) throw protocolError("assistant tokens must be a record");
    return undefined;
  }
  const usage: Record<string, number> = {};
  const scalarKeys: Array<[string, string]> = [
    ["input", "input_tokens"],
    ["output", "output_tokens"],
    ["reasoning", "reasoning_tokens"],
  ];
  for (const [source, target] of scalarKeys) {
    if (tokens[source] !== undefined) {
      if (typeof tokens[source] !== "number" || !Number.isFinite(tokens[source])) {
        throw protocolError(`assistant tokens.${source} must be numeric`);
      }
      usage[target] = tokens[source] as number;
    }
  }
  if (tokens.cache !== undefined) {
    if (!isRecord(tokens.cache)) throw protocolError("assistant tokens.cache must be a record");
    for (const [source, target] of [["read", "cache_read_input_tokens"], ["write", "cache_creation_input_tokens"]] as const) {
      if (tokens.cache[source] !== undefined) {
        if (typeof tokens.cache[source] !== "number" || !Number.isFinite(tokens.cache[source])) {
          throw protocolError(`assistant tokens.cache.${source} must be numeric`);
        }
        usage[target] = tokens.cache[source] as number;
      }
    }
  }
  return Object.keys(usage).length > 0 ? usage : undefined;
}

function readTextParts(parts: unknown[]): string {
  let output = "";
  const recognizedNonTextTypes = new Set([
    "reasoning",
    "tool",
    "step-start",
    "step-finish",
    "snapshot",
    "patch",
    "agent",
    "subtask",
    "compaction",
    "retry",
    "file",
  ]);
  for (const part of parts) {
    if (!isRecord(part) || typeof part.type !== "string") {
      throw protocolError("message parts must be typed records");
    }
    if (part.type === "text") {
      if (typeof part.text !== "string") throw protocolError("text parts must contain string text");
      output += part.text;
    } else if (!recognizedNonTextTypes.has(part.type)) {
      throw protocolError(`unknown message part type: ${part.type}`);
    }
  }
  return output;
}

export function mapOpenCodePromptResponseToRunStatus(
  value: unknown,
  expectedSessionID: string,
): RuntimeRunStatus {
  if (!isRecord(value) || !isRecord(value.info) || !Array.isArray(value.parts)) {
    throw protocolError("prompt response must contain assistant info and parts array");
  }
  const info = value.info;
  requiredString(info, "id");
  const sessionID = requiredString(info, "sessionID");
  assertSessionId(sessionID);
  if (sessionID !== expectedSessionID) throw protocolError("prompt response session ID does not match");
  if (info.role !== "assistant") throw protocolError("prompt response info.role must be assistant");
  const providerID = requiredString(info, "providerID");
  const modelID = requiredString(info, "modelID");
  const output = readTextParts(value.parts);
  const usage = readUsage(info);
  const tokens = normalizeRuntimeUsage(usage, "opencode");
  const failed = info.error !== undefined && info.error !== null;
  return {
    run_id: expectedSessionID,
    status: failed ? "failed" : "completed",
    model: `${providerID}/${modelID}`,
    output,
    ...(failed ? { error: errorMessage(info.error) } : {}),
    ...(usage ? { usage } : {}),
    ...(tokens ? { tokens } : {}),
  };
}

export const mapOpenCodeResponseToRunStatus = mapOpenCodePromptResponseToRunStatus;
export const parseOpenCodePromptResponse = mapOpenCodePromptResponseToRunStatus;
export const mapOpenCodeHealthResponse = parseOpenCodeHealthResponse;
export const mapOpenCodeSessionResponse = parseOpenCodeSessionResponse;
