type CaviControlGlobals = {
  __CAVI_STANDALONE_MODE__?: boolean;
  __CAVI_AUTH_MODE__?: string;
  /** @deprecated Use __CAVI_STANDALONE_MODE__. */
  __OPENCLAW_STANDALONE_MODE__?: boolean;
  /** @deprecated Use __CAVI_AUTH_MODE__. */
  __OPENCLAW_AUTH_MODE__?: string;
};

function getGlobals(): CaviControlGlobals {
  return typeof window !== "undefined"
    ? (window as unknown as CaviControlGlobals)
    : {};
}

export function isStandaloneMode(): boolean {
  const globals = getGlobals();
  return (
    globals.__CAVI_STANDALONE_MODE__ ??
    globals.__OPENCLAW_STANDALONE_MODE__
  ) === true;
}

export function isSessionAuthMode(): boolean {
  const globals = getGlobals();
  const authMode = globals.__CAVI_AUTH_MODE__ ?? globals.__OPENCLAW_AUTH_MODE__;
  return isStandaloneMode() && authMode === "session";
}
