import { describe, expect, it, vi } from "vitest";
import { ClaudeManagedAgentClient } from "../../../../providers/claude/managed-agents/client";
import { ApiClientErrorCode, getErrorCode } from "../../../../core/errors";

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const DEFAULTS = { apiKey: "sk-test", agentId: "agent_x", environmentId: "env_x" } as const;

describe("ClaudeManagedAgentClient", () => {
  it("declares a stateful runtime capability profile with the beta protocol version", async () => {
    const client = new ClaudeManagedAgentClient({ ...DEFAULTS, fetchImpl: vi.fn() });
    const caps = await client.getRuntimeCapabilities();
    expect(caps.providerKind).toBe("claude-managed-agents");
    expect(caps.supports.runs).toBe(true);
    expect(caps.supports.streaming).toBe(true);
    expect(caps.protocolVersion).toBe("managed-agents-2026-04-01");
    expect(caps.auth?.type).toBe("api-key");
  });

  it("startRun creates a session then sends the kickoff and returns started", async () => {
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith("/v1/sessions") && init?.method === "POST") {
        return json({ id: "sesn_1", status: "running", model: "claude-opus-4-8" });
      }
      if (/\/v1\/sessions\/sesn_1\/events$/u.test(u) && init?.method === "POST") {
        return json({});
      }
      throw new Error(`unexpected ${init?.method} ${u}`);
    }) as unknown as typeof fetch;

    const client = new ClaudeManagedAgentClient({ ...DEFAULTS, fetchImpl });
    const status = await client.startRun({ input: "Hello", metadata: { title: "T" } });

    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const create = calls[0]!;
    expect(String(create[0])).toBe("https://api.anthropic.com/v1/sessions");
    const headers = (create[1] as RequestInit).headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-beta"]).toBe("managed-agents-2026-04-01");
    expect(JSON.parse(String((create[1] as RequestInit).body))).toEqual({
      agent: "agent_x",
      environment_id: "env_x",
      title: "T",
    });

    const kickoff = JSON.parse(String((calls[1]![1] as RequestInit).body));
    expect(kickoff).toEqual({
      events: [{ type: "user.message", content: [{ type: "text", text: "Hello" }] }],
    });

    expect(status).toEqual({ run_id: "sesn_1", status: "started", model: "claude-opus-4-8" });
  });

  it("per-run metadata overrides the default agent and environment", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "sesn_2", status: "running" })) as unknown as typeof fetch;
    const client = new ClaudeManagedAgentClient({ ...DEFAULTS, fetchImpl });
    await client.startRun({ input: "hi", metadata: { agent_id: "agent_y", environment_id: "env_y" } });
    const body = JSON.parse(
      String(((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![1] as RequestInit).body),
    );
    expect(body).toMatchObject({ agent: "agent_y", environment_id: "env_y" });
  });

  it("getRun maps a live session status (idle -> completed) and surfaces usage", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ id: "sesn_1", status: "idle", usage: { input_tokens: 3 } }),
    ) as unknown as typeof fetch;
    const client = new ClaudeManagedAgentClient({ ...DEFAULTS, fetchImpl });
    const status = await client.getRun("sesn_1");
    expect(status).toEqual({ run_id: "sesn_1", status: "completed", usage: { input_tokens: 3 } });
  });

  it("cancelRun interrupts the session", async () => {
    const fetchImpl = vi.fn(async () => json({})) as unknown as typeof fetch;
    const client = new ClaudeManagedAgentClient({ ...DEFAULTS, fetchImpl });
    const result = await client.cancelRun("sesn_1");
    expect(result).toEqual({ status: "cancelled" });
    const call = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(String(call[0])).toBe("https://api.anthropic.com/v1/sessions/sesn_1/events");
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      events: [{ type: "user.interrupt" }],
    });
  });

  it("startRun throws ValidationFailed when no agent or environment can be resolved", async () => {
    const client = new ClaudeManagedAgentClient({ apiKey: "sk-test", fetchImpl: vi.fn() });
    await expect(client.startRun({ input: "hi" })).rejects.toSatisfy(
      (e: unknown) => getErrorCode(e) === ApiClientErrorCode.ValidationFailed,
    );
  });
});
