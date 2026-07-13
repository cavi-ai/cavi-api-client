import type { RuntimeControlPlane } from "../core/runtime/control-plane/index.js";
import { RUNTIME_TRANSPORT_KINDS } from "../core/runtime/control-plane/index.js";
import type {
  RuntimeClientOptions,
  RuntimeProviderModule,
} from "../core/runtime/providers/index.js";
import type { RuntimeProviderConformanceCheck } from "./runtime-provider-conformance.js";

const CONTROL_PLANE_MODULES = [
  "sessions",
  "models",
  "usage",
  "tasks",
  "workspace",
  "authStatus",
  "events",
] as const satisfies readonly (keyof Omit<RuntimeControlPlane, "transports">)[];

export type RuntimeControlPlaneConformanceCheck = RuntimeProviderConformanceCheck;

export type RuntimeControlPlaneConformanceReport = {
  providerKind: string;
  valid: boolean;
  checks: readonly RuntimeControlPlaneConformanceCheck[];
};

export type RuntimeControlPlaneConformanceFixture = {
  module: RuntimeProviderModule;
  clientOptions: RuntimeClientOptions;
};

export async function inspectRuntimeControlPlaneConformance(
  fixture: RuntimeControlPlaneConformanceFixture,
): Promise<RuntimeControlPlaneConformanceReport> {
  const checks: RuntimeControlPlaneConformanceCheck[] = [];
  const add = (id: string, valid: boolean, message: string) => {
    checks.push({ id, status: valid ? "pass" : "fail", message });
  };
  const declaration = fixture.module.controlPlane;
  const factory = fixture.module.createControlPlane;

  add(
    "factory",
    declaration === undefined || factory !== undefined,
    "Providers declaring a control plane must implement createControlPlane.",
  );

  const controlPlane = factory?.(fixture.clientOptions);
  if (controlPlane !== undefined) {
    for (const kind of RUNTIME_TRANSPORT_KINDS) {
      const capability = declaration?.transports?.[kind];
      const exposed = controlPlane.transports[kind];
      add(
        `transport:${kind}`,
        capability === undefined
          ? exposed === undefined
          : exposed !== undefined && Object.entries(capability).every(
            ([key, value]) => exposed[key as keyof typeof exposed] === value,
          ),
        `${kind} must be exposed if and only if it is declared, with matching capabilities.`,
      );
    }

    for (const moduleName of CONTROL_PLANE_MODULES) {
      const declared = declaration?.modules?.[moduleName] === true;
      const exposed = controlPlane[moduleName] !== undefined;
      add(
        `module:${moduleName}`,
        declared === exposed,
        `${moduleName} must be exposed if and only if it is declared.`,
      );
    }
  }

  return {
    providerKind: fixture.module.kind,
    valid: checks.every((check) => check.status !== "fail"),
    checks,
  };
}
