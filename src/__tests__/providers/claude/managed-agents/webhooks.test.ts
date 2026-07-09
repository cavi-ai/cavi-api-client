import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  MANAGED_AGENT_WEBHOOK_EVENT_TYPES,
  parseWebhookEvent,
  verifyManagedAgentWebhook,
  WebhookVerificationError,
} from "../../../../providers/claude/managed-agents/webhooks";

// Independent signer (node:crypto) — cross-checks our Web Crypto impl against the
// Standard Webhooks scheme the Anthropic SDK uses (standardwebhooks).
const SECRET = "whsec_" + Buffer.from("0123456789abcdef0123456789abcdef").toString("base64");
function sign(id: string, ts: string, body: string, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const sig = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return `v1,${sig}`;
}

const BODY = JSON.stringify({
  type: "event",
  id: "event_01ABC",
  created_at: "2026-06-06T00:00:00Z",
  data: { type: "session.status_idled", id: "sesn_01XYZ", organization_id: "o", workspace_id: "w" },
});
const ID = "msg_1";
const NOW = 1_780_000_000_000; // fixed clock (ms)
const TS = Math.floor(NOW / 1000).toString();

describe("MANAGED_AGENT_WEBHOOK_EVENT_TYPES", () => {
  it("covers agent, deployment, and deployment_run event types", () => {
    for (const t of [
      "agent.updated",
      "deployment.created",
      "deployment.paused",
      "deployment_run.started",
      "deployment_run.succeeded",
      "deployment_run.failed",
    ]) {
      expect(MANAGED_AGENT_WEBHOOK_EVENT_TYPES).toContain(t);
    }
  });
});

describe("verifyManagedAgentWebhook", () => {
  it("accepts a correctly-signed delivery and returns the parsed event", async () => {
    const headers = { "webhook-id": ID, "webhook-timestamp": TS, "webhook-signature": sign(ID, TS, BODY) };
    const event = await verifyManagedAgentWebhook(BODY, headers, SECRET, { nowMs: NOW });
    expect(event.data.type).toBe("session.status_idled");
    expect(event.data.id).toBe("sesn_01XYZ");
    expect(event.id).toBe("event_01ABC");
  });

  it("accepts x-webhook-* header aliases (the docs' naming)", async () => {
    const headers = { "X-Webhook-Id": ID, "X-Webhook-Timestamp": TS, "X-Webhook-Signature": sign(ID, TS, BODY) };
    const event = await verifyManagedAgentWebhook(BODY, headers, SECRET, { nowMs: NOW });
    expect(event.id).toBe("event_01ABC");
  });

  it("rejects a tampered body", async () => {
    const headers = { "webhook-id": ID, "webhook-timestamp": TS, "webhook-signature": sign(ID, TS, BODY) };
    await expect(verifyManagedAgentWebhook(BODY + " ", headers, SECRET, { nowMs: NOW })).rejects.toBeInstanceOf(WebhookVerificationError);
  });

  it("rejects a wrong signing secret", async () => {
    const headers = { "webhook-id": ID, "webhook-timestamp": TS, "webhook-signature": sign(ID, TS, BODY, "whsec_" + Buffer.from("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx").toString("base64")) };
    await expect(verifyManagedAgentWebhook(BODY, headers, SECRET, { nowMs: NOW })).rejects.toThrow(/no matching/);
  });

  it("rejects a stale timestamp (outside tolerance)", async () => {
    const oldTs = (Math.floor(NOW / 1000) - 1000).toString();
    const headers = { "webhook-id": ID, "webhook-timestamp": oldTs, "webhook-signature": sign(ID, oldTs, BODY) };
    await expect(verifyManagedAgentWebhook(BODY, headers, SECRET, { nowMs: NOW })).rejects.toThrow(/too old/);
  });

  it("rejects missing headers", async () => {
    await expect(verifyManagedAgentWebhook(BODY, {}, SECRET, { nowMs: NOW })).rejects.toThrow(/missing/);
  });

  it("works with a Headers object too", async () => {
    const headers = new Headers({ "webhook-id": ID, "webhook-timestamp": TS, "webhook-signature": sign(ID, TS, BODY) });
    const event = await verifyManagedAgentWebhook(BODY, headers, SECRET, { nowMs: NOW });
    expect(event.id).toBe("event_01ABC");
  });

  it("parseWebhookEvent reads the envelope without verifying", () => {
    expect(parseWebhookEvent(BODY).data.type).toBe("session.status_idled");
  });
});
