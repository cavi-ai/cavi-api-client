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

/**
 * Declared getRun/cancelRun semantics for conformance fixtures.
 *
 * - `omit` — neither method is present
 * - `server` — real backend get/cancel (methods required)
 * - `sync-store` — SynchronousRunStore degrade (methods required; foreign
 *   getRun must not throw and should return status `"unknown"`)
 * - `unsupported-throw` — methods may be present and throw EndpointNotFound
 */
export type RuntimeRunLifecycleSemantics =
  | "omit"
  | "server"
  | "sync-store"
  | "unsupported-throw";

export type RuntimeProviderConformanceFixture = {
  module: RuntimeProviderModule;
  clientOptions: RuntimeClientOptions;
  /**
   * Required when the client exposes `getRun` and/or `cancelRun`.
   * Also pass `omit` explicitly when methods are intentionally absent.
   */
  runLifecycleSemantics?: RuntimeRunLifecycleSemantics;
};

function hasSseSubscribeFactory(module: RuntimeProviderModule): boolean {
  return (
    typeof (module as { createSseRunEventProvider?: unknown }).createSseRunEventProvider ===
    "function"
  );
}

export async function inspectRuntimeProviderConformance(
  fixture: RuntimeProviderConformanceFixture,
): Promise<RuntimeProviderConformanceReport> {
  const checks: RuntimeProviderConformanceCheck[] = [];
  const add = (
    id: string,
    status: "pass" | "fail" | "skip",
    message: string,
  ) => {
    checks.push({ id, status, message });
  };
  const pass = (id: string, message: string) => add(id, "pass", message);
  const fail = (id: string, message: string) => add(id, "fail", message);
  const skip = (id: string, message: string) => add(id, "skip", message);

  const registry = createRuntimeProviderRegistry({ modules: [fixture.module] });
  const client = createRuntimeClient(fixture.module.kind, {
    registry,
    clientOptions: fixture.clientOptions,
  });
  const capabilities = await client.getRuntimeCapabilities();
  if (capabilities.providerKind === fixture.module.kind) {
    pass(
      "provider-kind",
      `Client provider kind is "${capabilities.providerKind}"; module kind is "${fixture.module.kind}".`,
    );
  } else {
    fail(
      "provider-kind",
      `Client provider kind is "${capabilities.providerKind}"; module kind is "${fixture.module.kind}".`,
    );
  }

  const declared = fixture.module.capabilities ?? {};
  const capabilityMatch = RUNTIME_SURFACES.every(
    (surface) => (declared[surface] === true) === (capabilities.supports[surface] === true),
  );
  if (capabilityMatch) {
    pass("capabilities", "Module and client capability flags must match.");
  } else {
    fail("capabilities", "Module and client capability flags must match.");
  }

  const streamingAdvertised = declared.streaming === true;
  const hasStreamRun = typeof client.streamRun === "function";
  const hasSubscribe = hasSseSubscribeFactory(fixture.module);

  if (!streamingAdvertised) {
    skip(
      "streaming-method",
      "Module does not advertise streaming; streamRun not required.",
    );
    skip(
      "streaming-path",
      "Module does not advertise streaming; streaming path not required.",
    );
  } else {
    // Duality: streamRun (runtime-only) OR createSseRunEventProvider (gateway).
    if (hasStreamRun || hasSubscribe) {
      pass(
        "streaming-method",
        hasStreamRun
          ? "Providers advertising streaming implement streamRun."
          : "Providers advertising streaming expose createSseRunEventProvider (subscribe-by-runId).",
      );
      pass(
        "streaming-path",
        hasStreamRun && hasSubscribe
          ? "Streaming via streamRun and createSseRunEventProvider."
          : hasStreamRun
            ? "Streaming path: streamRun (start+stream)."
            : "Streaming path: createSseRunEventProvider (subscribe-by-runId).",
      );
    } else {
      fail(
        "streaming-method",
        "Providers advertising streaming must implement streamRun or createSseRunEventProvider.",
      );
      fail(
        "streaming-path",
        "No streamRun and no createSseRunEventProvider on a streaming-capable module.",
      );
    }
  }

  const hasBatchMethods = ["submitBatch", "getBatch", "cancelBatch", "getBatchResults"].every(
    (method) => typeof client[method as keyof typeof client] === "function",
  );
  if (declared.batch !== true) {
    skip("batch-methods", "Module does not advertise batch.");
  } else if (hasBatchMethods) {
    pass("batch-methods", "Providers advertising batch implement all batch methods.");
  } else {
    fail("batch-methods", "Providers advertising batch must implement all batch methods.");
  }

  const hasGetRun = typeof client.getRun === "function";
  const hasCancelRun = typeof client.cancelRun === "function";
  const hasLifecycle = hasGetRun || hasCancelRun;
  const semantics = fixture.runLifecycleSemantics;

  if (hasLifecycle && semantics === undefined) {
    fail(
      "run-lifecycle-semantics",
      "Client exposes getRun and/or cancelRun; fixture must declare runLifecycleSemantics.",
    );
  } else if (semantics === undefined) {
    skip(
      "run-lifecycle-semantics",
      "No getRun/cancelRun and no runLifecycleSemantics declared.",
    );
  } else if (semantics === "omit") {
    if (!hasLifecycle) {
      pass("run-lifecycle-semantics", "runLifecycleSemantics is omit; methods absent.");
    } else {
      fail(
        "run-lifecycle-semantics",
        "runLifecycleSemantics is omit but getRun and/or cancelRun are present.",
      );
    }
  } else if (semantics === "server" || semantics === "sync-store") {
    if (hasGetRun && hasCancelRun) {
      pass(
        "run-lifecycle-semantics",
        `runLifecycleSemantics is ${semantics}; getRun and cancelRun are present.`,
      );
    } else {
      fail(
        "run-lifecycle-semantics",
        `runLifecycleSemantics is ${semantics}; both getRun and cancelRun are required.`,
      );
    }
  } else {
    // unsupported-throw — methods optional; presence alone is enough to pass shape.
    pass(
      "run-lifecycle-semantics",
      "runLifecycleSemantics is unsupported-throw; EndpointNotFound may be thrown when invoked.",
    );
  }

  if (semantics === "sync-store" && hasGetRun && client.getRun) {
    try {
      const status = await client.getRun("__conformance-foreign-run-id__");
      if (status.status === "unknown") {
        pass(
          "run-lifecycle-sync-store",
          "sync-store getRun returns status \"unknown\" for a foreign run id without throwing.",
        );
      } else {
        fail(
          "run-lifecycle-sync-store",
          `sync-store getRun for a foreign id returned status "${status.status}"; expected "unknown".`,
        );
      }
    } catch (error) {
      fail(
        "run-lifecycle-sync-store",
        `sync-store getRun must not throw for a foreign run id; threw ${String(error)}.`,
      );
    }
  } else {
    skip(
      "run-lifecycle-sync-store",
      "sync-store foreign-getRun probe not applicable.",
    );
  }

  return {
    providerKind: fixture.module.kind,
    valid: checks.every((check) => check.status !== "fail"),
    checks,
  };
}
