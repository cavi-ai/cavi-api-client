import { describe, expect, it, vi } from "vitest";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import { ApiClientError, ApiClientErrorCode } from "../../core/errors.js";
import { createTeamDirectory } from "../../core/teams/directory.js";
import type { RuntimeClient } from "../../core/runtime/client.js";
import type { RuntimeControlClient } from "../../core/runtime/control-plane/runtime-control-client.js";
import type { KanbanClient } from "../../core/kanban/client.js";
import type { ResolvedProviderCapabilities } from "../../contracts/capability-source.js";
import { normalizeTeamManifest } from "../../contracts/team-manifest.js";

const runtime: RuntimeClient = {
  getRuntimeCapabilities: async () => ({ providerKind: "test", supports: { runs: true } }),
  startRun: async () => ({ id: "run-1", status: "queued" }) as never,
};

function fakeControlPlane(): RuntimeControlClient {
  return {
    sessions: {
      listSessions: vi.fn(async () => ({ data: [{ id: "s1" }] })),
      getSession: vi.fn(),
      cancelSession: vi.fn(),
    },
    tasks: { listTasks: vi.fn(), getTask: vi.fn(), cancelTask: vi.fn() },
    events: { subscribe: vi.fn() },
    models: { listModels: vi.fn() },
    usage: { getUsage: vi.fn() },
    authStatus: { listAuthStatus: vi.fn() },
    workspace: { listWorkspaces: vi.fn(), getWorkspace: vi.fn() },
    extensions: { get: () => undefined, list: () => [] } as never,
    dispose: vi.fn(async () => undefined),
  } as unknown as RuntimeControlClient;
}

function fakeKanban(withExtended = false): KanbanClient {
  return {
    listBoards: vi.fn(async () => [{ id: "b1", title: "Board" }]) as never,
    listCards: vi.fn(async () => ({ cards: [] })) as never,
    createCard: vi.fn() as never,
    updateCard: vi.fn() as never,
    moveCard: vi.fn() as never,
    deleteCard: vi.fn() as never,
    ...(withExtended
      ? { extended: { claim: vi.fn(async () => ({ id: "c1" })) as never } }
      : {}),
  };
}

