import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resolveHermesChatRunApproval,
  startHermesChatRun,
  streamHermesChatRun,
} from "../../../providers/hermes/chat-run";

describe("Hermes chat run transport", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("derives route source and canonical session aliases on chat run starts", async () => {
    const sessionKey = "agent:main:api_server:dm:cavi-control-mobile-chris:portal-machine";
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ run_id: "run_1" }), { status: 202 }),
    );

    await expect(
      startHermesChatRun({
        httpBase: "https://gateway.example",
        authToken: "test-token",
        clientId: "cavi-control-mobile",
        headers: {
          "X-Cavi-Gateway-Implementation": "hermes",
          "X-Gateway-Provider": "hermes",
        },
        input: "/tools portal sheet chat e2e",
        sessionId: sessionKey,
        sessionKey,
        targetProfile: "media",
        targetAgent: "chris",
        action: "chat.send",
        harness: "openclaw",
        metadata: {
          routeBinding: { rejectedByRouters: true },
          keep: "yes",
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ runId: "run_1" });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/v1/runs",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "X-Portal-Client-Id": "cavi-control-mobile",
      "X-Hermes-Session-Key": sessionKey,
      "X-Cavi-Gateway-Implementation": "hermes",
      "X-Gateway-Provider": "hermes",
    });
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      input: "/tools portal sheet chat e2e",
      session_id: sessionKey,
      sessionKey,
      session_key: sessionKey,
      targetProfile: "media",
      target_profile: "media",
      targetAgent: "chris",
      target_agent: "chris",
      action: "chat.send",
      source: {
        platform: "mobile_app",
        app_env: "cavi-control-mobile",
        channel_id: "media",
        conversation_id: sessionKey,
        thread_id: "portal-machine",
        gateway_implementation: "openclaw",
      },
      metadata: { keep: "yes" },
    });
    expect(Object.hasOwn(body.metadata as object, "routeBinding")).toBe(false);
  });

  it("forwards route source through streaming chat run starts", async () => {
    const sessionKey = "agent:main:api_server:dm:cavi-control-mobile-tony:main";
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url).endsWith("/events")) {
        return new Response('data: {"event":"run.completed","output":""}\n\n', {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      }
      return new Response(JSON.stringify({ run_id: "run_2" }), { status: 202 });
    });

    await expect(
      streamHermesChatRun({
        httpBase: "https://gateway.example",
        authToken: "test-token",
        clientId: "cavi-control-mobile",
        headers: {
          "X-Cavi-Gateway-Implementation": "hermes",
          "X-Gateway-Provider": "hermes",
        },
        input: "/status",
        sessionId: sessionKey,
        sessionKey,
        targetProfile: "default",
        targetAgent: "tony",
        action: "chat.send",
        harness: "hermes",
        onEvent: () => undefined,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ sawAssistantResponseEvent: true });

    const [, init] = fetchImpl.mock.calls[0]!;
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(body.source).toMatchObject({
      platform: "mobile_app",
      app_env: "cavi-control-mobile",
      channel_id: "front-door",
      conversation_id: sessionKey,
      thread_id: "main",
      gateway_implementation: "hermes",
    });
    expect(body.sessionKey).toBe(sessionKey);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(
      "https://gateway.example/v1/runs/run_2/events",
    );
    expect(fetchImpl.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Cavi-Gateway-Implementation": "hermes",
      "X-Gateway-Provider": "hermes",
      "X-Hermes-Session-Key": sessionKey,
    });
  });

  it("uses the injected shared HTTP transport for approval resolution", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 200 }));

    await expect(
      resolveHermesChatRunApproval({
        httpBase: "https://gateway.example",
        authToken: "test-token",
        clientId: "portal-client",
        headers: {
          "X-Cavi-Gateway-Implementation": "hermes",
          "X-Gateway-Provider": "hermes",
        },
        runId: "run_1",
        choice: "session",
        sessionKey: "session-1",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://gateway.example/v1/runs/run_1/approval",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init?.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
      "X-Hermes-Session-Key": "session-1",
      "X-Portal-Client-Id": "portal-client",
      "X-Cavi-Gateway-Implementation": "hermes",
      "X-Gateway-Provider": "hermes",
    });
    expect(JSON.parse(String(init?.body))).toEqual({ choice: "session" });
  });
});
