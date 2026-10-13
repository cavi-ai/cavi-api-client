import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { ClaudeApiClient } from "../../../providers/claude/client.js";
import { ApiClientError } from "../../../core/errors.js";
import type { RuntimeClient } from "../../../core/runtime/client.js";
import { serveRuntimeBridge } from "../../../core/transport/node/index.js";

const client = () => new ClaudeApiClient({ apiKey: "test", defaultModel: "test-model" });
async function exchange(frames: unknown[], runtime: RuntimeClient = client()) {
  const input = new PassThrough();
  const output = new PassThrough();
  let bytes = "";
  output.on("data", (chunk) => { bytes += chunk.toString(); });
  const serving = serveRuntimeBridge({ client: runtime, input, output });
  input.end(frames.map((frame) => JSON.stringify(frame) + "\n").join(""));
  await serving;
  return bytes.trim().split("\n").map((line) => JSON.parse(line));
}
const request = (id: number, method: string, params?: unknown) => ({ v: 1, id, method, params });

describe("runtime subprocess bridge", () => {
  it("discovers actual operations separately from backend capabilities", async () => {
    const [reply] = await exchange([request(1, "describe")]);
    expect(reply).toMatchObject({ v: 1, id: 1, ok: true, result: {
      protocolVersion: 1, maxFrameBytes: 1048576,
      operations: ["getRuntimeCapabilities", "startRun", "getRun", "cancelRun", "requireCompletedRun", "requireRunText"],
      capabilities: { providerKind: "claude-sdk", supports: { runs: true, streaming: true, batch: true } },
    } });
  });

  it("preserves terminal statuses and delegates completion semantics", async () => {
    const replies = await exchange([
      request(1, "startRun", { input: "hello", dryRun: true }),
      request(2, "requireRunText", { run_id: "empty", status: "completed", output: "", response: "legacy" }),
      request(3, "requireCompletedRun", { run_id: "tool", status: "completed", extra: 42 }),
      request(4, "requireRunText", { run_id: "partial", status: "failed", output: "partial" }),
      request(5, "requireRunText", { run_id: "tool", status: "completed" }),
    ]);
    expect(replies[0]).toMatchObject({ ok: true, result: { status: "dry_run" } });
    expect(replies[1].result).toBe("");
    expect(replies[2].result).toEqual({ run_id: "tool", status: "completed", extra: 42 });
    expect(replies[3]).toMatchObject({ ok: false, error: { type: "run", code: "run_failed" } });
    expect(replies[4]).toMatchObject({ ok: false, error: { type: "run", code: "run_output_missing" } });
  });

  it("rejects invalid arguments without losing request correlation", async () => {
    const replies = await exchange([
      request(1, "startRun", { input: [{ role: "user" }] }),
      request(2, "getRun", ""),
      request(3, "requireRunText", { status: "completed" }),
      request(4, "constructor"),
      request(5, "getRuntimeCapabilities"),
    ]);
    for (const [index, reply] of replies.slice(0, 3).entries()) {
      expect(reply).toMatchObject({ id: index + 1, ok: false, error: { code: "validation_failed" } });
    }
    expect(replies[3]).toMatchObject({ id: 4, ok: false, error: { code: "endpoint_not_found" } });
    expect(replies[4].ok).toBe(true);
  });

  it("does not expose unsupported methods or raw provider diagnostics", async () => {
    const runtime: RuntimeClient = {
      getRuntimeCapabilities: () => client().getRuntimeCapabilities(),
      startRun: async () => { throw new ApiClientError("secret credential and prompt", {
        type: "auth", code: "auth_required",
      }); },
    };
    const replies = await exchange([request(1, "describe"), request(2, "getRun", "foreign"), request(3, "startRun", { input: "x" })], runtime);
    expect(replies[0].result.operations).not.toContain("getRun");
    expect(replies[1].error.code).toBe("endpoint_not_found");
    expect(replies[2].error).toEqual({ name: "ApiClientError", message: "Runtime operation failed", type: "auth", code: "auth_required" });
  });

  it.each(["{bad}\n", '{"v":2,"id":1,"method":"describe"}\n', '{"v":1,"id":true,"method":"describe"}\n', ' '.repeat(1048577), '{"v":1}'])
  ("fails closed on malformed or oversized framing", async (bytes) => {
    const input = new PassThrough();
    const output = new PassThrough();
    output.resume();
    const serving = serveRuntimeBridge({ client: client(), input, output });
    input.end(bytes);
    await expect(serving).rejects.toMatchObject({ code: "transport_protocol_error" });
  });

  it("bounds replies and keeps the channel usable", async () => {
    const runtime: RuntimeClient = {
      getRuntimeCapabilities: () => client().getRuntimeCapabilities(),
      startRun: async () => ({ run_id: "large", status: "completed", output: "x".repeat(1048576) }),
    };
    const replies = await exchange([
      request(1, "startRun", { input: "x" }),
      request(2, "describe"),
    ], runtime);
    expect(replies[0]).toMatchObject({ ok: false, error: { code: "validation_failed" } });
    expect(replies[1].ok).toBe(true);
  });

  it("decodes UTF-8 across chunk boundaries", async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let bytes = "";
    output.on("data", (chunk) => { bytes += chunk.toString(); });
    const serving = serveRuntimeBridge({ client: client(), input, output });
    const encoded = Buffer.from(JSON.stringify(request(1, "requireRunText", { run_id: "unicode", status: "completed", output: "😀" })) + "\n");
    for (const byte of encoded) input.write(Buffer.from([byte]));
    input.end();
    await serving;
    expect(JSON.parse(bytes).result).toBe("😀");
  });
});
