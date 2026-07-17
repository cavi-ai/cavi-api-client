import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { HermesDashboardRestClient } from "../../../../providers/hermes/control-plane/dashboard-rest";
import { createHermesAuthStatusClient } from "../../../../providers/hermes/control-plane/auth-status";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../fixtures/hermes/dashboard/rest/provider-auth.json", import.meta.url,
)), "utf8")) as unknown;

describe("Hermes auth status", () => {
  it("maps credential-safe auth state from the strict REST fixture", async () => {
    const rest = { getProviderAuth: vi.fn(async () => fixture) } as unknown as HermesDashboardRestClient;
    const statuses = await createHermesAuthStatusClient(rest).listAuthStatus();

    expect(statuses).toEqual([{
      providerId: "fixture-oauth",
      status: "authenticated",
      expiresAt: "2030-01-01T00:00:00Z",
      sourceCategory: "fixture_cli",
      metadata: {
        provider: "hermes", stability: "experimental",
        source: { transport: "http", method: "provider-auth" },
        providerData: { displayName: "Fixture OAuth", flow: "device_code", hasRefreshToken: true },
      },
    }]);
    expect(JSON.stringify(statuses)).not.toMatch(/token_preview|cli_command|docs_url|refresh_token/i);
  });

  it("preserves unauthenticated, expired, and indeterminate states without credential detail", async () => {
    const payload = structuredClone(fixture) as { providers: Array<Record<string, unknown>> };
    const first = payload.providers[0] as { status: Record<string, unknown> };
    first.status = { logged_in: false, source: null, error: "login required" };
    payload.providers.push(
      { ...first, id: "expired", status: { logged_in: true, expires_at: "2020-01-01T00:00:00Z" } },
      { ...first, id: "indeterminate", status: { logged_in: true, error: "upstream unavailable" } },
    );
    const rest = { getProviderAuth: vi.fn(async () => payload) } as unknown as HermesDashboardRestClient;
    expect((await createHermesAuthStatusClient(rest).listAuthStatus()).map(({ providerId, status }) => ({ providerId, status }))).toEqual([
      { providerId: "fixture-oauth", status: "unauthenticated" },
      { providerId: "expired", status: "expired" },
      { providerId: "indeterminate", status: "unknown" },
    ]);
  });

  it("fails closed on malformed expiry evidence and treats an empty error as no error", async () => {
    const payload = structuredClone(fixture) as { providers: Array<Record<string, unknown>> };
    const first = payload.providers[0] as Record<string, unknown>;
    payload.providers = [
      { ...first, id: "invalid", status: { logged_in: true, expires_at: "not-a-date", error: "" } },
      { ...first, id: "empty", status: { logged_in: true, expires_at: "", error: "" } },
      { ...first, id: "valid", status: { logged_in: true, expires_at: "2030-01-01T00:00:00Z", error: "" } },
    ];
    const rest = { getProviderAuth: vi.fn(async () => payload) } as unknown as HermesDashboardRestClient;
    const statuses = await createHermesAuthStatusClient(rest).listAuthStatus();

    expect(statuses.map(({ providerId, status, expiresAt }) => ({ providerId, status, expiresAt }))).toEqual([
      { providerId: "invalid", status: "unknown", expiresAt: undefined },
      { providerId: "empty", status: "unknown", expiresAt: undefined },
      { providerId: "valid", status: "authenticated", expiresAt: "2030-01-01T00:00:00Z" },
    ]);
  });
});
