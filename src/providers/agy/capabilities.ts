import { type CapabilitySupport } from "../../core/runtime/capability-taxonomy.js";

/** 
 * Antigravity (agy) orchestration supports runs and streaming. 
 * Batching is optional and omitted for the initial implementation.
 */
export const AGY_RUNTIME_SUPPORT = {
  runs: true,
  streaming: true,
} as const satisfies CapabilitySupport;
