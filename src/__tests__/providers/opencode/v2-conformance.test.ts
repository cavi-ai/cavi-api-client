import { describe, expect, it, vi } from "vitest";
import { OpenCodeV2ApiClient, createOpenCodeV2ProviderModule } from "../../../providers/opencode/index.js";
import { ALL_RUNTIME_CONFORMANCE_CHECKS, type RuntimeConformanceContext } from "../../support/runtime-conformance.js";
import { inspectRuntimeProviderConformance } from "../../../testing/index.js";

function instrumented() {
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/prompt")) return Response.json({ data: { id: "msg_test", sessionID: "ses_test", type: "user" } });
    if (path.endsWith("/interrupt")) return Response.json({ interrupted: true });
    if (init?.method === "GET") return new Response(null, { status: 404 });
    return Response.json({ data: { id: "ses_test", location: { directory: "/project" } } });
  });
  return {
    client: new OpenCodeV2ApiClient({ baseUrl: "http://oc.test", scope: { directory: "/project" }, fetchImpl }),
    callCount: () => fetchImpl.mock.calls.length,
    fetchImpl,
  };
}
const context: RuntimeConformanceContext = {
  makeClient: () => instrumented().client,
  makeInstrumentedClient: instrumented,
  runBody: { input: "hello", model: "local/model" },
  dryRunInvalidRunBody: { input: "" },
};

describe("OpenCode v2 runtime conformance", () => {
  for (const check of ALL_RUNTIME_CONFORMANCE_CHECKS) it(check.name, () => check.run(context));
  it("declares server lifecycle and polling-only capability through the module factory", async () => {
    const module = createOpenCodeV2ProviderModule({ baseUrl: "http://oc.test", scope: { directory: "/project" }, fetchImpl: instrumented().fetchImpl });
    const report = await inspectRuntimeProviderConformance({ module, clientOptions: { baseUrl: "http://oc.test" }, runLifecycleSemantics: "server", foreignRunId: "ses_foreign" });
    expect(report.valid).toBe(true);
  });
});
