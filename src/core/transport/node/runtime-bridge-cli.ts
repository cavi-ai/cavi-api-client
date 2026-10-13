#!/usr/bin/env node
import process from "node:process";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import type { RuntimeClient } from "../../runtime/client.js";
import { ApiClientError } from "../../errors.js";
import { serveRuntimeBridge } from "./runtime-bridge.js";

// Factories are executable application code, selected by the process owner.
// Configuration and credentials stay in the factory or inherited environment.
let client: (RuntimeClient & { dispose?: () => void | Promise<void> }) | undefined;
try {
  const factoryPath = process.argv[2];
  if (process.argv.length !== 3 || !factoryPath || !isAbsolute(factoryPath)) {
    throw new ApiClientError("Expected an absolute factory module path", { type: "configuration", code: "invalid_config" });
  }
  const factory = await import(pathToFileURL(factoryPath).href);
  if (typeof factory.createRuntimeClient !== "function") throw new ApiClientError("Missing factory export", { type: "configuration", code: "invalid_config" });
  const candidate = await factory.createRuntimeClient();
  if (!candidate || typeof candidate.getRuntimeCapabilities !== "function" || typeof candidate.startRun !== "function") {
    throw new ApiClientError("Invalid runtime client", { type: "configuration", code: "invalid_config" });
  }
  client = candidate;
  await serveRuntimeBridge({ client: candidate, input: process.stdin, output: process.stdout });
} catch {
  // Never copy arbitrary module/provider exceptions to diagnostics.
  process.stderr.write("Runtime bridge failed\n");
  process.exitCode = 1;
} finally {
  process.stdin.destroy();
  try { await client?.dispose?.(); }
  catch { process.exitCode = 1; }
}
