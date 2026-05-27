import { afterEach, describe, expect, it, vi } from "vitest";
import { GatewayHttpError } from "../../../core/http/gateway-error";
import { createJsonHttpRequest, withQuery } from "../../../core/http/json-client";

describe("json HTTP client", () => {
  describe("withQuery", () => {
    it("omits undefined params", () => {
      expect(withQuery("/p", { a: 1, b: undefined })).toBe("/p?a=1");
    });

    it("returns path unchanged when all values undefined", () => {
      expect(withQuery("/p", { x: undefined })).toBe("/p");
    });

    it("stringifies numbers and builds query string", () => {
      const q = withQuery("/tasks", { limit: 20, search: "x" });
      expect(q).toMatch(/^\/tasks\?/);
      expect(q).toContain("limit=20");
      expect(q).toContain("search=x");
    });
  });

  describe("createJsonHttpRequest", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("GETs httpBase + path with Accept and optional Bearer", async () => {
      const fetchMock = vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "http://gw",
        authToken: "tok",
      });
      const data = await requestJson<{ ok: boolean }>("/cavi-control/x");

      expect(data).toEqual({ ok: true });
      expect(fetchMock).toHaveBeenCalledWith(
        "http://gw/cavi-control/x",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Accept: "application/json",
            Authorization: "Bearer tok",
          }),
          cache: "no-store",
        }),
      );
    });

    it("omits Authorization when token is null", async () => {
      const fetchMock = vi.fn(async () =>
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "",
        authToken: null,
      });
      await requestJson("/y");
      const fetchCall = fetchMock.mock.calls[0] as
        | [string, RequestInit | undefined]
        | undefined;
      if (!fetchCall) {
        throw new Error("expected fetch call");
      }
      const headers = fetchCall[1]?.headers as Record<string, string>;
      expect(headers.Authorization).toBeUndefined();
    });

    it("POST sends JSON body and Content-Type", async () => {
      const fetchMock = vi.fn(async () =>
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "http://gw",
        authToken: null,
      });
      await requestJson("/z", {
        method: "POST",
        body: { a: 1 },
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "http://gw/z",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ a: 1 }),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("returns empty object for 204", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 204 })),
      );
      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "",
        authToken: null,
      });
      const data = await requestJson<Record<string, never>>("/n");
      expect(data).toEqual({});
    });

    it("returns empty object for whitespace-only body", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          new Response("  \n  ", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      );
      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "",
        authToken: null,
      });
      const data = await requestJson<Record<string, never>>("/e");
      expect(data).toEqual({});
    });

    it("throws GatewayHttpError with status when not ok", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("nope", { status: 502 })),
      );
      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "",
        authToken: null,
      });
      await expect(requestJson("/bad")).rejects.toMatchObject({
        name: "GatewayHttpError",
        status: 502,
      });
    });

    it("uses error.message from JSON body when present", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({ error: { message: "custom reason" } }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              },
            ),
        ),
      );
      const requestJson = createJsonHttpRequest({
        surface: "cavi-control-api",
        httpBase: "",
        authToken: null,
      });
      try {
        await requestJson("/bad");
        expect.fail("expected throw");
      } catch (e) {
        expect(e).toBeInstanceOf(GatewayHttpError);
        expect((e as GatewayHttpError).message).toContain("/bad 400");
        expect((e as GatewayHttpError).message).toContain("custom reason");
        expect((e as GatewayHttpError).status).toBe(400);
      }
    });
  });
});
