import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  AuthStatusClient,
  ModelCatalogClient,
  RuntimeAuthStatus,
  RuntimeSessionSummary,
  RuntimeTaskSummary,
  RuntimeUsageSummary,
  RuntimeWorkspaceDescriptor,
  SessionClient,
  TaskClient,
  UsageClient,
  WorkspaceClient,
} from "../../../../core/runtime/control-plane/index";

describe("runtime control-plane clients", () => {
  it("keeps unavailable cost absent instead of coercing it to zero", () => {
    const usage: RuntimeUsageSummary = {
      metadata: {
        provider: "acme",
        stability: "stable",
        source: { transport: "http", method: "usage" },
      },
      tokens: { totalTokens: 10 },
      cost: { availability: "unavailable" },
    };
    expect(usage.cost.amount).toBeUndefined();
  });

  it("exports all focused client interfaces", () => {
    expectTypeOf<SessionClient>().toBeObject();
    expectTypeOf<ModelCatalogClient>().toBeObject();
    expectTypeOf<AuthStatusClient>().toBeObject();
    expectTypeOf<UsageClient>().toBeObject();
    expectTypeOf<TaskClient>().toBeObject();
    expectTypeOf<WorkspaceClient>().toBeObject();
    expectTypeOf<RuntimeSessionSummary>().toBeObject();
    expectTypeOf<RuntimeTaskSummary>().toBeObject();
    expectTypeOf<RuntimeWorkspaceDescriptor>().toBeObject();
    expectTypeOf<RuntimeAuthStatus>().toBeObject();
  });
});
