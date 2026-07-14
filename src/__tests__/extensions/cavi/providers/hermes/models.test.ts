import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import type { HermesDashboardRestClient } from "../../../../../extensions/cavi/providers/hermes/dashboard-rest.js";
import { createHermesModelCatalogClient } from "../../../../../extensions/cavi/providers/hermes/models.js";

const fixture = JSON.parse(readFileSync(fileURLToPath(new URL(
  "../../../../fixtures/hermes/dashboard/rest/models.json", import.meta.url,
)), "utf8")) as unknown;

describe("Hermes model catalog", () => {
  it("keeps provider/model identity stable and exposes only evidenced capabilities", async () => {
    const rest = { getModels: vi.fn(async () => fixture) } as unknown as HermesDashboardRestClient;
    await expect(createHermesModelCatalogClient(rest).listModels()).resolves.toEqual({ data: [{
      providerId: "fixture-provider",
      id: "fixture-model",
      displayName: "fixture-model",
      availability: "available",
      capabilities: { selected: true, userDefined: false },
      metadata: {
        provider: "hermes", stability: "experimental",
        source: { transport: "http", method: "models" },
        providerData: { providerDisplayName: "Fixture Provider", source: "built-in" },
      },
    }] });
  });

  it("does not infer authentication and keeps duplicate provider/model identities collision-safe", async () => {
    const payload = structuredClone(fixture) as { providers: Array<Record<string, unknown>>; provider: string; model: string };
    const provider = payload.providers[0] as Record<string, unknown>;
    payload.providers = [
      { ...provider, slug: "alpha", is_current: true, models: ["shared", "shared"] },
      { ...provider, slug: "beta", name: "Beta", is_current: false, models: ["shared"] },
    ];
    payload.provider = "alpha";
    payload.model = "shared";
    const rest = { getModels: vi.fn(async () => payload) } as unknown as HermesDashboardRestClient;
    const models = (await createHermesModelCatalogClient(rest).listModels()).data;

    expect(models).toHaveLength(2);
    expect(models.map(({ providerId, id }) => `${providerId}/${id}`)).toEqual(["alpha/shared", "beta/shared"]);
    expect(models.every((model) => model.authenticated === undefined)).toBe(true);
    expect(models.map((model) => model.capabilities?.selected)).toEqual([true, false]);
  });
});
