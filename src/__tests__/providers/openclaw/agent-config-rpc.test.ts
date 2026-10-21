import { describe, expect, it, vi } from "vitest";
import { OpenClawAgentConfigApiClient } from "../../../providers/openclaw/agent-config.js";
import { ApiClientErrorCode } from "../../../core/errors.js";
import type { OpenClawRpcTransport } from "../../../providers/openclaw/client.js";

function fixture(layout: "entries" | "list" = "entries") {
  const tony = { name: "Tony", model: { primary: "provider/model" }, thinkingDefault: "medium" };
  const scout = { name: "Scout", model: "provider/other", secret: "__OPENCLAW_REDACTED__" };
  const agents: Record<string, unknown> = {
    defaults: { model: { primary: "default/model", fallbacks: ["default/fallback"] }, thinkingDefault: "low" },
    ...(layout === "entries" ? { entries: { tony, scout } } : { list: [{ id: "tony", ...tony }, { id: "scout", ...scout }] }),
  };
  const entrySchema = { type: "object", properties: {
    name: { type: "string" }, model: { anyOf: [{ type: "string" }, { type: "object" }] },
    thinkingDefault: { type: "string", enum: ["low", "medium", "high"] },
    workspace: { type: "string", readOnly: true },
    tools: { type: "object", properties: { allow: { type: "array" } } },
  } };
  let hash = "revision-1";
  const fetchImpl = vi.fn();
  const request = vi.fn(async <T>(method: string, params?: Record<string, unknown>): Promise<T> => {
    let value: unknown;
    if (method === "agents.list") value = { defaultId: "tony", agents: [
      { id: "tony", name: "Tony", workspace: "/workspace/tony" }, { id: "scout", name: "Scout" },
    ] };
    else if (method === "config.get") value = { valid: true, hash, path: "/config/openclaw.json", config: { agents } };
    else if (method === "config.schema") value = { schema: { properties: { agents: { properties: {
      [layout]: layout === "entries" ? { type: "object", additionalProperties: entrySchema } : { type: "array", items: entrySchema },
    } } } } };
    else if (method === "config.patch") {
      const patch = JSON.parse(params!.raw as string).agents;
      if (params!.baseHash !== hash) throw new Error("stale base hash");
      if (layout === "entries") {
        const entries = agents.entries as Record<string, object> | undefined ?? {};
        entries.tony ??= {};
        Object.assign(entries.tony, patch.entries.tony);
        agents.entries = entries;
      }
      else Object.assign((agents.list as Array<Record<string, unknown>>).find(agent => agent.id === "tony")!, patch.list[0]);
      hash = "revision-2";
      value = { ok: true };
    } else throw new Error(`Unexpected method: ${method}`);
    return structuredClone(value) as T;
  });
  const rpcClient: OpenClawRpcTransport = { request };
  return { client: new OpenClawAgentConfigApiClient({ baseUrl: "http://gateway.test", rpcClient, fetchImpl }), request, agents, fetchImpl };
}

