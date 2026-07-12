import { describe, expect, it } from "vitest";
import {
  RUNTIME_PROVIDER_CAPABILITY_MATRIX,
  getRuntimeProviderCapabilityRow,
} from "../../providers/capability-matrix.js";

describe("runtime provider capability matrix", () => {
  it("contains every shipped provider entry", () => {
    expect(Object.keys(RUNTIME_PROVIDER_CAPABILITY_MATRIX).sort()).toEqual([
      "claude",
      "claude-managed-agents",
      "codex",
      "gemini",
      "hermes",
      "openclaw",
    ]);
  });

  it("does not advertise unimplemented control-plane modules in the foundation slice", () => {
    for (const row of Object.values(RUNTIME_PROVIDER_CAPABILITY_MATRIX)) {
      expect(row.controlPlane).toEqual({});
    }
  });

  it("records exact implemented runtime surfaces and transports for every provider", () => {
    const http = { kind: "http", stability: "stable", authenticated: true };
    const sse = {
      kind: "sse", stability: "stable", authenticated: true,
      reconnect: false, replay: false, cancellation: true,
    };
    const websocket = {
      kind: "websocket", stability: "stable", authenticated: true, reconnect: true,
    };
    const gatewayRuntime = {
      runs: true, streaming: true, teams: true, kanban: true, workspace: true,
      operator: true, discourse: true, media: true, wiki: true, agentConfig: true,
    };

    expect(RUNTIME_PROVIDER_CAPABILITY_MATRIX).toEqual({
      claude: { runtime: { runs: true, streaming: true, batch: true }, transports: { http, sse }, controlPlane: {} },
      "claude-managed-agents": { runtime: { runs: true, streaming: true }, transports: { http, sse }, controlPlane: {} },
      codex: { runtime: { runs: true, streaming: true, batch: true }, transports: { http, sse }, controlPlane: {} },
      gemini: { runtime: { runs: true, streaming: true, batch: true }, transports: { http, sse }, controlPlane: {} },
      hermes: {
        runtime: gatewayRuntime,
        transports: { http, sse, websocket: { ...websocket, stability: "experimental" } },
        controlPlane: {},
      },
      openclaw: {
        runtime: { ...gatewayRuntime, media: false, wiki: false },
        transports: { http, sse, websocket },
        controlPlane: {},
      },
    });
  });

  it("returns only known frozen rows", () => {
    expect(getRuntimeProviderCapabilityRow("codex")).toBe(
      RUNTIME_PROVIDER_CAPABILITY_MATRIX.codex,
    );
    expect(getRuntimeProviderCapabilityRow("unknown")).toBeUndefined();
    expect(Object.isFrozen(RUNTIME_PROVIDER_CAPABILITY_MATRIX)).toBe(true);
    expect(Object.isFrozen(RUNTIME_PROVIDER_CAPABILITY_MATRIX.codex)).toBe(true);
  });
});
