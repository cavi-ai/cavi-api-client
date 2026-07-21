import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { transformHermesCapabilities } from "../../../providers/hermes/capabilities-transform.js";
import {
  resolveTeamActionApiPath,
  findTeamManifestTeam,
  findTeamManifestMember,
} from "../../../contracts/team-manifest.js";

/**
 * Fixture mirroring the live Hermes API-server envelope: the top level comes
 * from the api_server capabilities handler; the plugin extension mirrors the
 * control plugin's canonical endpoint map. Agent/portal names here are DATA
 * simulating a provider response — the transform source must contain none.
 */
const FIXTURE = {
  object: "hermes.api_server.capabilities",
  platform: "hermes-agent",
  model: "tony",
  auth: { type: "bearer", required: true },
  features: {
    chat_completions: true,
    chat_completions_streaming: true,
    responses_api: true,
    responses_streaming: true,
    run_submission: true,
    run_status: true,
    run_events_sse: true,
    run_stop: true,
  },
  endpoints: {
    health: { method: "GET", path: "/health" },
    models: { method: "GET", path: "/v1/models" },
    runs: { method: "POST", path: "/v1/runs" },
  },
  extensions: {
    plugins: {
      "cavi-control": {
        features: { cavi_compatibility: { canonical_routes: true } },
        endpoints: {
          machine_comedy_run: { method: "POST", path: "/v1/runs" },
          machine_media: { method: "GET", path: "/api/plugins/machine/media" },
          machine_tts: { method: "POST", path: "/api/plugins/machine/tts" },
          kanban_tasks: { method: "GET|POST", path: "/api/plugins/kanban/tasks" },
          operator_status: {
            method: "GET",
            path: "/api/plugins/cavi-control/operator/status",
          },
          operator_task: {
            method: "GET",
            path: "/api/plugins/cavi-control/operator/tasks/{task_id}",
          },
          operator_task_discourse: {
            method: "GET",
            path: "/api/plugins/cavi-control/operator/tasks/{task_id}/discourse",
          },
          deb_workspace: { method: "GET", path: "/api/plugins/cavi-control/deb" },
          cost_history: {
            method: "GET",
            path: "/api/plugins/cavi-control/cost/history",
          },
          session_list: { method: "GET|POST", path: "/api/sessions/list" },
          session_usage: { method: "GET|POST", path: "/api/sessions/usage" },
          obsidian_tree: { method: "GET", path: "/api/obsidian/tree" },
          martina_dashboard: {
            method: "GET",
            path: "/api/plugins/portal/martina/dashboard",
          },
          martina_config: {
            method: "GET|POST",
            path: "/api/plugins/portal/martina/config",
          },
          library_search: { method: "GET", path: "/api/plugins/library/search" },
        },
      },
    },
  },
};

describe("hermes capabilities transform", () => {
  it("rejects payloads that fail the envelope schema", () => {
    expect(() => transformHermesCapabilities(null)).toThrow(/schema validation/);
    expect(() =>
      transformHermesCapabilities({ object: "wrong", platform: "hermes-agent" }),
    ).toThrow(/schema validation/);
  });

  it("infers supports conservatively from features + endpoint shapes", () => {
    const resolved = transformHermesCapabilities(FIXTURE);
    expect(resolved.providerKind).toBe("hermes");
    expect(resolved.supports).toEqual({
      runs: true,
      streaming: true,
      events: true,
      models: true,
      media: true,
      kanban: true,
      tasks: true,
      operator: true,
      discourse: true,
      workspace: true,
      sessions: true,
      usage: true,
      wiki: true,
      agentConfig: true,
    });
    // Unmentioned keys stay undefined so the static fallback fills them.
    expect(resolved.supports.batch).toBeUndefined();
    expect(resolved.supports.teams).toBeUndefined();
    expect(resolved.supports.authStatus).toBeUndefined();
  });

  it("extracts portal and workspace members dynamically from paths", () => {
    const { manifest } = transformHermesCapabilities(FIXTURE);
    const team = findTeamManifestTeam(manifest, "hermes");
    expect(team).not.toBeNull();

    const portal = findTeamManifestMember(team!, "martina");
    expect(portal?.metadata).toEqual({ kind: "portal" });
    expect(portal?.actions?.map((action) => action.id).sort()).toEqual([
      "config",
      "dashboard",
    ]);

    const workspace = findTeamManifestMember(team!, "deb");
    expect(workspace?.metadata).toEqual({ kind: "workspace" });
    expect(workspace?.actions?.map((action) => action.id)).toEqual(["workspace"]);
  });

  it("resolves provider-published paths through the manifest machinery", () => {
    const { manifest } = transformHermesCapabilities(FIXTURE);
    expect(
      resolveTeamActionApiPath(manifest, "hermes", "dashboard", { memberId: "martina" }),
    ).toBe("/api/plugins/portal/martina/dashboard");
    expect(resolveTeamActionApiPath(manifest, "hermes", "machine_media")).toBe(
      "/api/plugins/machine/media",
    );
    expect(
      resolveTeamActionApiPath(manifest, "hermes", "operator_task", {
        params: { task_id: "t1" },
      }),
    ).toBe("/api/plugins/cavi-control/operator/tasks/t1");
  });

  it("keeps the first method of a pipe list and records the full list", () => {
    const { manifest } = transformHermesCapabilities(FIXTURE);
    const team = findTeamManifestTeam(manifest, "hermes");
    const kanban = team?.actions?.find((action) => action.id === "kanban_tasks");
    expect(kanban?.route?.method).toBe("GET");
    expect(kanban?.metadata?.methods).toEqual(["GET", "POST"]);
    expect(kanban?.capabilities).toEqual(expect.arrayContaining(["kanban", "tasks"]));
  });

  it("skips core runtime aliases advertised by plugins", () => {
    const { manifest } = transformHermesCapabilities(FIXTURE);
    const team = findTeamManifestTeam(manifest, "hermes");
    expect(
      team?.actions?.some((action) => action.id === "machine_comedy_run"),
    ).toBe(false);
  });

  it("honors a custom team id", () => {
    const { manifest } = transformHermesCapabilities(FIXTURE, { teamId: "fleet-a" });
    expect(findTeamManifestTeam(manifest, "fleet-a")).not.toBeNull();
  });

  it("source purity: the transform hardcodes no agent or portal names", () => {
    const source = readFileSync(
      fileURLToPath(
        new URL(
          "../../../providers/hermes/capabilities-transform.ts",
          import.meta.url,
        ),
      ),
      "utf8",
    );
    expect(source).not.toMatch(/machine|martina|deb\b|scout|angela|tony|sigmund|winston/i);
  });
});
