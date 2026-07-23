import { describe, expect, it } from "vitest";
import { createHermesCapabilityResolver } from "../../providers/hermes/capability-resolver.js";
import { createOpenClawCapabilityResolver } from "../../providers/openclaw/capability-resolver.js";
import { findTeamManifestTeam } from "../../contracts/team-manifest.js";

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
          obsidian_tree: { method: "GET", path: "/api/obsidian/tree" },
        },
      },
    },
  },
};

const OPENCLAW_HELLO = {
  type: "hello-ok",
  protocol: 4,
  features: { methods: ["chat.send", "workboard.cards.list"], events: ["tick"] },
};

describe("hermes capability resolver", () => {
  it("fetches the capabilities endpoint with auth and transforms it", async () => {
    const requests: { url: string; auth: string | null }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      requests.push({ url: String(input), auth: headers.get("authorization") });
      return new Response(JSON.stringify(HERMES_ENVELOPE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const resolve = createHermesCapabilityResolver({
      baseUrl: "http://gateway.test",
      token: "secret-token",
      fetchImpl,
      teamId: "fleet-a",
    });
    const resolved = await resolve();

    expect(requests).toHaveLength(1);
    expect(requests[0]!.url).toContain("/v1/capabilities");
    expect(requests[0]!.auth).toBe("Bearer secret-token");
    expect(resolved.providerKind).toBe("hermes");
    expect(resolved.supports.runs).toBe(true);
    expect(resolved.supports.media).toBe(true);
    expect(resolved.supports.wiki).toBe(true);
    expect(findTeamManifestTeam(resolved.manifest, "fleet-a")).not.toBeNull();
  });
});

describe("openclaw capability resolver", () => {
  it("reads a retained handshake and transforms it", async () => {
    const resolve = createOpenClawCapabilityResolver({
      getHelloFrame: () => OPENCLAW_HELLO,
    });
    const resolved = await resolve();
    expect(resolved.providerKind).toBe("openclaw");
    expect(resolved.supports).toEqual({
      runs: true,
      streaming: true,
      kanban: true,
      events: true,
    });
  });

  it("connects first when no handshake is retained yet", async () => {
    let hello: unknown = null;
    const resolve = createOpenClawCapabilityResolver({
      getHelloFrame: () => hello,
      connect: async () => {
        hello = OPENCLAW_HELLO;
      },
    });
    const resolved = await resolve();
    expect(resolved.supports.kanban).toBe(true);
  });

  it("throws a clear error when no handshake is available", async () => {
    const resolve = createOpenClawCapabilityResolver({ getHelloFrame: () => null });
    await expect(resolve()).rejects.toThrow(/connected gateway handshake/);
  });
});
