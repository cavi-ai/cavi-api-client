import { describe, expect, it, vi } from "vitest";
import { createCapabilityClient } from "../../contracts/capability-client.js";
import { CapabilityUnavailable } from "../../core/runtime/control-plane/runtime-control-client.js";
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

describe("capability client — the single surface", () => {
  it("every accessor exists; unsupported calls throw one notated error", async () => {
    const client = createCapabilityClient({
      providerKind: "gemini",
      runtime,
      fallbackSupports: { runs: true },
      availableOn: (key) => (key === "sessions" ? ["hermes", "openclaw"] : []),
    });

    // The accessor is present — the call exists, failure is loud and notated.
    const failure = await client.sessions.listSessions({}).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CapabilityUnavailable);
    const message = (failure as Error).message;
    expect(message).toContain('provider "gemini" does not support capability "sessions"');
    expect(message).toContain("available on     : hermes, openclaw");
    expect(message).toContain("client.sessions.listSessions()");
    expect(message).toContain('capability "sessions" is not declared');
  });

  it("delegates supported capabilities to their backends", async () => {
    const plane = fakeControlPlane();
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true, kanban: true },
      backends: { controlPlane: plane, kanban: fakeKanban() },
    });

    await expect(client.sessions.listSessions({})).resolves.toEqual({
      data: [{ id: "s1" }],
    });
    await expect(client.kanban.listBoards()).resolves.toEqual([
      { id: "b1", title: "Board" },
    ]);
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
    await expect(flipsOn.kanban.listBoards()).resolves.toBeDefined();

    const flipsOff = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      resolver: async () => ({ ...resolvedOn, supports: { kanban: false } }),
      backends: { kanban: fakeKanban() },
    });
    await expect(flipsOff.kanban.listBoards()).rejects.toBeInstanceOf(
      CapabilityUnavailable,
    );
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
    await expect(degraded.kanban.listBoards()).resolves.toBeDefined();

    const authFailed = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      resolver: async () => {
        throw new ApiClientError("forbidden", { code: ApiClientErrorCode.AuthForbidden });
      },
      backends: { kanban: fakeKanban() },
    });
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

  it("kanban.extended is a gated surface — loud, never a silent no-op", async () => {
    const withExtended = createCapabilityClient({
      providerKind: "openclaw",
      runtime,
      fallbackSupports: { kanban: true },
      backends: { kanban: fakeKanban(true) },
    });
    await expect(withExtended.kanban.extended!.claim!("c1", "agent")).resolves.toEqual({
      id: "c1",
    });

    const withoutExtended = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { kanban: true },
      backends: { kanban: fakeKanban(false) },
    });
    await expect(
      withoutExtended.kanban.extended!.claim!("c1", "agent"),
    ).rejects.toBeInstanceOf(CapabilityUnavailable);
  });

  it("teams is a sync surface gated on declared support", () => {
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
    expect(supported.teams.listTeams()).toHaveLength(1);

    const unsupported = createCapabilityClient({
      providerKind: "gemini",
      runtime,
      fallbackSupports: {},
      backends: { teams: directory },
    });
    expect(() => unsupported.teams.listTeams()).toThrow(CapabilityUnavailable);
  });

  it("a supported capability without a wired backend fails informatively", async () => {
    const client = createCapabilityClient({
      providerKind: "hermes",
      runtime,
      fallbackSupports: { sessions: true },
    });
    const failure = await client.sessions.listSessions({}).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(CapabilityUnavailable);
    expect((failure as Error).message).toContain("no control-plane backend is wired");
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
