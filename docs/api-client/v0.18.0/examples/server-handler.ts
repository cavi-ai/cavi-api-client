import type { CapabilityClient } from "@cavi-ai/api-client";

export function createRunHandler(
  client: CapabilityClient,
  model: string,
  reportError: (error: unknown) => void,
) {
  return async function handle(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return Response.json({ error: "Use POST." }, { status: 405, headers: { Allow: "POST" } });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Expected JSON." }, { status: 400 });
    }
    if (!body || typeof body !== "object" || !("input" in body) ||
        typeof body.input !== "string" || body.input.trim() === "") {
      return Response.json({ error: "Provide a non-empty input string." }, { status: 400 });
    }
    try {
      const result = await client.startRun({ model, input: body.input });
      if (!result.ok) {
        reportError(result.gap);
        return Response.json({ error: "Run unavailable.", reason: result.gap.reason }, { status: 503 });
      }
      const run = result.data;
      const active = ["started", "running", "stopping"].includes(run.status);
      const status = active ? 202 : run.status === "completed" ? 200 : 502;
      return Response.json({
        runId: run.run_id,
        status: run.status,
        text: run.output ?? run.response,
        tokens: run.tokens,
      }, { status });
    } catch (error) {
      reportError(error);
      return Response.json({ error: "Run request failed." }, { status: 502 });
    }
  };
}