describe("capability client — non-throwing single surface", () => {
  it("every accessor exists; unsupported calls resolve ok:false with a notated gap", async () => {
    const client = createCapabilityClient({
      providerKind: "gemini",
      runtime,
      fallbackSupports: { runs: true },
      availableOn: (key) => (key === "sessions" ? ["hermes", "openclaw"] : []),
    });

    const result = await client.sessions.listSessions({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.data).toBeNull();
    expect(result.gap.reason).toBe("capability-unsupported");
    expect(result.gap.note).toContain('provider "gemini" does not support capability "sessions"');
    expect(result.gap.note).toContain("available on     : hermes, openclaw");
    expect(result.gap.note).toContain("client.sessions.listSessions()");
    expect(result.gap.note).toContain('capability "sessions" is not declared');
  });

  it("wraps supported backend calls in ok:true live results", async () => {
    const plane = fakeControlPlane();
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true, kanban: true },
      backends: { controlPlane: plane, kanban: fakeKanban() },
    });

    await expect(client.sessions.listSessions({})).resolves.toEqual({
      ok: true,
      source: "live",
      data: { data: [{ id: "s1" }] },
    });
    const boards = await client.kanban.listBoards();
    expect(boards).toEqual({ ok: true, source: "live", data: [{ id: "b1", title: "Board" }] });
  });

  it("classifies supported-but-failing backend calls into gaps instead of throwing", async () => {
    const plane = fakeControlPlane();
    (plane.sessions.listSessions as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("fetch failed: ECONNREFUSED"),
    );
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true },
      backends: { controlPlane: plane },
    });

    const result = await client.sessions.listSessions({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.reason).toBe("backend-unavailable");
  });

  it("missing wired backend resolves ok:false, never rejects", async () => {
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { media: true },
    });
    const result = await client.media.listMediaProviders();
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.reason).toBe("capability-unsupported");
    expect(result.gap.note).toContain("no media backend is wired");
  });

  it("a supported control-plane capability without a wired backend resolves informatively", async () => {
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true },
    });
    const result = await client.sessions.listSessions({});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.gap.note).toContain("no control-plane backend is wired");
  });

  it("delegates supported control-plane calls to their backend surfaces", async () => {
    const plane = fakeControlPlane();
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true },
      backends: { controlPlane: plane },
    });
    await client.sessions.listSessions({});
    expect(plane.sessions.listSessions).toHaveBeenCalledTimes(1);
  });

  it("runtime resolution is authoritative over the static fallback", async () => {
    const resolvedOn: ResolvedProviderCapabilities = {
      providerKind: "openclaw",
      supports: { kanban: true },
      manifest: normalizeTeamManifest(null),
    };
    const flipsOn = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: {},
      resolver: async () => resolvedOn,
      backends: { kanban: fakeKanban() },
    });
    const onResult = await flipsOn.kanban.listBoards();
    expect(onResult.ok).toBe(true);

    const flipsOff = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      resolver: async () => ({ ...resolvedOn, supports: { kanban: false } }),
      backends: { kanban: fakeKanban() },
    });
    const offResult = await flipsOff.kanban.listBoards();
    expect(offResult.ok).toBe(false);
    if (offResult.ok) throw new Error("unreachable");
    expect(offResult.gap.reason).toBe("capability-unsupported");
  });

  it("resolver transport failures degrade to the fallback; auth errors surface", async () => {
    const degraded = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      resolver: async () => {
        throw new Error("socket closed");
      },
      backends: { kanban: fakeKanban() },
    });
    const degradedResult = await degraded.kanban.listBoards();
    expect(degradedResult.ok).toBe(true);

    const authFailed = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      resolver: async () => {
        throw new ApiClientError("forbidden", { code: ApiClientErrorCode.AuthForbidden });
      },
      backends: { kanban: fakeKanban() },
    });
    // Auth carve-out: the resolver's auth failure rejects the call itself.
    await expect(authFailed.kanban.listBoards()).rejects.toMatchObject({
      code: ApiClientErrorCode.AuthForbidden,
    });
  });

  it("exposes the merged capability map and the runtime manifest", async () => {
    const manifest = normalizeTeamManifest({
      version: 1,
      teams: [{ id: "fleet-a" }],
    });
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { runs: true, media: false },
      resolver: async () => ({
        providerKind: "hermes",
        supports: { media: true, wiki: true },
        manifest,
      }),
    });

    const map = await client.getCapabilityMap();
    expect(map.supports).toEqual({ runs: true, media: true, wiki: true });
    await expect(client.getManifest()).resolves.toBe(manifest);
  });

  it("passes the universal execution surface through untouched", async () => {
    const client = createCapabilityClient({
      providerKind: "claude",
      runtime,
      fallbackSupports: { runs: true },
    });
    await expect(client.startRun({} as never)).resolves.toMatchObject({ id: "run-1" });
    // Optional methods absent on the runtime stay absent — capability
    // detection for the execution surface keeps RuntimeClient semantics.
    expect(client.getRun).toBeUndefined();
    expect(client.submitBatch).toBeUndefined();
  });

  it("kanban.extended is a gated surface — result-shaped, never a silent no-op", async () => {
    const withExtended = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      backends: { kanban: fakeKanban(true) },
    });
    await expect(withExtended.kanban.extended.claim("c1", "agent")).resolves.toEqual({
      ok: true,
      source: "live",
      data: { id: "c1" },
    });

    const withoutExtended = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { kanban: true },
      backends: { kanban: fakeKanban(false) },
    });
    const missing = await withoutExtended.kanban.extended.claim("c1", "agent");
    expect(missing.ok).toBe(false);
    if (missing.ok) throw new Error("unreachable");
    expect(missing.gap.reason).toBe("capability-unsupported");
    expect(missing.gap.note).toContain("backend does not implement extended claim");
  });

  it("teams is an async gated surface resolving results", async () => {
    const directory = createTeamDirectory([
      {
        id: "team-1",
        identity: { name: "Team One", slug: "team-one", code: "t1", aliases: [] },
        members: [],
        capabilities: [],
      } as never,
    ]);
    const supported = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { teams: true },
      backends: { teams: directory },
    });
    const listed = await supported.teams.listTeams();
    expect(listed.ok).toBe(true);
    if (!listed.ok) throw new Error("unreachable");
    expect(listed.data).toHaveLength(1);

    const unsupported = createCapabilityClient({
      providerKind: "gemini",
      runtime,
      fallbackSupports: {},
      backends: { teams: directory },
    });
    const denied = await unsupported.teams.listTeams();
    expect(denied.ok).toBe(false);
  });

  it("teams surface is async and gated without unhandled rejections", async () => {
    const client = createCapabilityClient({
      providerKind: "gemini",
      runtime,
      fallbackSupports: {},
      resolver: async () => {
        throw Object.assign(new Error("unauthorized"), { status: 401 });
      },
    });
    // Unsupported + auth-rejecting resolver: auth surfaces as a rejection of
    // the CALL (the carve-out), not as an unhandled background rejection.
    await expect(client.teams.listTeams()).rejects.toThrow();
  });

  it("media/wiki/agentConfig are first-class gated surfaces", async () => {
    const media = { listMediaProviders: vi.fn(async () => ({ providers: [] })) };
    const wiki = { listWikiVaults: vi.fn(async () => ({ vaults: [] })) };
    const agentConfig = { listProfiles: vi.fn(async () => []) };
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { media: true, wiki: true },
      backends: {
        media: media as never,
        wiki: wiki as never,
        agentConfig: agentConfig as never,
      },
    });

    await expect(client.media.listMediaProviders()).resolves.toEqual({
      ok: true,
      source: "live",
      data: { providers: [] },
    });
    await expect(client.wiki.listWikiVaults()).resolves.toEqual({
      ok: true,
      source: "live",
      data: { vaults: [] },
    });
    // agentConfig is undeclared — the call exists and resolves ok:false despite
    // a wired backend (support gating comes first).
    const denied = await client.agentConfig.listProfiles();
    expect(denied.ok).toBe(false);
    expect(agentConfig.listProfiles).not.toHaveBeenCalled();
  });

  it("a runtime resolution can enable a plugin-gated media surface", async () => {
    const media = { listMediaProviders: vi.fn(async () => ({ providers: ["tts"] })) };
    const client = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { media: false },
      resolver: async () => ({
        providerKind: "openclaw",
        supports: { media: true },
        manifest: normalizeTeamManifest(null),
      }),
      backends: { media: media as never },
    });
    await expect(client.media.listMediaProviders()).resolves.toEqual({
      ok: true,
      source: "live",
      data: { providers: ["tts"] },
    });
  });

  it("the facade never throws CapabilityUnavailable", async () => {
    const client = createCapabilityClient({ providerKind: "codex", runtime, fallbackSupports: {} });
    const results = await Promise.all([
      client.kanban.listBoards(),
      client.media.listMediaProviders(),
      client.wiki.listWikiVaults(),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
    }
  });

  it("disposes an instantiated control plane exactly once", async () => {
    const plane = fakeControlPlane();
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true },
      backends: { controlPlane: plane },
    });
    await client.sessions.listSessions({});
    await client.dispose();
    expect(plane.dispose).toHaveBeenCalledTimes(1);
  });
});
