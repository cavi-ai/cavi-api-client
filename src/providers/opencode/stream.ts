import {
  ApiClientError,
  ApiClientErrorCode,
  ApiClientErrorType,
  stringifyUnknownError,
} from "../../core/errors.js";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../core/runtime/run-stream.js";

export type OpenCodeEvent = {
  type: string;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};

export type OpenCodeStreamState = {
  promptAccepted: boolean;
};

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

function exactProperties(
  value: unknown,
  eventType: string,
  keys: readonly string[],
  requireKeys = true,
): Record<string, unknown> {
  if (!isRecord(value)) throw protocolError(`${eventType} properties must be a record`);
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw protocolError(`${eventType} properties contain unknown fields`);
  }
  if (requireKeys) {
    for (const key of keys) {
      if (!(key in value)) throw protocolError(`${eventType} properties.${key} is required`);
    }
  }
  return value;
}

function validateRecognizedEvent(type: string, properties: unknown): Record<string, unknown> {
  switch (type) {
    case "server.connected":
      return exactProperties(properties, type, []);
    case "message.part.delta": {
      const record = exactProperties(properties, type, ["sessionID", "messageID", "partID", "field", "delta"]);
      requiredString(record, "sessionID");
      requiredString(record, "messageID");
      requiredString(record, "partID");
      requiredString(record, "field");
      if (typeof record.delta !== "string") throw protocolError(`${type} properties.delta must be a string`);
      return record;
    }
    case "session.idle": {
      const record = exactProperties(properties, type, ["sessionID"]);
      requiredString(record, "sessionID");
      return record;
    }
    case "session.error": {
      const record = exactProperties(properties, type, ["sessionID", "error"], false);
      if (record.sessionID !== undefined) requiredString(record, "sessionID");
      return record;
    }
    case "message.updated": {
      const record = exactProperties(properties, type, ["sessionID", "info"]);
      const sessionID = requiredString(record, "sessionID");
      if (!isRecord(record.info)) throw protocolError(`${type} properties.info must be a record`);
      const info = record.info;
      requiredString(info, "id");
      if (requiredString(info, "sessionID") !== sessionID) {
        throw protocolError(`${type} properties.sessionID must match properties.info.sessionID`);
      }
      if (info.role !== "assistant" && info.role !== "user") {
        throw protocolError(`${type} properties.info.role must be assistant or user`);
      }
      if (info.time !== undefined) {
        if (!isRecord(info.time)) throw protocolError(`${type} properties.info.time must be a record`);
        if (info.time.created !== undefined && (typeof info.time.created !== "number" || !Number.isFinite(info.time.created))) {
          throw protocolError(`${type} properties.info.time.created must be numeric`);
        }
        if (info.time.completed !== undefined && (typeof info.time.completed !== "number" || !Number.isFinite(info.time.completed))) {
          throw protocolError(`${type} properties.info.time.completed must be numeric`);
        }
      }
      return record;
    }
    default:
      return isRecord(properties) ? properties : {};
  }
}

/** Parse one OpenCode SSE `data` payload without handling the surrounding stream. */
export function parseOpenCodeEvent(data: string): OpenCodeEvent {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    throw protocolError("SSE event data must be valid JSON");
  }
  if (!isRecord(value)) throw protocolError("SSE event must be a record");
  const type = value.type;
  if (typeof type !== "string" || !type.trim()) throw protocolError("SSE event type must be a nonblank string");

  const recognized = new Set([
    "server.connected",
    "message.part.delta",
    "session.idle",
    "session.error",
    "message.updated",
  ]);
  if (recognized.has(type)) {
    validateRecognizedEvent(type, value.properties);
  }
  return value as OpenCodeEvent;
}

function errorMessage(value: unknown, fallback: string): string {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value)) {
    for (const candidate of [
      value.message,
      value.reason,
      isRecord(value.data) ? value.data.message : undefined,
      isRecord(value.error) ? value.error.message : undefined,
    ]) {
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
  }
  const serialized = stringifyUnknownError(value).trim();
  return serialized || fallback;
}

/** Translate one parsed OpenCode event to the canonical runtime event union. */
export function translateOpenCodeEvent(
  event: OpenCodeEvent,
  expectedSessionID: string,
  state: OpenCodeStreamState,
): RunStreamEvent | null {
  const properties = event.properties;
  if (!isRecord(properties)) return null;

  switch (event.type) {
    case "message.part.delta": {
      if (properties.sessionID !== expectedSessionID || properties.field !== "text") return null;
      return typeof properties.delta === "string" && properties.delta
        ? { event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA, runId: expectedSessionID, delta: properties.delta }
        : null;
    }
    case "session.idle":
      if (properties.sessionID !== expectedSessionID || !state.promptAccepted) return null;
      return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: expectedSessionID };
    case "session.error":
      return properties.sessionID === expectedSessionID
        ? { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: expectedSessionID, error: errorMessage(properties.error, "opencode session error") }
        : null;
    case "message.updated": {
      const info = properties.info;
      if (
        properties.sessionID !== expectedSessionID ||
        !isRecord(info) ||
        info.sessionID !== expectedSessionID ||
        info.role !== "assistant"
      ) return null;
      if (info.error !== undefined && info.error !== null) {
        return { event: RUN_STREAM_EVENT_NAMES.RUN_FAILED, runId: expectedSessionID, error: errorMessage(info.error, "opencode assistant message failed") };
      }
      const time = info.time;
      if (isRecord(time) && typeof time.completed === "number" && Number.isFinite(time.completed)) {
        return { event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED, runId: expectedSessionID };
      }
      return null;
    }
    default:
      return null;
  }
}
