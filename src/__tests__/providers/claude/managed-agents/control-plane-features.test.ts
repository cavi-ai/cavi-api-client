import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function client() {
  const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/memory_stores")) return json({ id: "memstore_1", data: [{ id: "mem_1", path: "/a.md" }] });
    if (u.includes("/threads")) return json({ data: [{ id: "sthr_1", status: "idle" }] });
    return json({});
  }) as unknown as typeof fetch;
  return { c: new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl }), fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

function lastBody(fetchImpl: ReturnType<typeof vi.fn>) {
  const call = fetchImpl.mock.calls.at(-1)!;
  return JSON.parse(String((call[1] as RequestInit).body));
}
function lastUrl(fetchImpl: ReturnType<typeof vi.fn>) {
  return String(fetchImpl.mock.calls.at(-1)![0]);
}

describe("ClaudeManagedAgentClient — outcomes", () => {
  it("defineOutcome sends user.define_outcome with the rubric", async () => {
    const { c, fetchImpl } = client();
    await c.defineOutcome("sesn_x", { description: "Build X", rubric: { type: "text", content: "# R" }, maxIterations: 5 });
    expect(lastUrl(fetchImpl)).toContain("/v1/sessions/sesn_x/events");
    expect(lastBody(fetchImpl)).toEqual({
      events: [{ type: "user.define_outcome", description: "Build X", rubric: { type: "text", content: "# R" }, max_iterations: 5 }],
    });
  });
});

describe("ClaudeManagedAgentClient — multiagent threads", () => {
  it("confirmTool echoes session_thread_id for cross-posted subagent calls", async () => {
    const { c, fetchImpl } = client();
    await c.confirmTool("sesn_x", { toolUseId: "sevt_1", result: "allow", sessionThreadId: "sthr_sub" });
    expect(lastBody(fetchImpl)).toEqual({
      events: [{ type: "user.tool_confirmation", tool_use_id: "sevt_1", result: "allow", session_thread_id: "sthr_sub" }],
    });
  });

  it("listThreads returns the thread list", async () => {
    const { c } = client();
    const threads = await c.listThreads("sesn_x");
    expect(threads).toEqual([{ id: "sthr_1", status: "idle" }]);
  });
});

describe("ClaudeManagedAgentClient — memory stores", () => {
  it("createMemoryStore / createMemory post the verified bodies", async () => {
    const { c, fetchImpl } = client();
    const store = await c.createMemoryStore({ name: "prefs", description: "user prefs" });
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/memory_stores");
    expect(lastBody(fetchImpl)).toEqual({ name: "prefs", description: "user prefs" });
    expect(store.id).toBe("memstore_1");

    await c.createMemory("memstore_1", { path: "/notes/a.md", content: "hello" });
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/memory_stores/memstore_1/memories");
    expect(lastBody(fetchImpl)).toEqual({ path: "/notes/a.md", content: "hello" });
  });

  it("listMemories appends path_prefix; updateMemory POSTs with a precondition", async () => {
    const { c, fetchImpl } = client();
    await c.listMemories("memstore_1", { pathPrefix: "/notes/" });
    expect(lastUrl(fetchImpl)).toBe("https://api.anthropic.com/v1/memory_stores/memstore_1/memories?path_prefix=%2Fnotes%2F");

    // Verified live: update is POST, not the docs' PATCH (which 405s).
    await c.updateMemory("memstore_1", "mem_1", { content: "v2", precondition: { type: "content_sha256", content_sha256: "abc" } });
    const call = fetchImpl.mock.calls.at(-1)!;
    expect((call[1] as RequestInit).method).toBe("POST");
    expect(lastBody(fetchImpl)).toEqual({ content: "v2", precondition: { type: "content_sha256", content_sha256: "abc" } });
  });
});
