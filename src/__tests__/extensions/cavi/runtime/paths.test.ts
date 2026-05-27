// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { getBrowserWindowOrigin } from "../../../../core/runtime/paths";
import {
  resolveGatewayHttpBase,
  resolveGatewayHttpUrl,
  resolveSessionApiPath,
} from "../../../../extensions/cavi/runtime/paths";

describe("runtime paths", () => {
  type RuntimePathGlobals = typeof window & {
    __CAVI_CONTROL_BASE_PATH__?: string;
    __CAVI_GATEWAY_URL__?: string;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    const runtimeWindow = window as RuntimePathGlobals;
    delete runtimeWindow.__CAVI_CONTROL_BASE_PATH__;
    delete runtimeWindow.__CAVI_GATEWAY_URL__;
  });

  it("treats React Native's window without browser location as no origin", () => {
    vi.stubGlobal("window", {});

    expect(getBrowserWindowOrigin()).toBeNull();
  });

  it("maps localhost gateway to configured 127.x for same-origin dev proxy routing", () => {
    (window as RuntimePathGlobals).__CAVI_GATEWAY_URL__ =
      "http://127.0.0.1:18789";

    expect(resolveGatewayHttpBase("http://localhost:18789")).toBe(
      window.location.origin,
    );
  });

  it("still routes to direct gateway HTTP when loopback ports differ", () => {
    (window as RuntimePathGlobals).__CAVI_GATEWAY_URL__ =
      "http://127.0.0.1:18789";

    expect(resolveGatewayHttpBase("http://localhost:9999")).toBe(
      "http://localhost:9999",
    );
  });

  it("keeps same-origin gateway HTTP calls at origin root", () => {
    (window as RuntimePathGlobals).__CAVI_CONTROL_BASE_PATH__ = "/operator";
    (window as RuntimePathGlobals).__CAVI_GATEWAY_URL__ =
      "https://gateway.example";

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
    (window as RuntimePathGlobals).__CAVI_CONTROL_BASE_PATH__ = "/operator";

    expect(resolveSessionApiPath("/api/__session/status")).toBe(
      "/operator/api/__session/status",
    );
  });
});
