// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  isSessionAuthMode,
  isStandaloneMode,
} from "../../../../extensions/cavi/runtime/standalone-mode";

type RuntimeModeWindow = typeof window & {
  __CAVI_STANDALONE_MODE__?: boolean;
  __CAVI_AUTH_MODE__?: string;
  __OPENCLAW_STANDALONE_MODE__?: boolean;
  __OPENCLAW_AUTH_MODE__?: string;
};

describe("CAVI standalone runtime mode", () => {
  afterEach(() => {
    const runtimeWindow = window as RuntimeModeWindow;
    delete runtimeWindow.__CAVI_STANDALONE_MODE__;
    delete runtimeWindow.__CAVI_AUTH_MODE__;
    delete runtimeWindow.__OPENCLAW_STANDALONE_MODE__;
    delete runtimeWindow.__OPENCLAW_AUTH_MODE__;
  });

  it("uses generic CAVI globals first", () => {
    const runtimeWindow = window as RuntimeModeWindow;
    runtimeWindow.__CAVI_STANDALONE_MODE__ = true;
    runtimeWindow.__CAVI_AUTH_MODE__ = "session";
    runtimeWindow.__OPENCLAW_STANDALONE_MODE__ = false;

    expect(isStandaloneMode()).toBe(true);
    expect(isSessionAuthMode()).toBe(true);
  });

  it("keeps OpenClaw globals as compatibility fallbacks", () => {
    const runtimeWindow = window as RuntimeModeWindow;
    runtimeWindow.__OPENCLAW_STANDALONE_MODE__ = true;
    runtimeWindow.__OPENCLAW_AUTH_MODE__ = "session";

    expect(isStandaloneMode()).toBe(true);
    expect(isSessionAuthMode()).toBe(true);
  });
});
