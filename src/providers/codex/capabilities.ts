import type { RuntimeCapabilities } from "../../core/runtime/capabilities.js";

export const CODEX_RUNTIME_SUPPORT = Object.freeze({
  runs: true,
  streaming: true,
  batch: true,
} satisfies RuntimeCapabilities["supports"]);
