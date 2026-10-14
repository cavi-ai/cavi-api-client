import type { Readable, Writable } from "node:stream";
import { ApiClientError, getErrorCode, getErrorStatus, getErrorType } from "../../errors.js";
import type { RuntimeClient } from "../../runtime/client.js";
import type { RuntimeRunStartBody, RuntimeRunStatus } from "../../runtime/run.js";
import { requireCompletedRun, requireRunText } from "../../runtime/run-results.js";

export const RUNTIME_BRIDGE_PROTOCOL_VERSION = 1;
/** Maximum UTF-8 JSON bytes per frame, excluding the newline. */
export const RUNTIME_BRIDGE_MAX_FRAME_BYTES = 1_048_576;

export type RuntimeBridgeOptions = {
  client: RuntimeClient;
  input: Readable;
  output: Writable;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function invalid(message: string): never {
  throw new ApiClientError(message, { type: "validation", code: "validation_failed" });
}
function protocolError(): ApiClientError {
  return new ApiClientError("Invalid runtime bridge frame", { type: "transport", code: "transport_protocol_error" });
}
function startBody(value: unknown): RuntimeRunStartBody {
  if (!record(value)) invalid("Expected run body");
  const input = value.input;
  if (!(typeof input === "string" || (Array.isArray(input) && input.every((message) =>
    record(message) && typeof message.role === "string" &&
    (typeof message.content === "string" || (Array.isArray(message.content) && message.content.every(record))))))) {
    invalid("Expected string input or conversation messages");
  }
  for (const key of ["model", "instructions"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") invalid(`Invalid ${key}`);
  }
  if (value.tools !== undefined && !(Array.isArray(value.tools) && value.tools.every(record))) invalid("Invalid tools");
  if (value.metadata !== undefined && !record(value.metadata)) invalid("Invalid metadata");
  if (value.dryRun !== undefined && typeof value.dryRun !== "boolean") invalid("Invalid dryRun");
  return value as RuntimeRunStartBody;
}
function runStatus(value: unknown): RuntimeRunStatus {
  if (!record(value) || typeof value.run_id !== "string" || !value.run_id || typeof value.status !== "string") {
    invalid("Expected run status and identity");
  }
  return value as RuntimeRunStatus;
}
function runId(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) invalid("Expected non-empty run ID");
  return value;
}

function operations(client: RuntimeClient): string[] {
  return [
    "getRuntimeCapabilities", "startRun",
    ...(typeof client.getRun === "function" ? ["getRun"] : []),
    ...(typeof client.cancelRun === "function" ? ["cancelRun"] : []),
    "requireCompletedRun", "requireRunText",
  ];
}

async function dispatch(client: RuntimeClient, method: string, params: unknown): Promise<unknown> {
  switch (method) {
    case "describe":
      return { protocolVersion: RUNTIME_BRIDGE_PROTOCOL_VERSION, maxFrameBytes: RUNTIME_BRIDGE_MAX_FRAME_BYTES,
        operations: operations(client), capabilities: await client.getRuntimeCapabilities() };
    case "getRuntimeCapabilities": return client.getRuntimeCapabilities();
    case "startRun": return client.startRun(startBody(params));
    case "getRun":
      if (typeof client.getRun === "function") return client.getRun(runId(params));
      break;
    case "cancelRun":
      if (typeof client.cancelRun === "function") return client.cancelRun(runId(params));
      break;
    case "requireCompletedRun": return requireCompletedRun(runStatus(params));
    case "requireRunText": return requireRunText(runStatus(params));
  }
  throw new ApiClientError("Runtime bridge operation unavailable", { code: "endpoint_not_found" });
}

function errorReply(id: number, error: unknown) {
  const status = getErrorStatus(error);
  return { v: RUNTIME_BRIDGE_PROTOCOL_VERSION, id, ok: false, error: {
    name: "ApiClientError", message: "Runtime operation failed",
    type: getErrorType(error) ?? "unknown", code: getErrorCode(error) ?? "unknown",
    ...(status === undefined ? {} : { status }),
  } };
}

/**
 * Serve serialized lifecycle calls over bounded UTF-8 JSON Lines. The caller
 * owns the streams and client. No retries, backend cancellation, network
 * listener, dynamic method invocation, or provider construction is performed.
 * Malformed framing rejects the server; operation errors remain correlated.
 * Provider diagnostics and causes are deliberately excluded from wire errors.
 */
export async function serveRuntimeBridge({ client, input, output }: RuntimeBridgeOptions): Promise<void> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pieces: Buffer[] = [];
  let size = 0;
  const onOutputError = () => { /* write callbacks report the original failure. */ };
  output.on("error", onOutputError);
  async function frame(bytes: Buffer): Promise<void> {
    let request: unknown;
    try { request = JSON.parse(decoder.decode(bytes)); }
    catch { throw protocolError(); }
    if (!record(request) || request.v !== RUNTIME_BRIDGE_PROTOCOL_VERSION ||
      !Number.isSafeInteger(request.id) || (request.id as number) < 1 || typeof request.method !== "string") {
      throw protocolError();
    }
    const id = request.id as number;
    let reply: unknown;
    try { reply = { v: RUNTIME_BRIDGE_PROTOCOL_VERSION, id, ok: true,
      result: await dispatch(client, request.method, request.params) }; }
    catch (error) { reply = errorReply(id, error); }
    let encoded: string;
    try {
      encoded = JSON.stringify(reply);
      if (Buffer.byteLength(encoded, "utf8") > RUNTIME_BRIDGE_MAX_FRAME_BYTES) invalid("Response frame too large");
    } catch (error) { encoded = JSON.stringify(errorReply(id, error)); }
    await new Promise<void>((resolve, reject) => {
      output.write(encoded + "\n", (error) => { if (error) reject(error); else resolve(); });
    });
  }
  try {
    for await (const chunk of input) {
      if (!(chunk instanceof Uint8Array)) throw protocolError();
      const bytes = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
      let offset = 0;
      while (offset < bytes.length) {
        const newline = bytes.indexOf(10, offset);
        const end = newline < 0 ? bytes.length : newline;
        size += end - offset;
        if (size > RUNTIME_BRIDGE_MAX_FRAME_BYTES) throw protocolError();
        pieces.push(bytes.subarray(offset, end));
        if (newline < 0) break;
        await frame(Buffer.concat(pieces, size));
        pieces = [];
        size = 0;
        offset = newline + 1;
      }
    }
    if (size !== 0) throw protocolError();
  } finally { output.off("error", onOutputError); }
}
