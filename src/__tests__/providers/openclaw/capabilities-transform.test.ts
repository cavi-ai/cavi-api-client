import { describe, it, expect } from "vitest";
import { transformOpenClawHello } from "../../../providers/openclaw/capabilities-transform.js";
import {
  resolveTeamActionApiPath,
  findTeamManifestTeam,
} from "../../../contracts/team-manifest.js";

/** Fixture mirroring the gateway's canonical hello-ok frame shape. */
function helloOk(methods: string[], events: string[] = ["connect.challenge"]) {
  return {
    type: "hello-ok",
    protocol: 4,
    server: { version: "test", connId: "conn-1" },
    features: { methods, events },
    snapshot: {},
    auth: { role: "operator", scopes: ["operator.read"] },
    policy: { maxPayload: 1_000_000, maxBufferedBytes: 1_000_000, tickIntervalMs: 60_000 },
  };
}

const ADVERTISED = [
  "chat.send",
  "sessions.list",
  "sessions.describe",
  "tasks.list",
  "models.list",
  "models.authStatus",
  "usage.status",
  "workboard.cards.list",
  "agents.list",
  "tts.speak",
  "config.get",
];

describe("openclaw hello-ok transform", () => {
  it("rejects frames that fail schema validation", () => {
    expect(() => transformOpenClawHello(null)).toThrow(/schema validation/);
    expect(() => transformOpenClawHello({ type: "hello-ok" })).toThrow(/schema validation/);
    expect(() => transformOpenClawHello({ type: "res", protocol: 4 })).toThrow(
      /schema validation/,
    );
  });

  it("infers supports from advertised method prefixes", () => {
    const resolved = transformOpenClawHello(helloOk(ADVERTISED));
    expect(resolved.providerKind).toBe("openclaw");
    expect(resolved.supports).toEqual({
      runs: true,
      streaming: true,
      sessions: true,
      tasks: true,
      models: true,
      authStatus: true,
      usage: true,
      kanban: true,
      workspace: true,
      media: true,
      agentConfig: true,
      events: true,
    });
    // Unmentioned keys stay undefined so the static fallback decides them.
    expect(resolved.supports.wiki).toBeUndefined();
    expect(resolved.supports.batch).toBeUndefined();
    expect(resolved.supports.teams).toBeUndefined();
  });

  it("detects the memory-wiki plugin's wiki.* methods", () => {
    const resolved = transformOpenClawHello(
      helloOk([...ADVERTISED, "wiki.status", "wiki.compile", "wiki.ingest"]),
    );
    expect(resolved.supports.wiki).toBe(true);
  });

  it("detects operator/discourse plugin methods by name", () => {
    const resolved = transformOpenClawHello(
      helloOk(["cavi.operator.status", "cavi.operator.task.discourse"], []),
    );
    expect(resolved.supports.operator).toBe(true);
    expect(resolved.supports.discourse).toBe(true);
    expect(resolved.supports.events).toBeUndefined();
  });

  it("stays minimal when nothing is advertised", () => {
    const resolved = transformOpenClawHello(helloOk([], []));
    expect(resolved.supports).toEqual({});
  });

  it("publishes NO HTTP media/wiki actions — those capabilities are RPC-backed", () => {
    const { manifest } = transformOpenClawHello(helloOk(ADVERTISED));
    const team = findTeamManifestTeam(manifest, "openclaw");
    const ids = team?.actions?.map((action) => action.id) ?? [];
    expect(ids).not.toContain("media_root");
    expect(ids).not.toContain("wiki_root");
    expect(ids).not.toContain("wiki_vaults");
  });

  it("converts rest-table param tokens and resolves them with params", () => {
    const { manifest } = transformOpenClawHello(helloOk(ADVERTISED));
    expect(
      resolveTeamActionApiPath(manifest, "openclaw", "sessionHistory", {
        params: { sessionKey: "abc" },
      }),
    ).toBe("/sessions/abc/history");
  });

  it("skips runtime aliases and doc-wildcard rest entries", () => {
    const { manifest } = transformOpenClawHello(helloOk(ADVERTISED));
    const team = findTeamManifestTeam(manifest, "openclaw");
    const ids = new Set(team?.actions?.map((action) => action.id));
    expect(ids.has("openaiChatCompletions")).toBe(false); // v1 runtime alias
    expect(ids.has("managedMediaOutgoing")).toBe(false); // "..." doc wildcard
    expect(ids.has("mcpWellKnown")).toBe(false); // "*" doc wildcard
    expect(ids.has("hooksWake")).toBe(false); // "<basePath>" doc entry
  });

  it("honors a custom team id", () => {
    const { manifest } = transformOpenClawHello(helloOk([]), { teamId: "fleet-b" });
    expect(findTeamManifestTeam(manifest, "fleet-b")).not.toBeNull();
  });
});
