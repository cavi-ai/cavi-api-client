import { RUNTIME_SURFACES } from "../core/runtime/capabilities.js";
import {
  createRuntimeClient,
  createRuntimeProviderRegistry,
  type RuntimeClientOptions,
  type RuntimeProviderModule,
} from "../core/runtime/providers/index.js";

export type RuntimeProviderConformanceCheck = {
  id: string;
  status: "pass" | "fail" | "skip";
  message: string;
};

export type RuntimeProviderConformanceReport = {
  providerKind: string;
  valid: boolean;
  checks: readonly RuntimeProviderConformanceCheck[];
};

export type RuntimeProviderConformanceFixture = {
  module: RuntimeProviderModule;
  clientOptions: RuntimeClientOptions;
};

export async function inspectRuntimeProviderConformance(
  fixture: RuntimeProviderConformanceFixture,
): Promise<RuntimeProviderConformanceReport> {
  const checks: RuntimeProviderConformanceCheck[] = [];
  const add = (id: string, valid: boolean, message: string) => {
    checks.push({ id, status: valid ? "pass" : "fail", message });
  };
  const registry = createRuntimeProviderRegistry({ modules: [fixture.module] });
  const client = createRuntimeClient(fixture.module.kind, {
    registry,
    clientOptions: fixture.clientOptions,
  });
  const capabilities = await client.getRuntimeCapabilities();
  add(
    "provider-kind",
    capabilities.providerKind === fixture.module.kind,
    `Client provider kind is "${capabilities.providerKind}"; module kind is "${fixture.module.kind}".`,
  );
  const declared = fixture.module.capabilities ?? {};
  const capabilityMatch = RUNTIME_SURFACES.every(
    (surface) => (declared[surface] === true) === (capabilities.supports[surface] === true),
  );
  add("capabilities", capabilityMatch, "Module and client capability flags must match.");
  add(
    "streaming-method",
    declared.streaming !== true || typeof client.streamRun === "function",
    "Providers advertising streaming must implement streamRun.",
  );
  const hasBatchMethods = ["submitBatch", "getBatch", "cancelBatch", "getBatchResults"].every(
    (method) => typeof client[method as keyof typeof client] === "function",
  );
  add(
    "batch-methods",
    declared.batch !== true || hasBatchMethods,
    "Providers advertising batch must implement all batch methods.",
  );
  return {
    providerKind: fixture.module.kind,
    valid: checks.every((check) => check.status !== "fail"),
    checks,
  };
}
