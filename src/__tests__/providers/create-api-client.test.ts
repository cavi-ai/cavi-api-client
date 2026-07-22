import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "../../providers/create-api-client.js";
import { createRuntimeProviderRegistry } from "../../core/runtime/providers/registry.js";
import type { RuntimeClient } from "../../core/runtime/client.js";

const fakeRuntime: RuntimeClient = {
  getRuntimeCapabilities: async () => ({
    providerKind: "gemini",
    supports: { runs: true },
  }),
  startRun: async () => ({ id: "run-9", status: "queued" }) as never,
};

const geminiRegistry = createRuntimeProviderRegistry({
  modules: [{ kind: "gemini", createClient: () => fakeRuntime }],
});

const HERMES_ENVELOPE = {
  object: "hermes.api_server.capabilities",
  platform: "hermes-agent",
  model: "tony",
  features: { run_submission: true, run_events_sse: true },
  endpoints: { models: { method: "GET", path: "/v1/models" } },
  extensions: {
    plugins: {
      "cavi-control": {
        endpoints: {
          machine_media: { method: "GET", path: "/api/plugins/machine/media" },
        },
      },
    },
  },
};

describe("createApiClient — the one front door", () => {
  it("returns the full surface for a runtime-only provider; unsupported is notated", async () => {
    const client = createApiClient("gemini", { registry: geminiRegistry });
    await expect(client.startRun({} as never)).resolves.toMatchObject({
      ok: true,
      data: { id: "run-9" },
    });

    const result = await client.kanban.listBoards();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    const note = result.gap.note;
    expect(note).toContain('provider "gemini" does not support capability "kanban"');
    expect(note).toContain("hermes");
    expect(note).toContain("openclaw");
  });

  it("uses the static declarations as the fallback profile", async () => {
    const client = createApiClient("gemini", { registry: geminiRegistry });
    const map = await client.getCapabilityMap();
    // Gemini's declaration: execution only.
    expect(map.supports).toEqual({ runs: true, streaming: true, batch: true });
  });

  it("throws the standard configuration error for unknown providers", () => {
    expect(() => createApiClient("nonsense", { registry: geminiRegistry })).toThrow(
      /Unknown runtime provider/,
    );
  });

  it("auto-wires the Hermes resolver from baseUrl + token", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/v1/capabilities")) {
        return new Response(JSON.stringify(HERMES_ENVELOPE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response("{}", {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const client = createApiClient("hermes", {
      baseUrl: "http://gateway.test",
      token: "secret",
      fetchImpl: fetchImpl as typeof fetch,
    });

    const map = await client.getCapabilityMap();
    // Runtime resolution (media via the plugin route) merged over the static
    // gateway fallback (teams stays declared by the fallback).
    expect(map.supports.media).toBe(true);
    expect(map.supports.teams).toBe(true);
    const manifest = await client.getManifest();
    expect(manifest).not.toBeNull();
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("caller-supplied backends override the auto-wiring", async () => {
    const kanban = { listBoards: vi.fn(async () => [{ id: "b9" }]) };
    const client = createApiClient("gemini", {
      registry: geminiRegistry,
      fallbackSupports: { runs: true, kanban: true },
      backends: { kanban: kanban as never },
    });
    await expect(client.kanban.listBoards()).resolves.toEqual({
      ok: true,
      source: "live",
      data: [{ id: "b9" }],
    });
  });

  it("openclaw without a socket keeps the surface but fails informatively", async () => {
    // A registry whose openclaw module needs no baseUrl isolates the wiring
    // path: no ws/baseUrl → no auto backends → supported-but-unwired is loud.
    const registry = createRuntimeProviderRegistry({
      modules: [{ kind: "openclaw", createClient: () => fakeRuntime }],
    });
    const client = createApiClient("openclaw", { registry });
    const result = await client.kanban.listBoards();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.note).toContain("no kanban backend is wired");
  });
});
