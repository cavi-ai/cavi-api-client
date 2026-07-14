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
      authenticated: true,
      capabilities: { selected: true, userDefined: false },
      metadata: {
        provider: "hermes", stability: "experimental",
        source: { transport: "http", method: "models" },
        providerData: { providerDisplayName: "Fixture Provider", source: "built-in" },
      },
    }] });
  });
});