describe.each(["entries", "list"] as const)("OpenClaw config RPC (%s)", layout => {
  it("projects only the selected agent and its schema without inventing inherited model parts", async () => {
    const { client, fetchImpl } = fixture(layout);
    const config = await client.getProfileConfig("tony");
    const fields = config.sections.flatMap(section => section.fields);
    expect(config).toMatchObject({ agentId: "tony", etag: "revision-1", sourcePath: "/config/openclaw.json" });
    expect(fields.find(field => field.key === "model")?.value).toEqual({ primary: "provider/model" });
    expect(fields.find(field => field.key === "thinkingDefault")?.value).toBe("medium");
    expect(fields.some(field => field.key === "model.primary")).toBe(false);
    expect(JSON.stringify(config)).not.toContain("provider/other");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("patches only this agent with the observed hash and returns a fresh snapshot", async () => {
    const { client, request, agents } = fixture(layout);
    const defaults = structuredClone(agents.defaults);
    const beforeOther = structuredClone(layout === "entries" ? (agents.entries as Record<string, unknown>).scout : (agents.list as unknown[])[1]);
    const updated = await client.patchProfileConfig("tony", { thinkingDefault: "high" }, { baseEtag: "revision-1" });
    const call = request.mock.calls.find(([method]) => method === "config.patch")!;
    expect(call[1]!.baseHash).toBe("revision-1");
    expect(JSON.parse(call[1]!.raw as string)).toEqual({ agents: layout === "entries"
      ? { entries: { tony: { thinkingDefault: "high" } } }
      : { list: [{ id: "tony", thinkingDefault: "high" }] } });
    expect(agents.defaults).toEqual(defaults);
    expect(layout === "entries" ? (agents.entries as Record<string, unknown>).scout : (agents.list as unknown[])[1]).toEqual(beforeOther);
    expect(updated.etag).toBe("revision-2");
    expect(updated.sections.flatMap(section => section.fields).find(field => field.key === "thinkingDefault")?.value).toBe("high");
  });

  it("rejects stale edits and readonly or undeclared fields before mutation", async () => {
    const { client, request } = fixture(layout);
    await expect(client.patchProfileConfig("tony", { name: "New" }, { baseEtag: "old" })).rejects.toMatchObject({ status: 409 });
    for (const diff of [{ workspace: "/new" }, { "profile.name": "New" }, { "agents.defaults.model": "other" }, { id: "scout" }]) {
      await expect(client.patchProfileConfig("tony", diff)).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
    }
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
  });
});

describe("OpenClaw config mutation boundaries", () => {
  it("uses an inherited value only when no per-agent override exists", async () => {
    const { client, agents } = fixture();
    delete ((agents.entries as Record<string, Record<string, unknown>>).tony!).thinkingDefault;
    const config = await client.getProfileConfig("tony");
    expect(config.sections.flatMap(section => section.fields).find(field => field.key === "thinkingDefault")?.value).toBe("low");
  });

  it("normalizes the target identity and preserves defaults for an implicit default agent", async () => {
    const { client, request, agents } = fixture();
    delete agents.entries;
    const original = request.getMockImplementation()!;
    request.mockImplementation(async <T>(method: string, params?: Record<string, unknown>) => method === "agents.list"
      ? { defaultId: "tony", agents: [{ id: "tony", name: "Tony" }] } as T : original<T>(method, params));
    await expect(client.patchProfileConfig(" tony ", { thinkingDefault: "high" })).resolves.toMatchObject({ agentId: "tony" });
    expect(agents.entries).toEqual({ tony: { thinkingDefault: "high" } });
    expect((agents.defaults as Record<string, unknown>).thinkingDefault).toBe("low");
  });

  it("redacts nested sensitive values and marks their field readonly", async () => {
    const { client, request, agents } = fixture();
    (agents.entries as Record<string, Record<string, unknown>>).tony!.model = { primary: "provider/model", apiKey: "sensitive-fixture" };
    const config = await client.getProfileConfig("tony");
    const model = config.sections.flatMap(section => section.fields).find(field => field.key === "model")!;
    expect(model.editable).toBe(false);
    expect(JSON.stringify(config)).not.toContain("sensitive-fixture");
    await expect(client.patchProfileConfig("tony", { model: "provider/new" })).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
  });

  it("rejects changed configuration sources and missing revision guards", async () => {
    const { client, request } = fixture();
    await expect(client.patchProfileConfig("tony", { name: "New" }, { sourcePath: "/other.json" })).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
    const original = request.getMockImplementation()!;
    request.mockImplementation(async <T>(method: string, params?: Record<string, unknown>) => {
      const result = await original<T>(method, params);
      if (method === "config.get") delete (result as Record<string, unknown>).hash;
      return result;
    });
    await expect(client.patchProfileConfig("tony", { name: "New" })).rejects.toMatchObject({ code: ApiClientErrorCode.TransportProtocolError });
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
  });

  it("rejects missing agents and malformed snapshots without writing", async () => {
    const { client, request } = fixture();
    await expect(client.getProfileConfig("absent")).rejects.toMatchObject({ code: ApiClientErrorCode.EndpointNotFound });
    const original = request.getMockImplementation()!;
    request.mockImplementation(async <T>(method: string, params?: Record<string, unknown>) =>
      method === "config.get" ? { valid: false, hash: "h", config: {} } as T : original<T>(method, params));
    await expect(client.patchProfileConfig("tony", { name: "New" })).rejects.toMatchObject({ code: ApiClientErrorCode.InvalidConfig });
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
  });

  it("rejects prototype paths, secret values, and non-JSON values", async () => {
    const { client, request } = fixture();
    for (const diff of [
      { "__proto__.polluted": true }, { "constructor.prototype.polluted": true },
      { model: "__OPENCLAW_REDACTED__" }, { model: { apiKey: "secret" } },
      { thinkingDefault: Number.NaN },
    ]) {
      await expect(client.patchProfileConfig("tony", diff)).rejects.toMatchObject({ code: ApiClientErrorCode.ValidationFailed });
    }
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("does not dispatch a write for an empty patch", async () => {
    const { client, request } = fixture();
    await expect(client.patchProfileConfig("tony", {})).resolves.toMatchObject({ agentId: "tony" });
    expect(request.mock.calls.some(([method]) => method === "config.patch")).toBe(false);
  });

  it("retains RPC failures and never retries mutations", async () => {
    const { client, request } = fixture();
    const original = request.getMockImplementation()!;
    const failure = new Error("write failed");
    request.mockImplementation(async <T>(method: string, params?: Record<string, unknown>) => {
      if (method === "config.patch") throw failure;
      return original<T>(method, params);
    });
    await expect(client.patchProfileConfig("tony", { name: "New" })).rejects.toBe(failure);
    expect(request.mock.calls.filter(([method]) => method === "config.patch")).toHaveLength(1);
  });
});
