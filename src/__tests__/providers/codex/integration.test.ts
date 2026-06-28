import { once } from "node:events";
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  RUN_STREAM_EVENT_NAMES,
  type RunStreamEvent,
} from "../../../core/runtime/run-stream";
import {
  CODEX_DEFAULT_MODEL,
  CodexApiClient,
} from "../../../providers/codex";

type CapturedRequest = {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: unknown;
};

type CodexFixture = {
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
};

const RESPONSE_ID = "resp_integration";

async function readRequestJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function writeJson(res: ServerResponse, body: unknown): void {
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function writeSse(res: ServerResponse): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
  });
  res.write(
    `event: response.created\ndata: {"type":"response.created","response":{"id":"${RESPONSE_ID}"}}\n\n`,
  );
  res.write(
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Built"}\n\n',
  );
  res.write(
    'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":" UI"}\n\n',
  );
  res.end(
    'event: response.completed\ndata: {"type":"response.completed","response":{"output_text":"Built UI"}}\n\n',
  );
}

async function startCodexFixture(): Promise<CodexFixture> {
  const requests: CapturedRequest[] = [];
  const server = createServer(async (req, res) => {
    try {
      const body = req.method === "POST" ? await readRequestJson(req) : {};
      requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      });

      if (req.method === "POST" && req.url === "/v1/responses") {
        const stream = typeof body === "object" && body !== null
          ? (body as Record<string, unknown>).stream === true
          : false;
        if (stream) {
          writeSse(res);
          return;
        }
        writeJson(res, {
          id: RESPONSE_ID,
          status: "queued",
          model: CODEX_DEFAULT_MODEL,
        });
        return;
      }

      if (req.method === "GET" && req.url === `/v1/responses/${RESPONSE_ID}`) {
        writeJson(res, {
          id: RESPONSE_ID,
          status: "completed",
          model: CODEX_DEFAULT_MODEL,
          output_text: "Built UI",
          usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
        });
        return;
      }

      if (req.method === "POST" && req.url === `/v1/responses/${RESPONSE_ID}/cancel`) {
        writeJson(res, { id: RESPONSE_ID, status: "cancelled" });
        return;
      }

      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: `unexpected ${req.method ?? ""} ${req.url ?? ""}` }));
    } catch (error) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(error) }));
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    close: () => closeServer(server),
  };
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("CodexApiClient local HTTP integration", () => {
  let fixture: CodexFixture | undefined;

  afterEach(async () => {
    await fixture?.close();
    fixture = undefined;
  });

  it("runs the Responses start, poll, stream, and cancel flow through real fetch", async () => {
    fixture = await startCodexFixture();
    const client = new CodexApiClient({
      apiKey: "sk-integration",
      baseUrl: fixture.baseUrl,
    });

    const started = await client.startRun({ input: "Build the frontend" });
    const completed = await client.getRun(RESPONSE_ID);
    const events: RunStreamEvent[] = [];
    let streamCompleted = false;
    await client.streamRun(
      { input: "Stream the frontend work" },
      {
        onEvent: (event) => events.push(event),
        onComplete: () => {
          streamCompleted = true;
        },
      },
    );
    const cancelled = await client.cancelRun(RESPONSE_ID);

    expect(started).toEqual({
      run_id: RESPONSE_ID,
      status: "started",
      model: CODEX_DEFAULT_MODEL,
    });
    expect(completed).toEqual({
      run_id: RESPONSE_ID,
      status: "completed",
      model: CODEX_DEFAULT_MODEL,
      output: "Built UI",
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      tokens: {
        inputTokens: 10,
        outputTokens: 2,
        totalTokens: 12,
        raw: { input_tokens: 10, output_tokens: 2, total_tokens: 12 },
      },
    });
    expect(events).toEqual([
      {
        event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
        runId: RESPONSE_ID,
        delta: "Built",
      },
      {
        event: RUN_STREAM_EVENT_NAMES.MESSAGE_DELTA,
        runId: RESPONSE_ID,
        delta: " UI",
      },
      {
        event: RUN_STREAM_EVENT_NAMES.RUN_COMPLETED,
        runId: RESPONSE_ID,
        output: "Built UI",
      },
    ]);
    expect(streamCompleted).toBe(true);
    expect(cancelled).toEqual({ status: "cancelled" });

    expect(fixture.requests.map((request) => `${request.method ?? ""} ${request.url ?? ""}`))
      .toEqual([
        "POST /v1/responses",
        `GET /v1/responses/${RESPONSE_ID}`,
        "POST /v1/responses",
        `POST /v1/responses/${RESPONSE_ID}/cancel`,
      ]);
    expect(fixture.requests.every((request) =>
      request.headers.authorization === "Bearer sk-integration",
    )).toBe(true);
    expect(fixture.requests[0]?.body).toMatchObject({
      model: CODEX_DEFAULT_MODEL,
      input: "Build the frontend",
      background: true,
      store: true,
    });
    expect(fixture.requests[2]?.body).toMatchObject({
      model: CODEX_DEFAULT_MODEL,
      input: "Stream the frontend work",
      background: true,
      store: true,
      stream: true,
    });
  });
});
