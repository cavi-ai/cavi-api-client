import { getEventListeners } from "node:events";
import { describe, expect, it } from "vitest";
import { ClaudeApiClient } from "../../providers/claude/client.js";
import { CodexApiClient } from "../../providers/codex/client.js";
import { AgyApiClient } from "../../providers/agy/client.js";

const providers = [
  { name: "Claude", create: (fetchImpl: typeof fetch) => new ClaudeApiClient({ apiKey: "fixture", fetchImpl }),
    wire: 'event: message_start\ndata: {"message":{"id":"run"}}\n\nevent: message_stop\ndata: {}\n\n' },
  { name: "Codex", create: (fetchImpl: typeof fetch) => new CodexApiClient({ apiKey: "fixture", fetchImpl }),
    wire: 'event: response.created\ndata: {"response":{"id":"run"}}\n\nevent: response.completed\ndata: {"response":{"output_text":"Done"}}\n\n' },
  { name: "AGY", create: (fetchImpl: typeof fetch) => new AgyApiClient({ baseUrl: "https://agy.example", fetchImpl }),
    wire: 'data: {"run_id":"run","status":"completed","result":{"output":"Done"}}\n\n' },
];

describe.each(providers)("$name stream signal cleanup", ({ create, wire }) => {
  it("detaches listeners after every completed stream on a shared caller signal", async () => {
    const caller = new AbortController();
    const client = create(async () => new Response(wire, { headers: { "content-type": "text/event-stream" } }));
    for (let n = 0; n < 3; n += 1) {
      await client.streamRun({ model: "fixture", input: "Question" }, { onEvent() {} }, { signal: caller.signal });
      expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
    }
  });

  it("detaches listeners when the transport fails", async () => {
    const caller = new AbortController();
    const client = create(async () => { throw new Error("Connection failed"); });
    await expect(client.streamRun({ model: "fixture", input: "Question" }, { onEvent() {} }, { signal: caller.signal })).rejects.toThrow();
    expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
  });

  it("detaches listeners when an event handler rejects the stream", async () => {
    const caller = new AbortController();
    const reason = new Error("Handler failed");
    const client = create(async () => new Response(wire, { headers: { "content-type": "text/event-stream" } }));
    await expect(client.streamRun({ model: "fixture", input: "Question" }, { onEvent() { throw reason; } }, { signal: caller.signal })).rejects.toBe(reason);
    expect(getEventListeners(caller.signal, "abort")).toHaveLength(0);
  });
});
