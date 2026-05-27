type CaviControlGlobals = {
  __CAVI_STANDALONE_MODE__?: boolean;
  __CAVI_AUTH_MODE__?: string;
};

type CaviControlWindow = Window & CaviControlGlobals;

function getGlobals(): CaviControlGlobals {
  return typeof window !== "undefined"
    ? (window as CaviControlWindow)
    : {};
}

export function isStandaloneMode(): boolean {
  const globals = getGlobals();
  return globals.__CAVI_STANDALONE_MODE__ === true;
}

export function isSessionAuthMode(): boolean {
  const globals = getGlobals();
  return isStandaloneMode() && globals.__CAVI_AUTH_MODE__ === "session";
}
