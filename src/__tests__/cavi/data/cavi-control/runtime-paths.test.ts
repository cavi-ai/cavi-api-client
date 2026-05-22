// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  resolveGatewayHttpBase,
  resolveGatewayHttpUrl,
  resolveSessionApiPath,
} from "../../../../cavi/data/cavi-control/runtime-paths";

describe("runtime paths", () => {
  afterEach(() => {
    delete (
      window as typeof window & {
        __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_CAVI_CONTROL_BASE_PATH__;
    delete (
      window as typeof window & {
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_GATEWAY_URL__;
  });

  it("maps localhost gateway to configured 127.x for same-origin dev proxy routing", () => {
    (
      window as typeof window & {
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_GATEWAY_URL__ = "http://127.0.0.1:18789";

    expect(resolveGatewayHttpBase("http://localhost:18789")).toBe(
      window.location.origin,
    );
  });

  it("still routes to direct gateway HTTP when loopback ports differ", () => {
    (
      window as typeof window & {
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_GATEWAY_URL__ = "http://127.0.0.1:18789";

    expect(resolveGatewayHttpBase("http://localhost:9999")).toBe(
      "http://localhost:9999",
    );
  });

  it("keeps same-origin gateway HTTP calls at origin root", () => {
    (
      window as typeof window & {
        __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_CAVI_CONTROL_BASE_PATH__ = "/operator";
    (
      window as typeof window & {
        __OPENCLAW_GATEWAY_URL__?: string;
      }
    ).__OPENCLAW_GATEWAY_URL__ = "https://gateway.example";

    expect(resolveGatewayHttpBase("https://gateway.example")).toBe(
      window.location.origin,
    );
    expect(
      resolveGatewayHttpUrl(
        "https://gateway.example",
        "/api/plugins/machine/dashboard",
      ),
    ).toBe(`${window.location.origin}/api/plugins/machine/dashboard`);
  });

  it("uses the runtime base path for local session endpoints", () => {
    (
      window as typeof window & {
        __OPENCLAW_CAVI_CONTROL_BASE_PATH__?: string;
      }
    ).__OPENCLAW_CAVI_CONTROL_BASE_PATH__ = "/operator";

    expect(resolveSessionApiPath("/api/__session/status")).toBe(
      "/operator/api/__session/status",
    );
  });
});
