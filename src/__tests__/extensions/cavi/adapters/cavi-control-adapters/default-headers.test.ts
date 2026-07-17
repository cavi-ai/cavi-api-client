import { afterEach, describe, expect, it, vi } from "vitest";
import { createCaviControlAdapters } from "../../../../../extensions/cavi/adapters/create-cavi-control-adapters";

const originalFetch = globalThis.fetch;

describe("createCaviControlAdapters default headers", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("forwards caller default headers through REST-backed data calls", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          range: "24h",
          series: [],
          totals: { costUsd: 0, tokens: 0 },
          lastUpdated: 1,
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const adapters = createCaviControlAdapters({
      gatewayBaseUrl: "https://gateway.example",
      authToken: "test-token",
      client: null,
      defaultHeaders: {
        "X-Cavi-Gateway-Implementation": "openclaw",
        "X-Gateway-Implementation": "openclaw",
        "X-Cavi-Gateway-Provider": "openclaw",
        "X-Gateway-Provider": "openclaw",
      },
    });

    await adapters.loadCostHistory("24h");

    expect(fetchMock).toHaveBeenCalled();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer test-token",
      "X-Cavi-Gateway-Implementation": "openclaw",
      "X-Gateway-Implementation": "openclaw",
      "X-Cavi-Gateway-Provider": "openclaw",
      "X-Gateway-Provider": "openclaw",
    });
  });
});
