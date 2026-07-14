import { describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../../core/errors.js";
import {
  createOpenClawAuthStatusClient,
  createOpenClawModelCatalogClient,
} from "../../../../providers/openclaw/control-plane/auth-models.js";
import { createOpenClawRuntimeControlClient } from "../../../../providers/openclaw/control-plane/factory.js";
import type { OpenClawRpc } from "../../../../providers/openclaw/control-plane/rpc.js";
import { ApiClientErrorCode } from "../../../../core/errors.js";

function createRpc(payload: unknown): OpenClawRpc {
  return {
    request: vi.fn(async () => payload),
    subscribe: vi.fn(() => () => undefined),
    dispose: vi.fn(async () => undefined),
  };
}

describe("OpenClaw auth status and model catalog", () => {
  it("lists configured models with one native request and canonical identifiers", async () => {
    const rpc = createRpc({
      models: [{
        id: "model-a",
        name: "Model A",
        provider: "provider-a",
        alias: "primary",
        contextWindow: 8192,
        reasoning: true,
      }],
    });
    const signal = new AbortController().signal;

    const result = await createOpenClawModelCatalogClient(rpc).listModels({ signal });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith(
      "models.list",
      { view: "configured" },
      { signal },
    );
    expect(result).toEqual({
      data: [{
        providerId: "provider-a",
        id: "model-a",
        displayName: "Model A",
        availability: "available",
        capabilities: { reasoning: true },
        metadata: {
          provider: "openclaw",
          stability: "experimental",
          source: { transport: "websocket", method: "models.list" },
          providerData: { alias: "primary", contextWindow: 8192 },
        },
      }],
    });
  });

  it("does not probe auth or invent optional model fields", async () => {
    const rpc = createRpc({ models: [{ id: "model-b", name: "Model B", provider: "provider-b" }] });

    const result = await createOpenClawModelCatalogClient(rpc).listModels();

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("models.list", { view: "configured" }, { signal: undefined });
    expect(result.data[0]).not.toHaveProperty("authenticated");
    expect(result.data[0]).not.toHaveProperty("capabilities");
    expect(result.data[0]?.metadata.providerData).toBeUndefined();
  });

  it("maps provider and profile auth health without inventing expiry or usage", async () => {
    const rpc = createRpc({
      ts: 1_760_000_000_000,
      providers: [
        { provider: "provider-a", displayName: "Provider A", status: "healthy", profiles: [] },
        {
          provider: "provider-b",
          displayName: "Provider B",
          status: "degraded",
          profiles: [{ profileId: "profile-b", type: "oauth", status: "expired", reasonCode: "refresh_failed", logoutSupported: true }],
        },
      ],
    });
    const signal = new AbortController().signal;

    const result = await createOpenClawAuthStatusClient(rpc).listAuthStatus({ signal });

    expect(rpc.request).toHaveBeenCalledTimes(1);
    expect(rpc.request).toHaveBeenCalledWith("models.authStatus", {}, { signal });
    expect(result).toEqual([
      {
        providerId: "provider-a",
        status: "authenticated",
        metadata: {
          provider: "openclaw",
          stability: "experimental",
          source: { transport: "websocket", method: "models.authStatus" },
          providerData: { checkedAt: "2025-10-09T08:53:20.000Z", displayName: "Provider A", upstreamStatus: "healthy" },
        },
      },
      {
        providerId: "provider-b",
        profileId: "profile-b",
        status: "expired",
        sourceCategory: "oauth",
        reasonCode: "refresh_failed",
        metadata: {
          provider: "openclaw",
          stability: "experimental",
          source: { transport: "websocket", method: "models.authStatus" },
          providerData: { checkedAt: "2025-10-09T08:53:20.000Z", displayName: "Provider B", logoutSupported: true, upstreamStatus: "expired" },
        },
      },
    ]);
    expect(result[0]).not.toHaveProperty("expiresAt");
    expect(result[0]?.metadata.providerData).not.toHaveProperty("usage");
  });

  it("maps validated profile expiry and provider usage without leaking unvalidated fields", async () => {
    const rpc = createRpc({
      ts: 1_760_000_000_000,
      providers: [{
        provider: "provider-a",
        displayName: "Provider A",
        status: "healthy",
        expiry: { at: 1_760_086_400_000, remainingMs: 86_400_000, label: "1d" },
        profiles: [{
          profileId: "profile-a",
          type: "oauth",
          status: "healthy",
          expiry: { at: 1_760_043_200_000, remainingMs: 43_200_000, label: "12h" },
        }],
        usage: {
          windows: [{ label: "5h", usedPercent: 25, resetAt: 1_760_018_000_000 }],
          summary: "75% left",
          plan: "pro",
          billing: [{ type: "budget", used: 12.5, limit: 100, unit: "USD", period: "monthly", resetAt: 1_762_684_800_000 }],
        },
      }],
    });

    const [result] = await createOpenClawAuthStatusClient(rpc).listAuthStatus();

    expect(result).toEqual({
      providerId: "provider-a",
      profileId: "profile-a",
      status: "authenticated",
      expiresAt: "2025-10-09T20:53:20.000Z",
      sourceCategory: "oauth",
      metadata: {
        provider: "openclaw",
        stability: "experimental",
        source: { transport: "websocket", method: "models.authStatus" },
        providerData: {
          checkedAt: "2025-10-09T08:53:20.000Z",
          displayName: "Provider A",
          upstreamStatus: "healthy",
          usage: {
            windows: [{ label: "5h", usedPercent: 25, resetAt: 1_760_018_000_000 }],
            summary: "75% left",
            plan: "pro",
            billing: [{ type: "budget", used: 12.5, limit: 100, unit: "USD", period: "monthly", resetAt: 1_762_684_800_000 }],
          },
        },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/access|refresh|secret|authorization/i);
  });

  it("uses provider expiry only for a provider-level auth row", async () => {
    const rpc = createRpc({
      ts: 1_760_000_000_000,
      providers: [{
        provider: "provider-a",
        displayName: "Provider A",
        status: "healthy",
        expiry: { at: 1_760_086_400_000, remainingMs: 86_400_000, label: "1d" },
        profiles: [],
      }],
    });

    const [result] = await createOpenClawAuthStatusClient(rpc).listAuthStatus();

    expect(result?.expiresAt).toBe("2025-10-10T08:53:20.000Z");
    expect(result?.metadata.providerData).not.toHaveProperty("usage");
  });

  it("validates before mapping and never sends a fallback request", async () => {
    const rpc = createRpc({ models: [{ id: "model-a", name: "Model A" }] });

    await expect(createOpenClawModelCatalogClient(rpc).listModels()).rejects.toMatchObject({ code: ApiClientErrorCode.TransportProtocolError });
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("translates non-error gateway failures through the canonical mapper", async () => {
    const rpc = createRpc(undefined);
    vi.mocked(rpc.request).mockRejectedValueOnce("gateway unavailable");

    await expect(createOpenClawAuthStatusClient(rpc).listAuthStatus()).rejects.toBeInstanceOf(ApiClientError);
    expect(rpc.request).toHaveBeenCalledTimes(1);
  });

  it("wires both clients into the internal OpenClaw factory", async () => {
    const rpc = createRpc({ models: [] });
    const plane = await createOpenClawRuntimeControlClient({ rpc });

    await expect(plane.models.listModels()).resolves.toEqual({ data: [] });
    vi.mocked(rpc.request).mockResolvedValueOnce({ ts: 0, providers: [] });
    await expect(plane.authStatus.listAuthStatus()).resolves.toEqual([]);

    expect(rpc.request).toHaveBeenNthCalledWith(1, "models.list", { view: "configured" }, { signal: undefined });
    expect(rpc.request).toHaveBeenNthCalledWith(2, "models.authStatus", {}, { signal: undefined });
  });
});
