type CaviControlGlobals = {
  __OPENCLAW_STANDALONE_MODE__?: boolean;
  __OPENCLAW_AUTH_MODE__?: string;
};

function getGlobals(): CaviControlGlobals {
  return typeof window !== "undefined"
    ? (window as unknown as CaviControlGlobals)
    : {};
}

export function isStandaloneMode(): boolean {
  return getGlobals().__OPENCLAW_STANDALONE_MODE__ === true;
}

export function isSessionAuthMode(): boolean {
  return isStandaloneMode() && getGlobals().__OPENCLAW_AUTH_MODE__ === "session";
}
