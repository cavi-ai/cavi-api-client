import { describe, it, vi } from "vitest";
import { GatewayApiClient } from "../../../core/gateway/client/client";
import {
  ALL_RUNTIME_CONFORMANCE_CHECKS,
  type RuntimeConformanceContext,
} from "../../support/runtime-conformance";

// Serve gateway capabilities (GET) and a run-start status (POST).
function gatewayFetch(): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    if ((init?.method ?? "GET") === "POST") {
      return new Response(JSON.stringify({ run_id: "run_1", status: "started" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ object: "capabilities", platform: "gateway", features: {} }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

const ctx: RuntimeConformanceContext = {
  makeClient: () => new GatewayApiClient({ baseUrl: "https://gw.example", fetchImpl: gatewayFetch() }),
  runBody: { input: "hi" },
  // No streamRunBody: GatewayApiClient has no streamRun (subscribe-by-runId model),
  // so the streaming check self-skips (F4).
};

describe("GatewayApiClient — runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) {
    it(check.name, () => check.run(ctx));
  }
});
