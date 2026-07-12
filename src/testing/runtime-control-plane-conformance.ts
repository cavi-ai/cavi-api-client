import type { RuntimeControlPlane } from "../core/runtime/control-plane/index.js";
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
    for (const [kind, capability] of Object.entries(declaration?.transports ?? {})) {
      const exposed = controlPlane.transports[kind as keyof typeof controlPlane.transports];
      add(
        `transport:${kind}`,
        exposed !== undefined && Object.entries(capability).every(
          ([key, value]) => exposed[key as keyof typeof exposed] === value,
        ),
        `Declared ${kind} transport capability must match the control-plane object.`,
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
