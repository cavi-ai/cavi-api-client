import { describe, expect, it, vi } from "vitest";
import { OpenCodeV2ApiClient } from "../../../providers/opencode/v2-client.js";

const json = (value: unknown) => new Response(JSON.stringify(value), {
  headers: { "Content-Type": "application/json" },
});
const session = (outcome?: string) => ({ data: {
  id: "ses_test", location: { directory: "/project" }, ...(outcome ? { outcome } : {}),
} });

describe("OpenCode v2 lifecycle", () => {
  it("creates a scoped session, admits a prompt, and retrieves paginated exact text", async () => {
    const requests: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      requests.push(`${init?.method} ${url.pathname}${url.search}`);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Basic b3BlbmNvZGU6c2VjcmV0");
      if (url.pathname === "/api/session") {
        expect(JSON.parse(String(init?.body))).toEqual({ location: { directory: "/project" }, model: { providerID: "local", id: "model" } });
        return json(session());
      }
      if (url.pathname.endsWith("/prompt")) {
        expect(JSON.parse(String(init?.body))).toEqual({ text: "hello", resume: true });
        return json({ data: { id: "msg_1", sessionID: "ses_test", type: "user" } });
      }
      if (url.pathname.endsWith("/message")) {
        const next = url.searchParams.get("cursor");
        return json({ data: [{ id: next ? "msg_3" : "msg_2", type: "assistant", content: [{ type: "text", text: next ? "  exact\n" : "earlier" }] }], cursor: { next: next ? null : "opaque/+" } });
      }
      return json(session("succeeded"));
    });
    const client = new OpenCodeV2ApiClient({ baseUrl: "https://oc.test", scope: { directory: "/project" }, password: "secret", defaultModel: "local/model", fetchImpl });
    expect(await client.startRun({ input: "hello" })).toMatchObject({ run_id: "ses_test", status: "started" });
    expect(await client.getRun("ses_test")).toMatchObject({ status: "completed", output: "  exact\n" });
    expect(requests).toEqual(["POST /api/session", "POST /api/session/ses_test/prompt", "GET /api/session/ses_test", "GET /api/session/ses_test/message?limit=100&order=asc", "GET /api/session/ses_test/message?limit=100&cursor=opaque%2F%2B"]);
    expect((await client.getRuntimeCapabilities()).supports.streaming).toBe(false);
  });

  it("does not infer completion from idle and only acknowledges an actual interrupt", async () => {
    let interrupted = false;
    const client = new OpenCodeV2ApiClient({ baseUrl: "https://oc.test", scope: { directory: "/project" }, fetchImpl: async (input) => String(input).endsWith("/interrupt") ? json({ interrupted }) : json(session()) });
    expect((await client.getRun("ses_test")).status).toBe("running");
    expect(await client.cancelRun("ses_test")).toEqual({ status: "unknown" });
    interrupted = true;
    expect(await client.cancelRun("ses_test")).toEqual({ status: "cancelled" });
  });

  it("rejects unsupported instructions before creating a session and rejects cursor loops", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => String(input).includes("/message") ? json({ data: [], cursor: { next: "same" } }) : json(session("succeeded")));
    const client = new OpenCodeV2ApiClient({ baseUrl: "https://oc.test", scope: { directory: "/project" }, fetchImpl });
    await expect(client.startRun({ input: "hello", instructions: "system" })).rejects.toMatchObject({ code: "validation_failed" });
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(client.getRun("ses_test")).rejects.toMatchObject({ code: "transport_protocol_error" });
  });
});
