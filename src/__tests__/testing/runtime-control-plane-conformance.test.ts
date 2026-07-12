import { describe, expect, it } from "vitest";
import { inspectRuntimeControlPlaneConformance } from "../../testing/index.js";

const clientOptions = { baseUrl: "https://runtime.example" };
const createClient = () => ({
  getRuntimeCapabilities: async () => ({ providerKind: "acme", supports: { runs: true } }),
  startRun: async () => ({ id: "1", state: "queued" as const }),
});

describe("inspectRuntimeControlPlaneConformance", () => {
  it("passes a truthful HTTP-only module", async () => {
    const http = { kind: "http" as const, stability: "stable" as const, authenticated: true };
    const report = await inspectRuntimeControlPlaneConformance({
      module: {
        kind: "acme",
        controlPlane: { transports: { http }, modules: {} },
        createClient,
        createControlPlane: () => ({ transports: { http } }),
      },
      clientOptions,
    });

    expect(report.valid).toBe(true);
    expect(report.providerKind).toBe("acme");
  });

  it("fails when a control-plane declaration has no factory", async () => {
    const report = await inspectRuntimeControlPlaneConformance({
      module: { kind: "acme", controlPlane: {}, createClient },
      clientOptions,
    });

    expect(report.checks).toContainEqual(expect.objectContaining({ id: "factory", status: "fail" }));
  });

  it("fails when a declared transport is absent from the control plane", async () => {
    const report = await inspectRuntimeControlPlaneConformance({
      module: {
        kind: "acme",
        controlPlane: {
          transports: {
            http: { kind: "http", stability: "stable", authenticated: true },
          },
        },
        createClient,
        createControlPlane: () => ({ transports: {} }),
      },
      clientOptions,
    });

    expect(report.checks).toContainEqual(
      expect.objectContaining({ id: "transport:http", status: "fail" }),
    );
  });

  it("fails when a module advertises sessions without a sessions client", async () => {
    const report = await inspectRuntimeControlPlaneConformance({
      module: {
        kind: "acme",
        controlPlane: { modules: { sessions: true } },
        createClient,
        createControlPlane: () => ({ transports: {} }),
      },
      clientOptions,
    });

    expect(report.checks).toContainEqual(
      expect.objectContaining({ id: "module:sessions", status: "fail" }),
    );
  });

  it("fails when the object exposes an undeclared module", async () => {
    const report = await inspectRuntimeControlPlaneConformance({
      module: {
        kind: "acme",
        controlPlane: { modules: {} },
        createClient,
        createControlPlane: () => ({
          transports: {},
          sessions: {
            listSessions: async () => ({ items: [] }),
            getSession: async () => null,
          },
        }),
      },
      clientOptions,
    });

    expect(report.valid).toBe(false);
    expect(report.checks).toContainEqual(
      expect.objectContaining({ id: "module:sessions", status: "fail" }),
    );
  });

  it("treats modules exposed without any control-plane declaration as undeclared", async () => {
    const report = await inspectRuntimeControlPlaneConformance({
      module: {
        kind: "acme",
        createClient,
        createControlPlane: () => ({
          transports: {},
          sessions: {
            listSessions: async () => ({ items: [] }),
            getSession: async () => null,
          },
        }),
      },
      clientOptions,
    });

    expect(report.checks).toContainEqual(
      expect.objectContaining({ id: "module:sessions", status: "fail" }),
    );
  });
});
